import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  getCampeonatoPermission,
  requireCampeonatoStructureWrite,
} from '@backend/campeonatos/campeonato-permissions'
import { assertPodeCriarSlots } from '@backend/campeonatos/capacidade'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canReadStructure(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  if (permission.role === 'owner' || permission.role === 'manager') return permission.canView
  if (permission.role === 'seller') {
    const perms = permission.sellerPermissions
    return Boolean(
      permission.canView
      && (
        permission.canManage
        || permission.canOrganizeGroups
        || permission.canScore
        || perms?.ver_estrutura !== false
      ),
    )
  }
  return false
}

function slotLetterFromNumber(number: number) {
  let value = number
  let label = ''
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

async function loadStructure(campeonatoId: string) {
  const [
    { data: campeonato, error: campError },
    { data: fases, error: fasesError },
    { data: grupos, error: gruposError },
    { data: slots, error: slotsError },
    { data: jogos, error: jogosError },
  ] = await Promise.all([
    supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url,status,banner_url')
      .eq('id', campeonatoId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('campeonato_fases')
      .select('id,nome,ordem,status,created_at')
      .eq('campeonato_id', campeonatoId)
      .order('ordem', { ascending: true }),
    supabaseAdmin
      .from('campeonato_grupos')
      .select('id,nome,fase_id,slots,whatsapp_url,created_at')
      .eq('campeonato_id', campeonatoId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('campeonato_slots')
      .select('id,grupo_id,fase_id,slot_numero,slot_letra,equipe_id,line_id,status')
      .eq('campeonato_id', campeonatoId)
      .order('slot_numero', { ascending: true }),
    supabaseAdmin
      .from('campeonato_jogos')
      .select('id,nome,fase_id,rodada_id,data_jogo,horario,numero_partidas,mapas,grupos_ids,status,created_at')
      .eq('campeonato_id', campeonatoId)
      .order('created_at', { ascending: true }),
  ])

  if (campError) throw campError
  if (!campeonato) throw new Error('Campeonato não encontrado.')
  if (fasesError) throw fasesError
  if (gruposError) throw gruposError
  if (slotsError) throw slotsError
  if (jogosError) throw jogosError

  // Enriquecer slots com line/equipe
  const lineIds = [...new Set((slots || []).map((s) => s.line_id).filter(Boolean))]
  const equipeIds = [...new Set((slots || []).map((s) => s.equipe_id).filter(Boolean))]
  const [{ data: lines }, { data: equipes }, { data: parts }] = await Promise.all([
    lineIds.length
      ? supabaseAdmin.from('equipe_lines').select('id,nome,logo_url,equipe_id').in('id', lineIds)
      : Promise.resolve({ data: [] as any[] }),
    equipeIds.length
      ? supabaseAdmin.from('equipes').select('id,nome,logo_url').in('id', equipeIds)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin
      .from('campeonato_equipes')
      .select('id,line_id,equipe_id,nome_exibicao,line_nome,equipe_nome,origem_entrada,status,slot_id')
      .eq('campeonato_id', campeonatoId)
      .eq('status', 'ativo'),
  ])
  const lineMap = new Map((lines || []).map((l) => [l.id, l]))
  const equipeMap = new Map((equipes || []).map((e) => [e.id, e]))
  const partByLine = new Map((parts || []).filter((p) => p.line_id).map((p) => [p.line_id, p]))
  const partBySlot = new Map((parts || []).filter((p) => p.slot_id).map((p) => [p.slot_id, p]))

  const slotsEnriquecidos = (slots || []).map((slot) => {
    const line = slot.line_id ? lineMap.get(slot.line_id) : null
    const equipe = slot.equipe_id ? equipeMap.get(slot.equipe_id) : null
    const part = (slot.id && partBySlot.get(slot.id)) || (slot.line_id && partByLine.get(slot.line_id)) || null
    return {
      ...slot,
      line_nome: part?.line_nome || part?.nome_exibicao || line?.nome || null,
      equipe_nome: part?.equipe_nome || equipe?.nome || null,
      line_logo_url: line?.logo_url || equipe?.logo_url || null,
      origem_entrada: part?.origem_entrada || null,
    }
  })

  const slotsByGrupo = new Map<string, { total: number; ocupados: number; livres: number }>()
  for (const slot of slotsEnriquecidos) {
    const key = String(slot.grupo_id || '')
    if (!key) continue
    const current = slotsByGrupo.get(key) || { total: 0, ocupados: 0, livres: 0 }
    current.total += 1
    if (slot.equipe_id || slot.line_id) current.ocupados += 1
    else current.livres += 1
    slotsByGrupo.set(key, current)
  }

  const gruposEnriquecidos = (grupos || []).map((grupo) => {
    const stats = slotsByGrupo.get(grupo.id) || {
      total: Number(grupo.slots || 0),
      ocupados: 0,
      livres: Number(grupo.slots || 0),
    }
    return {
      ...grupo,
      slots_total: stats.total || Number(grupo.slots || 0),
      slots_ocupados: stats.ocupados,
      slots_livres: stats.livres || Math.max(0, (stats.total || Number(grupo.slots || 0)) - stats.ocupados),
    }
  })

  return {
    campeonato,
    fases: fases || [],
    grupos: gruposEnriquecidos,
    slots: slotsEnriquecidos,
    jogos: (jogos || []).map((jogo) => ({
      ...jogo,
      mapas: Array.isArray(jogo.mapas)
        ? jogo.mapas
        : String(jogo.mapas || '')
            .split(',')
            .map((m: string) => m.trim())
            .filter(Boolean),
      grupos_ids: Array.isArray(jogo.grupos_ids) ? jogo.grupos_ids : [],
    })),
    resumo: {
      fases: (fases || []).length,
      grupos: (grupos || []).length,
      slots_total: slotsEnriquecidos.length,
      slots_ocupados: slotsEnriquecidos.filter((s) => s.equipe_id || s.line_id).length,
      jogos: (jogos || []).length,
    },
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canReadStructure(permission)) {
      throw new Error('Você não tem permissão para ver a estrutura deste campeonato.')
    }

    const structure = await loadStructure(id)
    return NextResponse.json({
      ...structure,
      permission: {
        canView: permission.canView,
        canManage: permission.canManage,
        canRemove: permission.canRemove,
        canGenerateToken: permission.canGenerateToken,
        canOrganizeGroups: permission.canOrganizeGroups,
        canManageGames: permission.canManageGames,
        canScore: permission.canScore,
        role: permission.role,
      },
    })
  } catch (error: any) {
    const message =
      (error instanceof Error && error.message)
      || error?.message
      || error?.error_description
      || 'Erro ao carregar estrutura.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/** Criar fase ou grupo (adm / seller com organizar_grupos). */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: campeonatoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoStructureWrite(user.id, campeonatoId)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'create_phase') {
      const nome = String(body.nome || '').trim()
      const ordem = Number(body.ordem || 1)
      if (!nome) throw new Error('Informe o nome da fase.')
      const { data, error } = await supabaseAdmin
        .from('campeonato_fases')
        .insert({
          campeonato_id: campeonatoId,
          nome,
          ordem: Number.isFinite(ordem) ? ordem : 1,
          status: 'ativo',
        })
        .select('*')
        .single()
      if (error?.code === '23505') throw new Error('Já existe uma fase com esse nome neste campeonato.')
      if (error) throw error
      return NextResponse.json({ ok: true, fase: data })
    }

    if (action === 'create_group') {
      const nome = String(body.nome || '').trim()
      const faseId = String(body.fase_id || '').trim()
      const slotsCount = Math.max(1, Math.min(52, Number(body.slots || 12)))
      const whatsapp = String(body.whatsapp_url || '').trim() || null
      if (!nome) throw new Error('Informe o nome do grupo.')
      if (!faseId) throw new Error('Informe a fase do grupo.')

      const { data: fase } = await supabaseAdmin
        .from('campeonato_fases')
        .select('id')
        .eq('id', faseId)
        .eq('campeonato_id', campeonatoId)
        .maybeSingle()
      if (!fase) throw new Error('Fase não encontrada neste campeonato.')

      await assertPodeCriarSlots(campeonatoId, slotsCount, { faseId })

      const { data: grupo, error } = await supabaseAdmin
        .from('campeonato_grupos')
        .insert({
          campeonato_id: campeonatoId,
          fase_id: faseId,
          nome,
          slots: slotsCount,
          whatsapp_url: whatsapp,
        })
        .select('*')
        .single()
      if (error?.code === '23505') throw new Error('Já existe um grupo com esse nome nesta fase.')
      if (error) throw error

      const additions = Array.from({ length: slotsCount }, (_, offset) => {
        const number = offset + 1
        return {
          campeonato_id: campeonatoId,
          fase_id: faseId,
          grupo_id: grupo.id,
          slot_numero: number,
          slot_letra: slotLetterFromNumber(number),
          status: 'livre',
        }
      })
      const { error: slotsError } = await supabaseAdmin.from('campeonato_slots').insert(additions)
      if (slotsError) throw slotsError

      return NextResponse.json({ ok: true, grupo })
    }

    /**
     * Monta várias fases + grupos + slots em uma única requisição.
     * body.fases: [{ nome, ordem?, grupos: [{ nome?, slots?, whatsapp_url? }] }]
     * Se o grupo não tiver nome, gera "Grupo A", "Grupo B", ...
     */
    if (action === 'create_bulk') {
      const rawFases = Array.isArray(body.fases) ? body.fases : []
      if (!rawFases.length) throw new Error('Informe ao menos uma fase.')

      type BulkGrupo = { nome: string; slots: number; whatsapp_url: string | null }
      type BulkFase = { nome: string; ordem: number; grupos: BulkGrupo[] }

      const fasesPlan: BulkFase[] = rawFases.map((raw: any, phaseIndex: number) => {
        const nome = String(raw?.nome || '').trim()
        if (!nome) throw new Error(`Informe o nome da fase ${phaseIndex + 1}.`)
        const ordemRaw = Number(raw?.ordem)
        const ordem = Number.isFinite(ordemRaw) ? ordemRaw : phaseIndex + 1
        const rawGrupos = Array.isArray(raw?.grupos) ? raw.grupos : []
        if (!rawGrupos.length) {
          throw new Error(`A fase "${nome}" precisa de ao menos um grupo.`)
        }
        if (rawGrupos.length > 26) {
          throw new Error(`A fase "${nome}" pode ter no máximo 26 grupos (A–Z).`)
        }

        const grupos: BulkGrupo[] = rawGrupos.map((g: any, groupIndex: number) => {
          const letter = String.fromCharCode(65 + groupIndex)
          const groupName = String(g?.nome || `Grupo ${letter}`).trim()
          if (!groupName) throw new Error(`Informe o nome do grupo ${groupIndex + 1} da fase "${nome}".`)
          const slots = Math.max(1, Math.min(52, Number(g?.slots || 12)))
          const whatsapp = String(g?.whatsapp_url || '').trim() || null
          return { nome: groupName, slots, whatsapp_url: whatsapp }
        })

        const groupNames = grupos.map((g) => g.nome.toLowerCase())
        if (new Set(groupNames).size !== groupNames.length) {
          throw new Error(`Há nomes de grupo repetidos na fase "${nome}".`)
        }

        return { nome, ordem, grupos }
      })

      const phaseNames = fasesPlan.map((f) => f.nome.toLowerCase())
      if (new Set(phaseNames).size !== phaseNames.length) {
        throw new Error('Há nomes de fase repetidos no formulário.')
      }

      // Conflito com fases já existentes
      const { data: existingPhases, error: existingError } = await supabaseAdmin
        .from('campeonato_fases')
        .select('id,nome,ordem')
        .eq('campeonato_id', campeonatoId)
      if (existingError) throw existingError
      const existingNames = new Set((existingPhases || []).map((p) => String(p.nome || '').toLowerCase()))
      for (const fase of fasesPlan) {
        if (existingNames.has(fase.nome.toLowerCase())) {
          throw new Error(`Já existe uma fase chamada "${fase.nome}" neste campeonato.`)
        }
      }

      // Capacidade: só slots da(s) fase(s) de entrada contam no limite.
      // Entrada = menor ordem entre fases existentes + as que serão criadas.
      const existingOrdens = (existingPhases || []).map((p) => Number(p.ordem)).filter(Number.isFinite)
      const newOrdens = fasesPlan.map((f) => f.ordem)
      const ordemEntrada = Math.min(...[...existingOrdens, ...newOrdens])
      const slotsEntradaNovos = fasesPlan
        .filter((f) => f.ordem === ordemEntrada)
        .reduce((sum, f) => sum + f.grupos.reduce((s, g) => s + g.slots, 0), 0)

      if (slotsEntradaNovos > 0) {
        // assertPodeCriarSlots usa a fase de entrada atual no banco; se ainda não há fases,
        // qualquer fase conta como entrada. Passamos faseId undefined para forçar checagem
        // quando estamos criando a própria fase de entrada (ordem mínima).
        // Se já existe fase de entrada e estamos criando fases posteriores, slotsEntradaNovos=0.
        await assertPodeCriarSlots(campeonatoId, slotsEntradaNovos)
      }

      const createdPhaseIds: string[] = []
      const createdGroupIds: string[] = []
      const createdFases: any[] = []
      const createdGrupos: any[] = []
      let slotsCriados = 0

      try {
        for (const fasePlan of fasesPlan) {
          const { data: fase, error: faseError } = await supabaseAdmin
            .from('campeonato_fases')
            .insert({
              campeonato_id: campeonatoId,
              nome: fasePlan.nome,
              ordem: fasePlan.ordem,
              status: 'ativo',
            })
            .select('*')
            .single()
          if (faseError?.code === '23505') {
            throw new Error(`Já existe uma fase com o nome "${fasePlan.nome}".`)
          }
          if (faseError) throw faseError
          createdPhaseIds.push(fase.id)
          createdFases.push(fase)

          for (const grupoPlan of fasePlan.grupos) {
            const { data: grupo, error: grupoError } = await supabaseAdmin
              .from('campeonato_grupos')
              .insert({
                campeonato_id: campeonatoId,
                fase_id: fase.id,
                nome: grupoPlan.nome,
                slots: grupoPlan.slots,
                whatsapp_url: grupoPlan.whatsapp_url,
              })
              .select('*')
              .single()
            if (grupoError?.code === '23505') {
              throw new Error(
                `Já existe um grupo "${grupoPlan.nome}" na fase "${fasePlan.nome}".`,
              )
            }
            if (grupoError) throw grupoError
            createdGroupIds.push(grupo.id)
            createdGrupos.push(grupo)

            const additions = Array.from({ length: grupoPlan.slots }, (_, offset) => {
              const number = offset + 1
              return {
                campeonato_id: campeonatoId,
                fase_id: fase.id,
                grupo_id: grupo.id,
                slot_numero: number,
                slot_letra: slotLetterFromNumber(number),
                status: 'livre',
              }
            })
            const { error: slotsError } = await supabaseAdmin
              .from('campeonato_slots')
              .insert(additions)
            if (slotsError) throw slotsError
            slotsCriados += additions.length
          }
        }
      } catch (createError) {
        // Rollback best-effort: remove o que foi criado nesta operação.
        if (createdGroupIds.length) {
          await supabaseAdmin.from('campeonato_slots').delete().in('grupo_id', createdGroupIds)
          await supabaseAdmin.from('campeonato_grupos').delete().in('id', createdGroupIds)
        }
        if (createdPhaseIds.length) {
          await supabaseAdmin.from('campeonato_fases').delete().in('id', createdPhaseIds)
        }
        throw createError
      }

      return NextResponse.json({
        ok: true,
        resumo: {
          fases: createdFases.length,
          grupos: createdGrupos.length,
          slots: slotsCriados,
        },
        fases: createdFases,
        grupos: createdGrupos,
      })
    }

    throw new Error('Ação inválida.')
  } catch (error: any) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : error?.message || 'Erro ao criar estrutura.' },
      { status: 400 },
    )
  }
}

