import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function contextData(req: NextRequest, context: { params: Promise<{ id: string; lineId: string }> }, action: 'ver' | 'editar' | 'escalar') {
  const user = await getBearerUser(req)
  const accounts = await getAccountsForUser(user)
  const { id: equipeId, lineId } = await context.params
  const access = await requireEquipeAccess(user.id, accounts, equipeId, action)
  const { data: line, error } = await supabaseAdmin
    .from('equipe_lines')
    .select('id,equipe_id,nome,tag,logo_url,status')
    .eq('id', lineId)
    .eq('equipe_id', equipeId)
    .maybeSingle()
  if (error) throw error
  if (!line) throw new Error('Line não encontrada nesta equipe.')
  return { user, equipeId, lineId, line, access }
}

function activeStatus(value: unknown) {
  return !['finalizado', 'cancelado', 'encerrado', 'inativo'].includes(String(value || '').toLowerCase())
}

async function loadLine(equipeId: string, lineId: string) {
  const [{ data: roster, error: rosterError }, { data: memberships, error: membershipsError }, { data: participations, error: participationsError }] = await Promise.all([
    supabaseAdmin.from('equipe_jogadores').select('*').eq('equipe_id', equipeId).eq('status', 'ativo').order('nick'),
    supabaseAdmin.from('equipe_line_jogadores').select('*').eq('line_id', lineId).eq('status', 'ativo').order('created_at'),
    supabaseAdmin.from('campeonato_equipes').select('*').eq('equipe_id', equipeId).eq('line_id', lineId).eq('status', 'ativo'),
  ])
  if (rosterError) throw rosterError
  if (membershipsError) throw membershipsError
  if (participationsError) throw participationsError

  const participationIds = (participations || []).map((row: any) => row.id)
  const championshipIds = [...new Set((participations || []).map((row: any) => row.campeonato_id).filter(Boolean))]
  const groupIds = [...new Set((participations || []).map((row: any) => row.grupo_id).filter(Boolean))]

  const [{ data: championships }, { data: formations }, { data: rules }, { data: groups }] = await Promise.all([
    championshipIds.length ? supabaseAdmin.from('campeonatos').select('*').in('id', championshipIds) : Promise.resolve({ data: [] as any[] }),
    participationIds.length ? supabaseAdmin.from('campeonato_jogadores').select('*').in('campeonato_equipe_id', participationIds).eq('status', 'ativo').order('ordem_formacao') : Promise.resolve({ data: [] as any[] }),
    championshipIds.length ? supabaseAdmin.from('campeonato_regras_escalacao').select('*').in('campeonato_id', championshipIds) : Promise.resolve({ data: [] as any[] }),
    groupIds.length ? supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id').in('id', groupIds) : Promise.resolve({ data: [] as any[] }),
  ])

  const memberIds = new Set((memberships || []).map((row: any) => row.equipe_jogador_id))
  const champMap = new Map((championships || []).map((row: any) => [row.id, row]))
  const groupMap = new Map((groups || []).map((row: any) => [row.id, row]))
  const rulesByChamp = new Map<string, any[]>()
  for (const rule of rules || []) {
    const list = rulesByChamp.get(rule.campeonato_id) || []
    list.push(rule)
    rulesByChamp.set(rule.campeonato_id, list)
  }

  const formationByParticipation = new Map<string, any[]>()
  for (const player of formations || []) {
    const list = formationByParticipation.get(player.campeonato_equipe_id) || []
    list.push(player)
    formationByParticipation.set(player.campeonato_equipe_id, list)
  }

  const now = Date.now()
  const events = (participations || []).map((participation: any) => {
    const championship: any = champMap.get(participation.campeonato_id) || {}
    const availableRules = rulesByChamp.get(participation.campeonato_id) || []
    const rule = availableRules.find((item: any) => item.grupo_id && item.grupo_id === participation.grupo_id)
      || availableRules.find((item: any) => !item.grupo_id)
      || null
    const deadline = rule?.encerra_em || rule?.substituicao_encerra_em || null
    const deadlinePassed = deadline ? new Date(deadline).getTime() <= now : false
    const editable = activeStatus(championship.status) && !deadlinePassed
    const maxPlayers = Number(rule?.vagas_por_equipe || championship.jogadores_por_equipe || 4) + Number(championship.reservas || 0)
    return {
      ...participation,
      campeonato: championship,
      grupo: participation.grupo_id ? groupMap.get(participation.grupo_id) || null : null,
      regra: rule,
      limite_jogadores: Math.max(1, maxPlayers),
      pode_alterar: editable,
      bloqueio_motivo: !activeStatus(championship.status)
        ? 'Campeonato encerrado.'
        : deadlinePassed
          ? 'Prazo de alteração encerrado.'
          : null,
      formacao: formationByParticipation.get(participation.id) || [],
    }
  })

  return {
    roster: (roster || []).map((player: any) => ({ ...player, na_line: memberIds.has(player.id) })),
    members: (roster || []).filter((player: any) => memberIds.has(player.id)),
    memberships: memberships || [],
    events,
  }
}

