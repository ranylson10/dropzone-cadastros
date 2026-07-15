import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { parseLinkMetadata } from '@backend/shared/campeonato-link-metadata'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const maybe = error as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [maybe.message, maybe.details, maybe.hint].filter(Boolean)
    if (parts.length) return parts.join(' | ')
    if (maybe.code) return `${fallback} (${maybe.code})`
  }
  return fallback
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase()
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code || '')
    || message.includes('campeonato_vagas')
    || message.includes('vaga_id')
    || message.includes('origem_entrada')
    || message.includes('nome_exibicao')
    || message.includes('line_id')
}

async function loadLink(token: string) {
  const clean = decodeURIComponent(String(token || '').trim())
  if (!clean) throw new Error('Link de equipes invalido ou inativo.')

  // Tenta token exato e depois case-insensitive (URLs/copias alteram caixa).
  let link: any = null
  const exact = await supabaseAdmin
    .from('campeonato_links')
    .select('*')
    .eq('token', clean)
    .eq('tipo', 'inscricao_equipes_grupo')
    .maybeSingle()
  if (exact.error) throw exact.error
  link = exact.data

  if (!link) {
    const upper = clean.toUpperCase()
    const byUpper = await supabaseAdmin
      .from('campeonato_links')
      .select('*')
      .eq('tipo', 'inscricao_equipes_grupo')
      .ilike('token', upper)
      .maybeSingle()
    if (byUpper.error) throw byUpper.error
    link = byUpper.data
  }

  if (!link) throw new Error('Link de equipes invalido ou inativo.')
  if (link.ativo === false) throw new Error('Este link de equipes foi desativado pelo organizador.')
  if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) throw new Error('Link de equipes expirado.')
  if (!link.campeonato_id || !link.grupo_id) throw new Error('Este link de grupo esta incompleto no banco.')
  return link
}