/** Atualizar fase ou grupo. */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: campeonatoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoStructureWrite(user.id, campeonatoId)
    const body = await req.json().catch(() => ({}))
    const entity = String(body.entity || '')
    const entityId = String(body.id || '').trim()
    if (!entityId) throw new Error('id obrigatório.')

    if (entity === 'phase') {
      const nome = String(body.nome || '').trim()
      const ordem = Number(body.ordem || 1)
      if (!nome) throw new Error('Informe o nome da fase.')
      const { data, error } = await supabaseAdmin
        .from('campeonato_fases')
        .update({
          nome,
          ordem: Number.isFinite(ordem) ? ordem : 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entityId)
        .eq('campeonato_id', campeonatoId)
        .select('*')
        .single()
      if (error?.code === '23505') throw new Error('Já existe uma fase com esse nome neste campeonato.')
      if (error) throw error
      return NextResponse.json({ ok: true, fase: data })
    }

    if (entity === 'group') {
      const { data: current, error: readError } = await supabaseAdmin
        .from('campeonato_grupos')
        .select('*')
        .eq('id', entityId)
        .eq('campeonato_id', campeonatoId)
        .single()
      if (readError) throw readError
      if (!current) throw new Error('Grupo não encontrado.')

      const nome = String(body.nome || current.nome).trim()
      const requestedSlots = Math.max(1, Math.min(52, Number(body.slots ?? current.slots ?? 12)))
      const whatsapp =
        body.whatsapp_url === undefined
          ? current.whatsapp_url
          : String(body.whatsapp_url || '').trim() || null

      const { count: occupiedBeyond } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_id', entityId)
        .not('equipe_id', 'is', null)
        .gt('slot_numero', requestedSlots)
      if ((occupiedBeyond || 0) > 0) {
        throw new Error('Não é possível remover slots ocupados.')
      }

      const { data: updated, error } = await supabaseAdmin
        .from('campeonato_grupos')
        .update({
          nome,
          slots: requestedSlots,
          whatsapp_url: whatsapp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entityId)
        .select('*')
        .single()
      if (error?.code === '23505') throw new Error('Já existe um grupo com esse nome nesta fase.')
      if (error) throw error

      const currentSlots = Number(current.slots || 0)
      if (requestedSlots > currentSlots) {
        const additions = Array.from({ length: requestedSlots - currentSlots }, (_, offset) => {
          const number = currentSlots + offset + 1
          return {
            campeonato_id: campeonatoId,
            fase_id: current.fase_id,
            grupo_id: entityId,
            slot_numero: number,
            slot_letra: slotLetterFromNumber(number),
            status: 'livre',
          }
        })
        const { error: addError } = await supabaseAdmin.from('campeonato_slots').insert(additions)
        if (addError) throw addError
      } else if (requestedSlots < currentSlots) {
        const { error: removeError } = await supabaseAdmin
          .from('campeonato_slots')
          .delete()
          .eq('grupo_id', entityId)
          .gt('slot_numero', requestedSlots)
          .is('equipe_id', null)
          .is('line_id', null)
        if (removeError) throw removeError
      }

      return NextResponse.json({ ok: true, grupo: updated })
    }

    throw new Error('Entidade inválida.')
  } catch (error: any) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : error?.message || 'Erro ao atualizar estrutura.' },
      { status: 400 },
    )
  }
}