async function writeHistory(values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('equipe_formacao_historico').insert(values)
  if (error) throw error
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const { equipeId, lineId, line, access } = await contextData(req, context, 'ver')
    return NextResponse.json({ line, permissions: access.permissoes, ...(await loadLine(equipeId, lineId)) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível carregar a line.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const requiredAction = action === 'save_formation' ? 'escalar' : 'editar'
    const { user, equipeId, lineId } = await contextData(req, context, requiredAction)

    if (action === 'add_member') {
      const playerId = String(body.equipe_jogador_id || '')
      const { data: player, error } = await supabaseAdmin.from('equipe_jogadores').select('id,equipe_id').eq('id', playerId).eq('equipe_id', equipeId).eq('status', 'ativo').maybeSingle()
      if (error) throw error
      if (!player) throw new Error('Jogador não pertence ao elenco desta equipe.')
      const { data: existingMembership, error: membershipReadError } = await supabaseAdmin.from('equipe_line_jogadores').select('id').eq('line_id', lineId).eq('equipe_jogador_id', playerId).maybeSingle()
      if (membershipReadError) throw membershipReadError
      const membershipPayload = { equipe_id: equipeId, line_id: lineId, equipe_jogador_id: playerId, status: 'ativo', adicionado_por: user.id, removido_por: null, removido_em: null, updated_at: new Date().toISOString() }
      const membershipWrite = existingMembership
        ? await supabaseAdmin.from('equipe_line_jogadores').update(membershipPayload).eq('id', existingMembership.id)
        : await supabaseAdmin.from('equipe_line_jogadores').insert(membershipPayload)
      if (membershipWrite.error) throw membershipWrite.error
      await writeHistory({ equipe_id: equipeId, line_id: lineId, equipe_jogador_id: playerId, acao: 'adicionado_line', realizado_por: user.id })
    } else if (action === 'remove_member') {
      const playerId = String(body.equipe_jogador_id || '')
      const current = await loadLine(equipeId, lineId)
      const affected = current.events.filter((event: any) => event.formacao.some((row: any) => row.equipe_jogador_id === playerId))
      const locked = affected.filter((event: any) => !event.pode_alterar)
      if (locked.length) throw new Error(`Não é possível remover: jogador está escalado em ${locked.map((event: any) => event.campeonato?.nome || 'campeonato bloqueado').join(', ')}.`)
      const formationIds = affected.flatMap((event: any) => event.formacao.filter((row: any) => row.equipe_jogador_id === playerId).map((row: any) => row.id))
      if (formationIds.length) {
        const { error } = await supabaseAdmin.from('campeonato_jogadores').update({ status: 'deletado', removido_por: user.id, removido_em: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', formationIds)
        if (error) throw error
      }
      const { error } = await supabaseAdmin.from('equipe_line_jogadores').update({ status: 'inativo', removido_por: user.id, removido_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('line_id', lineId).eq('equipe_jogador_id', playerId).eq('status', 'ativo')
      if (error) throw error
      await writeHistory({ equipe_id: equipeId, line_id: lineId, equipe_jogador_id: playerId, acao: 'removido_line', detalhes: { formacoes_removidas: formationIds.length }, realizado_por: user.id })
    } else if (action === 'save_formation') {
      const participationId = String(body.campeonato_equipe_id || '')
      const requested = Array.isArray(body.players) ? body.players : []
      const current = await loadLine(equipeId, lineId)
      const event: any = current.events.find((item: any) => String(item.id) === participationId)
      if (!event) throw new Error('Participação da line não encontrada.')
      if (!event.pode_alterar) throw new Error(event.bloqueio_motivo || 'Esta formação não pode mais ser alterada.')
      if (requested.length > event.limite_jogadores) throw new Error(`Este campeonato permite no máximo ${event.limite_jogadores} jogadores nesta formação.`)
      const memberIds = new Set(current.members.map((row: any) => String(row.id)))
      const uniqueIds: string[] = [...new Set<string>(requested.map((row: any) => String(row.equipe_jogador_id || row.id || '')).filter(Boolean))]
      if (uniqueIds.some((id) => !memberIds.has(id))) throw new Error('A formação só pode usar jogadores desta line.')
      const rosterMap = new Map(current.roster.map((row: any) => [String(row.id), row]))
      const authIds = uniqueIds.map((id) => rosterMap.get(id)?.jogador_auth_user_id).filter(Boolean)
      const { data: playerProfiles } = authIds.length ? await supabaseAdmin.from('jogadores').select('id,auth_user_id').in('auth_user_id', authIds) : { data: [] as any[] }
      const profileByAuth = new Map((playerProfiles || []).map((row: any) => [row.auth_user_id, row.id]))
      const existing = event.formacao || []
      const keep = new Set(uniqueIds)
      const removeIds = existing.filter((row: any) => !keep.has(String(row.equipe_jogador_id))).map((row: any) => row.id)
      if (removeIds.length) {
        const { error } = await supabaseAdmin.from('campeonato_jogadores').update({ status: 'deletado', removido_por: user.id, removido_em: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', removeIds)
        if (error) throw error
      }
      for (let index = 0; index < uniqueIds.length; index += 1) {
        const playerId = uniqueIds[index]
        const roster: any = rosterMap.get(playerId)
        const requestedRow: any = requested.find((row: any) => String(row.equipe_jogador_id || row.id) === playerId) || {}
        const old: any = existing.find((row: any) => String(row.equipe_jogador_id) === playerId)
        const payload = {
          campeonato_id: event.campeonato_id,
          equipe_id: equipeId,
          jogador_id: profileByAuth.get(roster.jogador_auth_user_id) || null,
          nick: roster.nick || 'Jogador',
          foto_url: roster.foto_url || null,
          id_jogo: roster.id_jogo || 'pendente',
          funcao: roster.funcao || 'support',
          localidade: roster.localidade || null,
          campeonato_equipe_id: participationId,
          line_id: lineId,
          equipe_jogador_id: playerId,
          tipo_formacao: requestedRow.tipo_formacao === 'reserva' ? 'reserva' : 'titular',
          ordem_formacao: index + 1,
          status: 'ativo',
          updated_at: new Date().toISOString(),
        }
        if (old) {
          const { error } = await supabaseAdmin.from('campeonato_jogadores').update(payload).eq('id', old.id)
          if (error) throw error
        } else {
          const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogadores').insert({ ...payload, origem: 'formacao_line', adicionado_por: user.id }).select('id').single()
          if (error) throw error
          await writeHistory({ equipe_id: equipeId, line_id: lineId, campeonato_id: event.campeonato_id, campeonato_equipe_id: participationId, equipe_jogador_id: playerId, campeonato_jogador_id: inserted.id, acao: 'adicionado_formacao', realizado_por: user.id })
        }
      }
    } else {
      throw new Error('Ação inválida.')
    }

    return NextResponse.json({ ok: true, ...(await loadLine(equipeId, lineId)) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível atualizar a line.' }, { status: 400 })
  }
}