async function loadMinhasParticipacoes(equipeId: string, campeonatoId: string, grupoId: string) {
  const { data: parts, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,equipe_id,line_id,grupo_id,slot_numero,nome_exibicao,origem_entrada,status')
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .eq('equipe_id', equipeId)
    .eq('status', 'ativo')
    .order('slot_numero', { ascending: true })
  if (error) throw error
  if (!parts?.length) return [] as any[]

  const partIds = parts.map((p) => p.id)
  const lineIds = parts.map((p) => p.line_id).filter(Boolean)

  const [{ data: lines }, { data: jogadores }, { data: links }] = await Promise.all([
    lineIds.length
      ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url').in('id', lineIds)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin
      .from('campeonato_jogadores')
      .select('id,campeonato_equipe_id,nick,foto_url,id_jogo,funcao,status,slot_numero,created_at')
      .in('campeonato_equipe_id', partIds)
      .eq('status', 'ativo')
      .order('slot_numero', { ascending: true }),
    supabaseAdmin
      .from('campeonato_links_inscricao')
      .select('id,campeonato_equipe_id,token,ativo,expira_em,limite_jogadores,created_at')
      .in('campeonato_equipe_id', partIds)
      .eq('tipo', 'escalacao_line')
      .eq('ativo', true)
      .order('created_at', { ascending: false }),
  ])

  const lineMap = new Map((lines || []).map((l) => [l.id, l]))
  const now = Date.now()
  const linkByPart = new Map<string, any>()
  for (const link of links || []) {
    if (link.expira_em && new Date(link.expira_em).getTime() <= now) continue
    if (!linkByPart.has(link.campeonato_equipe_id)) linkByPart.set(link.campeonato_equipe_id, link)
  }

  return parts.map((part) => {
    const line = part.line_id ? lineMap.get(part.line_id) || null : null
    const players = (jogadores || []).filter((j) => j.campeonato_equipe_id === part.id)
    const link = linkByPart.get(part.id) || null
    const limite = Number(link?.limite_jogadores || 6)
    return {
      id: part.id,
      campeonato_equipe_id: part.id,
      equipe_id: part.equipe_id,
      line_id: part.line_id,
      grupo_id: part.grupo_id,
      slot_numero: part.slot_numero,
      nome_exibicao: part.nome_exibicao || line?.nome || 'Line',
      line: line
        ? { id: line.id, nome: line.nome, tag: line.tag, logo_url: line.logo_url }
        : null,
      jogadores: players,
      quantidade_jogadores: players.length,
      limite_jogadores: limite,
      vagas_disponiveis: Math.max(0, limite - players.length),
      link_escalacao: link
        ? {
            id: link.id,
            token: link.token,
            expira_em: link.expira_em,
            limite_jogadores: limite,
            public_path: `/escala/${link.token}`,
          }
        : null,
    }
  })
}

async function sessionTeam(req: NextRequest, campeonatoId: string, grupoId: string) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const equipe = accounts.find((account) => account.profile_type === 'equipe') || null
    if (!equipe) {
      return {
        autenticado: true,
        equipe: null,
        lines: [] as any[],
        lines_disponiveis: [] as any[],
        lines_inscritas: [] as any[],
        minhas_participacoes: [] as any[],
        inscrita: false,
        total_lines_inscritas_campeonato: 0,
      }
    }
    const [{ data: lines }, { data: participacoesCampeonato }, minhasParticipacoes] = await Promise.all([
      supabaseAdmin
        .from('equipe_lines')
        .select('id,nome,tag,logo_url,status')
        .eq('equipe_id', equipe.id)
        .neq('status', 'inativo')
        .order('created_at', { ascending: true }),
      // 1 line = 1 vaga no campeonato (regra de pontuacao/slots).
      supabaseAdmin
        .from('campeonato_equipes')
        .select('id,line_id,status,grupo_id,slot_numero,nome_exibicao')
        .eq('campeonato_id', campeonatoId)
        .eq('equipe_id', equipe.id)
        .eq('status', 'ativo'),
      loadMinhasParticipacoes(equipe.id, campeonatoId, grupoId),
    ])
    const used = new Set((participacoesCampeonato || []).map((item) => item.line_id).filter(Boolean))
    const allLines = (lines || []).map((line) => ({
      ...line,
      ja_inscrita: used.has(line.id),
    }))
    const linesDisponiveis = allLines.filter((line) => !line.ja_inscrita)
    const linesInscritas = allLines
      .filter((line) => line.ja_inscrita)
      .map((line) => {
        const part = (participacoesCampeonato || []).find((p) => p.line_id === line.id)
        return {
          ...line,
          participacao_id: part?.id || null,
          grupo_id: part?.grupo_id || null,
          slot_numero: part?.slot_numero || null,
          nome_exibicao: part?.nome_exibicao || line.nome,
        }
      })

    return {
      autenticado: true,
      equipe: {
        id: equipe.id,
        nome: equipe.name,
        tag: equipe.data?.tag || null,
        logo_url: equipe.data?.logo_url || null,
      },
      // Compat: "lines" continua existindo, mas UI deve preferir lines_disponiveis.
      lines: allLines,
      lines_disponiveis: linesDisponiveis,
      lines_inscritas: linesInscritas,
      minhas_participacoes: minhasParticipacoes,
      inscrita: minhasParticipacoes.length > 0,
      total_lines_inscritas_campeonato: used.size,
    }
  } catch {
    return {
      autenticado: false,
      equipe: null,
      lines: [] as any[],
      lines_disponiveis: [] as any[],
      lines_inscritas: [] as any[],
      minhas_participacoes: [] as any[],
      inscrita: false,
      total_lines_inscritas_campeonato: 0,
    }
  }
}

async function loadGroupSlots(campeonatoId: string, grupoId: string) {
  const { data: slots, error } = await supabaseAdmin
    .from('campeonato_slots')
    .select('id,slot_numero,slot_letra,equipe_id,line_id,status,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url)')
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .order('slot_numero', { ascending: true })
  if (error) throw error
  return slots || []
}

async function loadGroupParticipations(campeonatoId: string, grupoId: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,equipe_id,line_id,grupo_id,slot_numero,status,nome_exibicao')
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .eq('status', 'ativo')
  if (error) throw error
  return data || []
}

