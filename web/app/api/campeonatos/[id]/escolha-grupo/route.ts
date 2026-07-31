import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function text(value: unknown, max = 100) { return String(value || '').trim().slice(0, max) }

async function ownedParticipations(userId: string, campeonatoId: string) {
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('equipes')
    .select('id')
    .or(`auth_user_id.eq.${userId},dono_auth_user_id.eq.${userId}`)
  if (teamsError) throw teamsError
  const teamIds = (teams || []).map((row) => String(row.id))
  if (!teamIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,equipe_id,line_id,nome_exibicao,grupo_id,slot_id,slot_numero')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'ativo')
    .in('equipe_id', teamIds)
  if (error) throw error
  return data || []
}

async function payload(userId: string, campeonatoId: string) {
  const participations = await ownedParticipations(userId, campeonatoId)
  const [{ data: configs, error: configError }, { data: groups, error: groupsError }, { data: slots, error: slotsError }, { data: blocks, error: blocksError }] = await Promise.all([
    supabaseAdmin.from('campeonato_grupo_escolha_configuracoes').select('*').eq('campeonato_id', campeonatoId),
    supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id,slots').eq('campeonato_id', campeonatoId).order('nome'),
    supabaseAdmin.from('campeonato_slots').select('id,fase_id,grupo_id,slot_numero,slot_letra,status,equipe_id,line_id').eq('campeonato_id', campeonatoId).order('slot_numero'),
    supabaseAdmin.from('campeonato_grupo_escolha_bloqueios').select('id,fase_id,grupo_id,slot_id,motivo').eq('campeonato_id', campeonatoId).eq('ativo', true),
  ])
  if (configError) throw configError
  if (groupsError) throw groupsError
  if (slotsError) throw slotsError
  if (blocksError) throw blocksError
  const now = Date.now()
  const availableConfigs = (configs || []).filter((row) => row.aberta && (!row.abre_em || new Date(row.abre_em).getTime() <= now) && (!row.fecha_em || new Date(row.fecha_em).getTime() >= now))
  return { participations, configs: availableConfigs, groups: groups || [], slots: slots || [], blocks: blocks || [], server_time: new Date().toISOString() }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(request)
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await payload(user.id, id)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar escolha de grupos.'
    return NextResponse.json({ error: message }, { status: message.includes('Sessao') ? 401 : 400 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(request)
    const { id: campeonatoId } = await params
    const body = await request.json()
    const participationId = text(body?.campeonato_equipe_id)
    const groupId = text(body?.grupo_id)
    const slotId = text(body?.slot_id)
    if (!participationId || !groupId || !slotId) throw new Error('Equipe, grupo e slot são obrigatórios.')

    const participations = await ownedParticipations(user.id, campeonatoId)
    const participation = participations.find((row) => String(row.id) === participationId)
    if (!participation) throw new Error('Esta participação não pertence à sua equipe.')

    const { data: group, error: groupError } = await supabaseAdmin.from('campeonato_grupos').select('id,fase_id').eq('id', groupId).eq('campeonato_id', campeonatoId).maybeSingle()
    if (groupError) throw groupError
    if (!group) throw new Error('Grupo inválido.')
    const { data: config, error: configError } = await supabaseAdmin.from('campeonato_grupo_escolha_configuracoes').select('*').eq('campeonato_id', campeonatoId).eq('fase_id', group.fase_id).maybeSingle()
    if (configError) throw configError
    const now = Date.now()
    if (!config?.aberta || (config.abre_em && new Date(config.abre_em).getTime() > now) || (config.fecha_em && new Date(config.fecha_em).getTime() < now)) throw new Error('A escolha de grupos não está aberta para esta fase.')
    const { data: blockRows, error: blockError } = await supabaseAdmin.from('campeonato_grupo_escolha_bloqueios').select('grupo_id,slot_id,motivo').eq('campeonato_id', campeonatoId).eq('fase_id', group.fase_id).eq('ativo', true)
    if (blockError) throw blockError
    const groupBlock = (blockRows || []).find((row) => String(row.grupo_id || '') === groupId)
    if (groupBlock) throw new Error(groupBlock.motivo ? `Grupo bloqueado: ${groupBlock.motivo}` : 'Este grupo está bloqueado pela administração.')
    const slotBlock = (blockRows || []).find((row) => String(row.slot_id || '') === slotId)
    if (slotBlock) throw new Error(slotBlock.motivo ? `Slot bloqueado: ${slotBlock.motivo}` : 'Este slot está bloqueado pela administração.')
    if (participation.grupo_id && !config.permite_troca) throw new Error('A troca de grupo está bloqueada nesta fase.')

    const { data: chosenSlot, error: slotError } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', slotId).eq('campeonato_id', campeonatoId).eq('grupo_id', groupId).eq('status', 'livre').is('equipe_id', null).is('line_id', null).maybeSingle()
    if (slotError) throw slotError
    if (!chosenSlot) throw new Error('O slot selecionado não está mais disponível.')

    const { data: reserved, error: reserveError } = await supabaseAdmin.from('campeonato_slots').update({ equipe_id: participation.equipe_id, line_id: participation.line_id, status: 'ocupado' }).eq('id', chosenSlot.id).eq('status', 'livre').is('equipe_id', null).is('line_id', null).select('id,slot_numero').maybeSingle()
    if (reserveError) throw reserveError
    if (!reserved) throw new Error('O slot escolhido acabou de ser ocupado. Escolha outro slot.')

    const oldSlotId = participation.slot_id ? String(participation.slot_id) : null
    const oldGroupId = participation.grupo_id ? String(participation.grupo_id) : null
    const { error: participationError } = await supabaseAdmin.from('campeonato_equipes').update({ grupo_id: groupId, slot_id: reserved.id, slot_numero: reserved.slot_numero }).eq('id', participationId).eq('campeonato_id', campeonatoId)
    if (participationError) {
      await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre' }).eq('id', reserved.id)
      throw participationError
    }
    if (oldSlotId && oldSlotId !== String(reserved.id)) await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre' }).eq('id', oldSlotId).eq('campeonato_id', campeonatoId)
    const { error: historyError } = await supabaseAdmin.from('campeonato_grupo_escolha_historico').insert({ campeonato_id: campeonatoId, fase_id: group.fase_id, campeonato_equipe_id: participationId, grupo_anterior_id: oldGroupId, grupo_novo_id: groupId, slot_anterior_id: oldSlotId, slot_novo_id: reserved.id, origem: 'equipe', alterado_por: user.id })
    if (historyError) throw historyError
    return NextResponse.json({ ok: true, ...(await payload(user.id, campeonatoId)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao escolher grupo.'
    return NextResponse.json({ error: message }, { status: message.includes('Sessao') ? 401 : 400 })
  }
}
