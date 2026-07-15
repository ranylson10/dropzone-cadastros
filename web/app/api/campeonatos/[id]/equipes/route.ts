import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getAccountsForUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission, type CampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { mapParticipacaoDisplay } from '@backend/campeonatos/line-display'
import {
  inserirParticipacaoNoSlot,
  listSlotsLinesView,
  resolveLineForInscricao,
  softRemoveParticipacao,
} from '@backend/campeonatos/participacao-sync'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function hasSellerPermission(seller: any, key: string) {
  return seller?.permissoes?.[key] !== false
}

/** Marca convites de slot expirados (não bloqueia a listagem se falhar). */
async function liberarExpirados(campeonatoId: string) {
  try {
    const agora = new Date().toISOString()
    const { data: expirados } = await supabaseAdmin
      .from('tokens')
      .select('id,vaga_id')
      .eq('campeonato_id', campeonatoId)
      .eq('tipo', 'convite_equipe_campeonato')
      .eq('status', 'ativo')
      .eq('usado', false)
      .lte('expira_em', agora)

    if (!expirados?.length) return
    const ids = expirados.map((item) => item.id)
    await supabaseAdmin.from('tokens').update({ status: 'expirado' }).in('id', ids)

    const vagaIds = expirados.map((t) => t.vaga_id).filter(Boolean)
    if (vagaIds.length) {
      await supabaseAdmin
        .from('campeonato_vagas')
        .update({
          status: 'livre',
          reservada_por_token_id: null,
          reservada_em: null,
          reserva_expira_em: null,
          nome_equipe_reservada: null,
          nome_line_reservada: null,
        })
        .in('id', vagaIds)
        .eq('status', 'reservada')
    }
  } catch {
    // listagem não depende disso
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    let permission: CampeonatoPermission = { canView: true, canManage: false, canGenerateToken: false, role: 'none', produtoraId: null }
    try {
      const user = await getBearerUser(req)
      permission = await getCampeonatoPermission(user.id, id) as typeof permission
      if (permission.role === 'seller') {
        const { data: sellerRow, error: sellerErr } = await supabaseAdmin
          .from('campeonato_vendedores')
          .select('id')
          .eq('campeonato_id', id)
          .eq('manager_auth_user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle()
        if (sellerErr) throw sellerErr
        if (sellerRow) permission.canManage = true
      }
    } catch {
    }

    const agoraIso = new Date().toISOString()
    // liberarExpirados em paralelo com a leitura (não serializa a tela)
    const [, { data: campeonato, error: campError }, viewResult, convitesRes] = await Promise.all([
      liberarExpirados(id),
      supabaseAdmin.from('campeonatos').select('id, nome, logo_url').eq('id', id).is('deleted_at', null).single(),
      listSlotsLinesView(id),
      supabaseAdmin
        .from('tokens')
        .select('id,token,slot_id,vaga_id,expira_em,status,usado,nome_equipe_reservada,nome_line_reservada')
        .eq('campeonato_id', id)
        .eq('tipo', 'convite_equipe_campeonato')
        .eq('status', 'ativo')
        .eq('usado', false)
        .or(`expira_em.is.null,expira_em.gt.${agoraIso}`),
    ])
    if (campError) throw campError

    const convites = convitesRes.error ? [] : convitesRes.data || []
    const conviteBySlot = new Map<string, any>()
    for (const t of convites) {
      if (t.slot_id && !conviteBySlot.has(t.slot_id)) conviteBySlot.set(t.slot_id, t)
    }

    // Caminho rápido: view enxuta (1 query joinada). Fallback se migration ainda não rodou.
    if (viewResult.source === 'view' && Array.isArray(viewResult.rows)) {
      const vagas = (viewResult.rows as any[]).map((row) => {
        const filled = Boolean(row.participacao_id || row.line_id)
        const convite = !filled ? conviteBySlot.get(row.slot_id) || null : null
        const status = filled ? 'ocupada' : convite ? 'reservada' : 'livre'
        const line = row.line_id
          ? { id: row.line_id, nome: row.line_nome, tag: row.line_tag, logo_url: row.line_logo_url }
          : null
        const equipe = row.equipe_id
          ? { id: row.equipe_id, nome: row.equipe_nome, tag: row.equipe_tag, logo_url: row.equipe_logo_url }
          : null
        const campeonatoEquipe = row.participacao_id
          ? mapParticipacaoDisplay({
              id: row.participacao_id,
              equipe_id: row.equipe_id,
              line_id: row.line_id,
              nome_exibicao: row.nome_exibicao,
              origem_entrada: row.origem_entrada,
              grupo_id: row.grupo_id,
              slot_numero: row.slot_numero,
              equipe,
              line,
            })
          : (row.line_id || row.equipe_id)
            ? mapParticipacaoDisplay({
                id: String(row.slot_id),
                equipe_id: row.equipe_id,
                line_id: row.line_id,
                nome_exibicao: row.line_nome || null,
                origem_entrada: 'slot',
                grupo_id: row.grupo_id,
                slot_numero: row.slot_numero,
                equipe,
                line,
              })
            : null

        const fase = row.fase_id
          ? { id: row.fase_id, nome: row.fase_nome, ordem: row.fase_ordem }
          : null
        const grupo = row.grupo_id
          ? { id: row.grupo_id, nome: row.grupo_nome, fase_id: row.fase_id, fase }
          : null

        return {
          id: row.slot_id,
          numero_vaga: Number(row.slot_numero || 0),
          status,
          nome_equipe_reservada: convite?.nome_equipe_reservada || null,
          nome_line_reservada: convite?.nome_line_reservada || null,
          reserva_expira_em: convite?.expira_em || null,
          grupo_id: row.grupo_id,
          fase_id: row.fase_id,
          fase,
          grupo,
          slot_id: row.slot_id,
          slot_numero: row.slot_numero,
          slot_letra: row.slot_letra,
          equipe_id: row.equipe_id,
          line_id: row.line_id,
          line_nome: campeonatoEquipe?.line_nome || row.line_nome || null,
          line_logo_url: campeonatoEquipe?.line_logo_url || row.line_logo_url || null,
          line_tag: campeonatoEquipe?.line_tag || row.line_tag || null,
          equipe_nome: campeonatoEquipe?.equipe_nome || row.equipe_nome || null,
          campeonato_equipe: campeonatoEquipe,
          convite: convite
            ? {
                id: convite.id,
                token: convite.token,
                expira_em: convite.expira_em,
                status: convite.status,
                usado: convite.usado,
                nome_equipe_reservada: convite.nome_equipe_reservada,
                nome_line_reservada: convite.nome_line_reservada,
                vaga_id: convite.vaga_id,
                slot_id: convite.slot_id || row.slot_id,
              }
            : null,
        }
      })

      return NextResponse.json({
        campeonato,
        permission: {
          canView: permission.canView,
          canManage: permission.canManage,
          canGenerateToken: permission.canGenerateToken,
          role: permission.role,
        },
        vagas,
        modelo: {
          unidade_competitiva: 'line',
          pasta: 'equipe',
          hierarquia: ['campeonato', 'fase', 'grupo', 'slot', 'line'],
          leitura: 'vw_campeonato_slots_lines',
        },
      })
    }

    // Fallback: queries manuais se a view ainda não existir no Supabase.
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from('campeonato_slots')
      .select('id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url),grupos:grupo_id(id,nome)')
      .eq('campeonato_id', id)
      .order('slot_numero')
    if (slotsError) throw slotsError

    const { data: participacoes } = await supabaseAdmin.from('campeonato_equipes').select('*').eq('campeonato_id', id).eq('status', 'ativo')

    const equipeIds = [
      ...(slots || []).map((s) => s.equipe_id).filter(Boolean),
      ...(participacoes || []).map((p) => p.equipe_id).filter(Boolean),
    ]
    const lineIds = [
      ...(slots || []).map((s) => s.line_id).filter(Boolean),
      ...(participacoes || []).map((p) => p.line_id).filter(Boolean),
    ]

    const [{ data: equipes }, { data: lines }] = await Promise.all([
      equipeIds.length ? supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').in('id', Array.from(new Set(equipeIds))) : Promise.resolve({ data: [] as any[] }),
      lineIds.length ? supabaseAdmin.from('equipe_lines').select('id, nome, tag, logo_url').in('id', Array.from(new Set(lineIds))) : Promise.resolve({ data: [] as any[] }),
    ])

    const equipesMap = new Map((equipes || []).map((e) => [e.id, e]))
    const linesMap = new Map((lines || []).map((l) => [l.id, l]))
    const partMap = new Map((participacoes || []).map((p) => {
      const equipe = equipesMap.get(p.equipe_id) || null
      const line = p.line_id ? linesMap.get(p.line_id) || null : null
      return [p.id, mapParticipacaoDisplay({ ...p, equipe, line })]
    }))

    const grupoIds = [...new Set((slots || []).map((s: any) => s.grupo_id).filter(Boolean))]
    const { data: gruposFull } = grupoIds.length
      ? await supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id,slots').in('id', grupoIds)
      : { data: [] as any[] }
    const faseIds = [...new Set((gruposFull || []).map((g) => g.fase_id).filter(Boolean))]
    const { data: fases } = faseIds.length
      ? await supabaseAdmin.from('campeonato_fases').select('id,nome,ordem').in('id', faseIds).order('ordem')
      : { data: [] as any[] }
    const faseMap = new Map((fases || []).map((f) => [f.id, f]))
    const grupoMap = new Map((gruposFull || []).map((g) => [g.id, { ...g, fase: g.fase_id ? faseMap.get(g.fase_id) || null : null }]))

    const usedParticipationIds = new Set<string>()
    const slotsWithParticipations = (slots || []).map((slot: any) => {
      const bySlotId = (participacoes || []).find((p: any) => p.slot_id === slot.id && !usedParticipationIds.has(p.id))
      const byLine = slot.line_id
        ? (participacoes || []).find((p: any) => p.line_id === slot.line_id && !usedParticipationIds.has(p.id))
        : null
      const byGrupoSlot = (participacoes || []).find((p: any) =>
        !usedParticipationIds.has(p.id)
        && p.grupo_id === slot.grupo_id
        && Number(p.slot_numero) === Number(slot.slot_numero)
      )
      const participation = bySlotId || byLine || byGrupoSlot || null
      if (participation?.id) usedParticipationIds.add(participation.id)

      const equipeId = slot.equipe_id || participation?.equipe_id || null
      const lineId = slot.line_id || participation?.line_id || null
      const filled = Boolean(participation || lineId)
      const convite = !filled ? conviteBySlot.get(slot.id) || null : null
      const status = filled ? 'ocupada' : convite ? 'reservada' : 'livre'
      const equipe = equipeId ? equipesMap.get(equipeId) || null : null
      const line = lineId ? linesMap.get(lineId) || null : null
      const campeonatoEquipe = participation
        ? partMap.get(participation.id) || null
        : (lineId || equipeId)
          ? mapParticipacaoDisplay({
              id: String(slot.id),
              equipe_id: equipeId,
              line_id: lineId,
              nome_exibicao: line?.nome || null,
              origem_entrada: 'slot',
              grupo_id: slot.grupo_id,
              slot_numero: slot.slot_numero,
              equipe,
              line,
            })
          : null

      const grupo = grupoMap.get(slot.grupo_id) || slot.grupos || null
      const display = campeonatoEquipe

      return {
        id: slot.id,
        numero_vaga: Number(slot.slot_numero || 0),
        status,
        nome_equipe_reservada: convite?.nome_equipe_reservada || null,
        nome_line_reservada: convite?.nome_line_reservada || null,
        reserva_expira_em: convite?.expira_em || null,
        grupo_id: slot.grupo_id,
        fase_id: slot.fase_id || grupo?.fase_id || null,
        fase: grupo?.fase || null,
        grupo,
        slot_id: slot.id,
        slot_numero: slot.slot_numero,
        slot_letra: slot.slot_letra,
        equipe_id: equipeId,
        line_id: lineId,
        line_nome: display?.line_nome || null,
        line_logo_url: display?.line_logo_url || null,
        line_tag: display?.line_tag || null,
        equipe_nome: display?.equipe_nome || null,
        campeonato_equipe: campeonatoEquipe,
        convite: convite
          ? {
              id: convite.id,
              token: convite.token,
              expira_em: convite.expira_em,
              status: convite.status,
              usado: convite.usado,
              nome_equipe_reservada: convite.nome_equipe_reservada,
              nome_line_reservada: convite.nome_line_reservada,
              vaga_id: convite.vaga_id,
              slot_id: convite.slot_id || slot.id,
            }
          : null,
      }
    })

    const orphanParticipations = (participacoes || [])
      .filter((p: any) => !usedParticipationIds.has(p.id))
      .map((p: any, index: number) => {
        const display = partMap.get(p.id) || null
        return {
          id: p.id,
          numero_vaga: Number(p.slot_numero || 1000 + index),
          status: 'ocupada' as const,
          nome_equipe_reservada: null,
          nome_line_reservada: null,
          reserva_expira_em: null,
          grupo_id: p.grupo_id,
          fase_id: null,
          fase: null,
          grupo: p.grupo_id ? grupoMap.get(p.grupo_id) || null : null,
          slot_id: p.slot_id || null,
          slot_numero: p.slot_numero,
          slot_letra: null,
          equipe_id: p.equipe_id,
          line_id: p.line_id,
          line_nome: display?.line_nome || null,
          line_logo_url: display?.line_logo_url || null,
          line_tag: display?.line_tag || null,
          equipe_nome: display?.equipe_nome || null,
          campeonato_equipe: display,
          convite: null,
        }
      })

    return NextResponse.json({
      campeonato,
      permission: {
        canView: permission.canView,
        canManage: permission.canManage,
        canGenerateToken: permission.canGenerateToken,
        role: permission.role,
      },
      vagas: [...slotsWithParticipations, ...orphanParticipations],
      modelo: {
        unidade_competitiva: 'line',
        pasta: 'equipe',
        hierarquia: ['campeonato', 'fase', 'grupo', 'slot', 'line'],
        leitura: 'fallback',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar equipes.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    let allowedToManage = Boolean(permission.canManage)
    let sellerPermission: any = null
    if (!allowedToManage && permission.role === 'seller') {
      const accounts = await getAccountsForUser(user)
      const account = accounts.find((item) => item.profile_type === 'manager')
      if (account) {
        const { data: seller, error: sellerErr } = await supabaseAdmin
          .from('campeonato_vendedores')
          .select('id,limite_vagas,permissoes')
          .eq('campeonato_id', id)
          .eq('manager_auth_user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle()
        if (sellerErr) throw sellerErr
        if (seller) {
          sellerPermission = seller
          allowedToManage = true
        }
      }
    }
    if (!allowedToManage) throw new Error('Você não tem permissão para gerenciar este campeonato.')
    if (permission.role === 'seller') {
      if (!sellerPermission) throw new Error('Permissão de vendedor não encontrada para este campeonato.')
      if (!hasSellerPermission(sellerPermission, 'adicionar_equipes')) throw new Error('Este vendedor não pode adicionar equipes.')
      const limiteVagas = Number(sellerPermission.limite_vagas || 0)
      if (limiteVagas > 0) {
        const { count, error: countError } = await supabaseAdmin
          .from('campeonato_equipes')
          .select('id', { count: 'exact', head: true })
          .eq('campeonato_id', id)
          .eq('criado_por', user.id)
          .eq('origem_entrada', 'vendedor')
          .eq('status', 'ativo')
        if (countError) throw countError
        if (Number(count || 0) >= limiteVagas) throw new Error(`Este vendedor atingiu o limite de ${limiteVagas} vaga(s).`)
      }
    }
    const body = await req.json()
    // UI legada envia vaga_id com id do slot estrutural (campeonato_slots.id).
    const slotId = String(body.slot_id || body.vaga_id || '')
    const equipeId = String(body.equipe_id || '')
    if (!slotId || !equipeId) throw new Error('Selecione o slot e a equipe (pasta).')

    const { data: slot } = await supabaseAdmin
      .from('campeonato_slots')
      .select('id,grupo_id,slot_numero,slot_letra,equipe_id,line_id')
      .eq('id', slotId)
      .eq('campeonato_id', id)
      .maybeSingle()
    if (!slot) throw new Error('Slot não encontrado.')
    if (slot.equipe_id || slot.line_id) throw new Error('Este slot já está ocupado.')

    const { data: equipe } = await supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').eq('id', equipeId).single()
    if (!equipe) throw new Error('Equipe não encontrada.')

    // Unidade competitiva = line. Pasta = equipe.
    const resolved = await resolveLineForInscricao({
      equipeId,
      campeonatoId: id,
      lineId: body.line_id ? String(body.line_id) : null,
      nomeLine: String(body.nome_line || '').trim() || null,
      tag: equipe.tag,
      logoUrl: equipe.logo_url,
    })

    const origem = permission.role === 'seller' ? 'inscricao' : 'organizador'
    // Escrita enxuta: campeonato_id + line_id + slot_id
    const participacao = await inserirParticipacaoNoSlot({
      campeonatoId: id,
      slotId,
      lineId: resolved.id,
      equipeId,
      nomeExibicao: resolved.nome,
      origem,
      criadoPor: user.id,
    })

    return NextResponse.json({
      ok: true,
      participacao,
      line: { id: resolved.id, nome: resolved.nome, criada_agora: resolved.criada_agora },
      mensagem: resolved.criada_agora
        ? `Line "${resolved.nome}" criada e adicionada ao slot ${slot.slot_letra || slot.slot_numero}.`
        : `Line "${resolved.nome}" adicionada ao slot ${slot.slot_letra || slot.slot_numero}.`,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao adicionar line.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    const participacaoId = req.nextUrl.searchParams.get('participacao_id') || ''
    const { data: participacao } = await supabaseAdmin.from('campeonato_equipes').select('id, grupo_id, slot_numero, line_id, criado_por, origem_entrada').eq('id', participacaoId).eq('campeonato_id', id).single()
    if (!participacao) throw new Error('Participação não encontrada.')
    if (!permission.canManage) {
      if (permission.role !== 'seller') throw new Error('Você não tem permissão para gerenciar este campeonato.')
      const { data: seller, error: sellerError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('id,permissoes')
        .eq('campeonato_id', id)
        .eq('manager_auth_user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()
      if (sellerError) throw sellerError
      if (!seller || !hasSellerPermission(seller, 'remover_proprias_equipes')) throw new Error('Este vendedor não pode remover equipes.')
      // Em producao o check constraint ainda nao aceita "vendedor"; usamos "convite" para seller.
      const origemSeller = ['vendedor', 'convite', 'inscricao']
      if (participacao.criado_por !== user.id || !origemSeller.includes(String(participacao.origem_entrada || ''))) {
        throw new Error('O vendedor só pode remover equipes que ele adicionou.')
      }
    }
    await softRemoveParticipacao(participacaoId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao remover line.' }, { status: 400 })
  }
}