async function healSlotFromParticipation(slot: any, part: any) {
  // Corrige desync: participacao ativa no slot_numero, mas campeonato_slots ainda livre.
  if (!slot?.id || !part) return
  if (slot.equipe_id && slot.line_id) return
  await supabaseAdmin
    .from('campeonato_slots')
    .update({
      equipe_id: part.equipe_id,
      line_id: part.line_id,
      status: 'ocupado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', slot.id)
    .is('equipe_id', null)
}

async function mapVagas(slots: any[], participacoes: any[]) {
  const partBySlot = new Map<number, any>()
  for (const part of participacoes) {
    if (part.slot_numero == null) continue
    // Unique real do banco: (grupo_id, slot_numero)
    if (!partBySlot.has(Number(part.slot_numero))) partBySlot.set(Number(part.slot_numero), part)
  }

  const equipeIds = [...new Set(participacoes.map((p) => p.equipe_id).filter(Boolean))]
  const lineIds = [...new Set(participacoes.map((p) => p.line_id).filter(Boolean))]
  const [{ data: equipes }, { data: lines }] = await Promise.all([
    equipeIds.length
      ? supabaseAdmin.from('equipes').select('id,nome,tag,logo_url').in('id', equipeIds)
      : Promise.resolve({ data: [] as any[] }),
    lineIds.length
      ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url').in('id', lineIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const equipeMap = new Map((equipes || []).map((e) => [e.id, e]))
  const lineMap = new Map((lines || []).map((l) => [l.id, l]))

  // Heal desync em background-friendly sequential updates (poucos slots).
  for (const slot of slots) {
    const part = partBySlot.get(Number(slot.slot_numero))
    if (part && !slot.equipe_id) {
      await healSlotFromParticipation(slot, part)
      slot.equipe_id = part.equipe_id
      slot.line_id = part.line_id
      slot.status = 'ocupado'
    }
  }

  return slots.map((slot, index) => {
    const part = partBySlot.get(Number(slot.slot_numero)) || null
    const lineFromJoin = Array.isArray(slot?.equipe_lines) ? slot.equipe_lines[0] : slot?.equipe_lines
    const teamFromJoin = Array.isArray(slot?.equipes) ? slot.equipes[0] : slot?.equipes
    const line = lineFromJoin || (part?.line_id ? lineMap.get(part.line_id) : null) || null
    const team = teamFromJoin || (part?.equipe_id ? equipeMap.get(part.equipe_id) : null) || null
    const ocupada = Boolean(slot?.equipe_id || slot?.line_id || part)
    const letra = String(slot?.slot_letra || '').trim().toUpperCase() || String.fromCharCode(65 + index)
    return {
      index,
      nome: `Slot ${letra}`,
      slot_id: slot?.id || null,
      slot_numero: slot?.slot_numero || index + 1,
      slot_letra: letra,
      ocupada,
      equipe_nome: team?.nome || null,
      line_nome: line?.nome || part?.nome_exibicao || null,
      logo_url: line?.logo_url || team?.logo_url || null,
      referencia_equipe: ocupada ? part?.nome_exibicao || line?.nome || null : null,
      campeonato_equipe_id: part?.id || null,
    }
  })
}

async function payloadFor(req: NextRequest, token: string) {
  const link = await loadLink(token)
  const expected = parseLinkMetadata(link).expected_teams
  const [{ data: campeonato, error: campError }, { data: grupo, error: grupoError }, slots, participacoes] =
    await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').eq('id', link.campeonato_id).single(),
      supabaseAdmin.from('campeonato_grupos').select('id,nome,slots').eq('id', link.grupo_id).single(),
      loadGroupSlots(link.campeonato_id, link.grupo_id),
      loadGroupParticipations(link.campeonato_id, link.grupo_id),
    ])
  if (campError) throw campError
  if (grupoError) throw grupoError
  const session = await sessionTeam(req, link.campeonato_id, link.grupo_id)
  const vagas = await mapVagas(slots, participacoes)

  const usedNames = new Set(
    participacoes
      .map((row) => String(row.nome_exibicao || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const equipesEsperadas = expected.map((nome) => ({
    nome,
    disponivel: !usedNames.has(nome.trim().toLowerCase()),
  }))

  return {
    link: { token: link.token, titulo: link.titulo },
    campeonato,
    grupo,
    vagas,
    equipes_esperadas: equipesEsperadas,
    equipes_esperadas_disponiveis: equipesEsperadas.filter((item) => item.disponivel).map((item) => item.nome),
    resumo_grupo: {
      total: vagas.length,
      ocupadas: vagas.filter((v) => v.ocupada).length,
      livres: vagas.filter((v) => !v.ocupada).length,
    },
    ...session,
  }
}

async function insertParticipacao(payload: Record<string, unknown>) {
  // Tenta payload completo e vai removendo colunas opcionais se o schema estiver desatualizado.
  const attempts: Array<Record<string, unknown>> = [
    payload,
    Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'vaga_id')),
    Object.fromEntries(Object.entries(payload).filter(([key]) => !['vaga_id', 'origem_entrada'].includes(key))),
    Object.fromEntries(Object.entries(payload).filter(([key]) => !['vaga_id', 'origem_entrada', 'nome_exibicao'].includes(key))),
  ]

  let lastError: any = null
  for (const attempt of attempts) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_equipes')
      .insert(attempt)
      .select('*')
      .single()
    if (!error && data) return data
    lastError = error
    if (!isMissingRelation(error)) break
  }
  throw lastError || new Error('Nao foi possivel salvar a equipe no campeonato.')
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    return NextResponse.json(await payloadFor(req, token))
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, 'Convite invalido.') }, { status: 404 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  let occupiedSlotId: string | null = null
  let createdParticipacaoId: string | null = null

  try {
    const { token } = await context.params
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const account = accounts.find((item) => item.profile_type === 'equipe')
    if (!account) throw new Error('Este login ainda nao possui um perfil de equipe vinculado.')

    const body = await req.json().catch(() => ({}))
    const vagaIndex = Number(body.vaga_index)
    const slotIdInformado = String(body.slot_id || '').trim()
    const lineIdInformada = String(body.line_id || '').trim()
    const nomeNovaLine = String(body.nome_line || '').trim()
    const referenciaEquipe = String(body.referencia_equipe || body.nome_lista || '').trim()

    const link = await loadLink(token)
    const expected = parseLinkMetadata(link).expected_teams
    const slots = await loadGroupSlots(link.campeonato_id, link.grupo_id)
    if (!slots.length) throw new Error('Este grupo ainda nao possui slots. Crie o grupo novamente ou regenere os slots.')

    let slot = slotIdInformado
      ? slots.find((item) => item.id === slotIdInformado) || null
      : null

    if (!slot) {
      if (!Number.isInteger(vagaIndex) || vagaIndex < 0) throw new Error('Selecione um slot disponivel.')
      slot = slots[vagaIndex] || null
    }

    if (!slot) throw new Error('Slot do grupo nao encontrado para a letra selecionada.')
    if (slot.equipe_id || slot.line_id) throw new Error('Esse slot ja foi preenchido. Escolha outra letra.')

    // Constraint real: unique (grupo_id, slot_numero) em campeonato_equipes.
    // O slot pode parecer livre e ainda assim existir participacao ativa (desync).
    const { data: slotTaken, error: slotTakenError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,equipe_id,line_id,nome_exibicao,status')
      .eq('campeonato_id', link.campeonato_id)
      .eq('grupo_id', link.grupo_id)
      .eq('slot_numero', slot.slot_numero)
      .eq('status', 'ativo')
      .maybeSingle()
    if (slotTakenError) throw slotTakenError
    if (slotTaken) {
      // Tenta auto-corrigir o slot visual e bloqueia a inscricao nesta letra.
      await healSlotFromParticipation(slot, slotTaken)
      throw new Error(
        `O slot ${String(slot.slot_letra || slot.slot_numero).toUpperCase()} ja esta ocupado por outra equipe/line. Escolha outra letra.`,
      )
    }

    if (expected.length) {
      if (!referenciaEquipe) throw new Error('Selecione qual equipe da lista voce esta representando.')
      const existsInList = expected.some((nome) => nome.trim().toLowerCase() === referenciaEquipe.toLowerCase())
      if (!existsInList) throw new Error('A equipe selecionada nao esta na lista deste grupo.')

      const { data: claimed } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,nome_exibicao')
        .eq('campeonato_id', link.campeonato_id)
        .eq('grupo_id', link.grupo_id)
        .eq('status', 'ativo')
      const already = (claimed || []).some(
        (row) => String(row.nome_exibicao || '').trim().toLowerCase() === referenciaEquipe.toLowerCase(),
      )
      if (already) throw new Error('Essa equipe da lista ja foi reivindicada neste grupo.')
    }

    // Lines ja usadas no campeonato (1 line = 1 vaga).
    const { data: usedParts, error: usedPartsError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,line_id')
      .eq('campeonato_id', link.campeonato_id)
      .eq('equipe_id', account.id)
      .eq('status', 'ativo')
    if (usedPartsError) throw usedPartsError
    const usedLineIds = new Set((usedParts || []).map((row) => row.line_id).filter(Boolean))

    let lineId = lineIdInformada || null
    let lineName = ''
    let lineCriadaAgora = false

    if (lineId) {
      const { data: line, error: lineError } = await supabaseAdmin
        .from('equipe_lines')
        .select('id,nome,status')
        .eq('id', lineId)
        .eq('equipe_id', account.id)
        .maybeSingle()
      if (lineError) throw lineError
      if (!line) throw new Error('A line selecionada nao pertence a sua equipe.')
      if (String(line.status || '').toLowerCase() === 'inativo') {
        throw new Error('A line selecionada esta inativa. Escolha outra ou reative no painel.')
      }
      if (usedLineIds.has(line.id)) {
        throw new Error('Essa line ja esta inscrita neste campeonato. Cada vaga precisa de uma line diferente.')
      }
      lineName = line.nome
    } else {
      if (!nomeNovaLine) {
        throw new Error('Selecione uma line livre ou informe o nome de uma nova line para esta vaga.')
      }

      const target = nomeNovaLine.trim().toLowerCase()
      const { data: existingLines, error: existingLineError } = await supabaseAdmin
        .from('equipe_lines')
        .select('id,nome,status')
        .eq('equipe_id', account.id)
      if (existingLineError) throw existingLineError

      const existing = (existingLines || []).find(
        (row) => String(row.nome || '').trim().toLowerCase() === target,
      )

      if (existing) {
        // Nome ja existe: so reutiliza se a line AINDA NAO estiver no campeonato.
        if (usedLineIds.has(existing.id)) {
          throw new Error(
            `A line "${existing.nome}" ja esta inscrita neste campeonato. Crie outra line para a nova vaga (ex.: ${existing.nome} 2).`,
          )
        }
        if (String(existing.status || '').toLowerCase() === 'inativo') {
          const { data: reactivated, error: reactivateError } = await supabaseAdmin
            .from('equipe_lines')
            .update({ status: 'ativo', updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select('id,nome')
            .single()
          if (reactivateError) throw reactivateError
          lineId = reactivated.id
          lineName = reactivated.nome
        } else {
          lineId = existing.id
          lineName = existing.nome
        }
      } else {
        // Cria line nova ja pensada para esta vaga/slot e usa na inscricao em seguida.
        const { data: created, error } = await supabaseAdmin
          .from('equipe_lines')
          .insert({
            equipe_id: account.id,
            nome: nomeNovaLine.trim(),
            tag: account.data?.tag || null,
            logo_url: account.data?.logo_url || null,
            status: 'ativo',
          })
          .select('id,nome')
          .single()
        if (error) {
          if (error.code === '23505') {
            throw new Error('Ja existe uma line com esse nome nesta equipe. Selecione a line livre na lista.')
          }
          throw error
        }
        lineId = created.id
        lineName = created.nome
        lineCriadaAgora = true
      }
    }

    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('campeonato_id', link.campeonato_id)
      .eq('line_id', lineId)
      .eq('status', 'ativo')
      .maybeSingle()
    if (duplicateError) throw duplicateError
    if (duplicate) {
      throw new Error('Esta line ja esta inscrita neste campeonato. Cada vaga exige uma line diferente.')
    }

    // nome_exibicao guarda a referencia da lista do organizador (quando houver).
    const nomeExibicao = referenciaEquipe || lineName

    // 1) Grava a participação no campeonato (vínculo real equipe/line/grupo/slot).
    const participationPayload: Record<string, unknown> = {
      campeonato_id: link.campeonato_id,
      equipe_id: account.id,
      grupo_id: link.grupo_id,
      slot_numero: slot.slot_numero,
      line_id: lineId,
      nome_exibicao: nomeExibicao,
      // Constraint real no banco: organizador | convite | inscricao
      origem_entrada: 'inscricao',
      criado_por: user.id,
      status: 'ativo',
    }

    let participacao: any
    try {
      participacao = await insertParticipacao(participationPayload)
    } catch (partError: any) {
      if (partError?.code === '23505') {
        const details = String(partError?.details || partError?.message || '').toLowerCase()
        if (details.includes('grupo_id') && details.includes('slot_numero')) {
          throw new Error(
            `O slot ${String(slot.slot_letra || slot.slot_numero).toUpperCase()} ja possui uma inscricao. Escolha outra letra.`,
          )
        }
        if (details.includes('line_id') || details.includes('campeonato_equipes_line')) {
          throw new Error('Esta line ja esta inscrita neste campeonato. Cada vaga exige uma line diferente.')
        }
        if (details.includes('equipe_id') && !details.includes('line')) {
          throw new Error(
            'Este campeonato ainda bloqueia mais de uma vaga por equipe no banco. Rode a migration de lines (campeonato_equipes por line).',
          )
        }
        throw new Error(
          errorMessage(
            partError,
            'Nao foi possivel salvar a inscricao (conflito de unicidade no banco). Atualize a pagina e tente outro slot/line.',
          ),
        )
      }
      throw new Error(errorMessage(partError, 'Nao foi possivel salvar a equipe no campeonato.'))
    }
    createdParticipacaoId = participacao.id

    // 2) Ocupa o slot do grupo com a mesma line.
    const { data: updatedSlot, error: slotError } = await supabaseAdmin
      .from('campeonato_slots')
      .update({
        equipe_id: account.id,
        line_id: lineId,
        status: 'ocupado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', slot.id)
      .eq('campeonato_id', link.campeonato_id)
      .eq('grupo_id', link.grupo_id)
      .is('equipe_id', null)
      .select('id')
      .maybeSingle()

    if (slotError || !updatedSlot) {
      // Soft-remove: hard delete pode quebrar triggers de campeonato_vagas.
      await supabaseAdmin
        .from('campeonato_equipes')
        .update({ status: 'removido', slot_numero: null, grupo_id: null, updated_at: new Date().toISOString() })
        .eq('id', participacao.id)
      createdParticipacaoId = null
      if (slotError?.code === '23505') {
        throw new Error('Esta line ja esta posicionada em outro slot desta fase.')
      }
      throw new Error(errorMessage(slotError, 'A vaga foi preenchida por outra equipe. Atualize e tente novamente.'))
    }
    occupiedSlotId = slot.id

    // 3) Melhor esforço: sincroniza campeonato_vagas legado, se existir.
    try {
      const { data: legacyVaga } = await supabaseAdmin
        .from('campeonato_vagas')
        .select('id,status')
        .eq('campeonato_id', link.campeonato_id)
        .eq('numero_vaga', Number(slot.slot_numero))
        .maybeSingle()
      if (legacyVaga?.id) {
        await supabaseAdmin
          .from('campeonato_equipes')
          .update({ vaga_id: legacyVaga.id })
          .eq('id', participacao.id)
        await supabaseAdmin
          .from('campeonato_vagas')
          .update({
            status: 'ocupada',
            campeonato_equipe_id: participacao.id,
            ocupada_em: new Date().toISOString(),
          })
          .eq('id', legacyVaga.id)
      }
    } catch {
      // Fluxo principal nao depende de campeonato_vagas.
    }

    const letra = String(slot.slot_letra || '').trim().toUpperCase() || String(slot.slot_numero)
    return NextResponse.json({
      ok: true,
      participacao,
      equipe: { id: account.id, nome: account.name },
      line: { id: lineId, nome: lineName, criada_agora: lineCriadaAgora },
      grupo_id: link.grupo_id,
      slot_id: slot.id,
      slot_letra: letra,
      referencia: referenciaEquipe || lineName || `Slot ${letra}`,
      mensagem: lineCriadaAgora
        ? `Line "${lineName}" criada e inscrita no slot ${letra}.`
        : `Line "${lineName}" inscrita no slot ${letra}.`,
    })
  } catch (error) {
    // Rollback de melhor esforço se algo falhou no meio.
    if (createdParticipacaoId && !occupiedSlotId) {
      try {
        await supabaseAdmin
          .from('campeonato_equipes')
          .update({ status: 'removido', slot_numero: null, grupo_id: null, updated_at: new Date().toISOString() })
          .eq('id', createdParticipacaoId)
      } catch {
        // ignore rollback failure
      }
    }
    return NextResponse.json(
      { error: errorMessage(error, 'Erro ao entrar no grupo.') },
      { status: 400 },
    )
  }
}