/** Excluir fase ou grupo. */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: campeonatoId } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoStructureWrite(user.id, campeonatoId)
    const body = await req.json().catch(() => ({}))
    const entity = String(body.entity || '')
    const entityId = String(body.id || '').trim()
    if (!entityId) throw new Error('id obrigatório.')

    if (entity === 'phase') {
      const { data: grupos } = await supabaseAdmin
        .from('campeonato_grupos')
        .select('id')
        .eq('fase_id', entityId)
        .eq('campeonato_id', campeonatoId)
      const grupoIds = (grupos || []).map((g) => g.id)
      if (grupoIds.length) {
        await supabaseAdmin.from('campeonato_slots').delete().in('grupo_id', grupoIds)
        await supabaseAdmin.from('campeonato_grupos').delete().in('id', grupoIds)
      }
      const { error } = await supabaseAdmin
        .from('campeonato_fases')
        .delete()
        .eq('id', entityId)
        .eq('campeonato_id', campeonatoId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (entity === 'group') {
      await supabaseAdmin.from('campeonato_slots').delete().eq('grupo_id', entityId)
      const { error } = await supabaseAdmin
        .from('campeonato_grupos')
        .delete()
        .eq('id', entityId)
        .eq('campeonato_id', campeonatoId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    throw new Error('Entidade inválida.')
  } catch (error: any) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : error?.message || 'Erro ao excluir estrutura.' },
      { status: 400 },
    )
  }
}
