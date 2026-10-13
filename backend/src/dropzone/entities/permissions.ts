import { softRemoveParticipacao } from "@backend/campeonatos/participacao-sync";
import { supabaseAdmin } from "@backend/shared/supabase-admin";
import { requireProducerWorkspaceAccess, type ProducerCapability } from "@backend/produtora/workspace-access";
import { parseOptionalDateTime } from '@backend/dropzone/entities/tokens'

export function canCreate(profileType: string | null, entityType: string) {
  if (profileType === 'produtora') return ['championship', 'team', 'championship_team', 'phase', 'group', 'group_slot', 'game', 'invite_token', 'registration_link', 'lineup_rule'].includes(entityType)
  if (profileType === 'equipe') return ['team_line', 'championship_team', 'invite_token', 'player_registration', 'player_team'].includes(entityType)
  if (profileType === 'manager') return ['team_line', 'championship_team', 'invite_token', 'player_registration', 'player_team'].includes(entityType)
  if (profileType === 'jogador') return ['player_registration'].includes(entityType)
  return false
}

/** Soft-remove participação ativa ligada ao slot (libera assento sem hard delete). */
export async function freeSlotParticipation(slot: {
  id: string
  campeonato_id: string
  grupo_id: string
  slot_numero: number
  equipe_id?: string | null
  line_id?: string | null
}) {
  // Preferência: slot_id
  let participation: any = null
  const snapshotColumns = 'id,campeonato_id,grupo_id,slot_numero,slot_id,line_id,equipe_id,criado_por,origem_entrada'
  let bySlotQuery = supabaseAdmin
    .from('campeonato_equipes')
    .select(snapshotColumns)
    .eq('status', 'ativo')
    .eq('slot_id', slot.id)
    .eq('campeonato_id', slot.campeonato_id)
  for (const column of ['line_id', 'equipe_id'] as const) {
    bySlotQuery = slot[column] == null ? bySlotQuery.is(column, null) : bySlotQuery.eq(column, slot[column])
  }
  const bySlot = await bySlotQuery.maybeSingle()
  if (!bySlot.error && bySlot.data?.id) {
    participation = bySlot.data
  } else if (bySlot.error && !['42703', 'PGRST204'].includes(bySlot.error.code || '')) {
    throw bySlot.error
  } else {
    let q = supabaseAdmin
      .from('campeonato_equipes')
      .select(snapshotColumns)
      .eq('campeonato_id', slot.campeonato_id)
      .eq('grupo_id', slot.grupo_id)
      .eq('slot_numero', slot.slot_numero)
      .eq('status', 'ativo')
    for (const column of ['line_id', 'equipe_id'] as const) {
      q = slot[column] == null ? q.is(column, null) : q.eq(column, slot[column])
    }
    const { data, error } = await q.maybeSingle()
    if (error) throw error
    participation = data || null
  }

  if (participation) {
    await softRemoveParticipacao(participation.id, participation)
    return
  }

  let mirror = supabaseAdmin
    .from('campeonato_slots')
    .update({
      equipe_id: null,
      line_id: null,
      status: 'livre',
      updated_at: new Date().toISOString(),
    })
    .eq('id', slot.id).eq('campeonato_id', slot.campeonato_id)
  for (const column of ['line_id', 'equipe_id'] as const) {
    mirror = slot[column] == null ? mirror.is(column, null) : mirror.eq(column, slot[column])
  }
  const { data: cleared, error: clearError } = await mirror.select('id').maybeSingle()
  if (clearError) throw clearError
  if (!cleared) throw new Error('O slot mudou durante a operação. Atualize e tente novamente.')
}

export async function requireChampionshipOwner(
  championshipId: string | null | undefined,
  userId: string,
  produtoraId?: string | null,
  capability: ProducerCapability = 'operar',
) {
  if (!championshipId) throw new Error('Campeonato obrigatorio.')
  let data: any
  let error: any
  const initial = await supabaseAdmin
    .from('campeonatos')
    .select('id, criado_por, produtora_id, tipo')
    .eq('id', championshipId)
    .maybeSingle()
  data = initial.data
  error = initial.error
  if (error && ['PGRST204', '42703'].includes(error.code || '')) {
    const fallback = await supabaseAdmin
      .from('campeonatos')
      .select('id, criado_por, produtora_id')
      .eq('id', championshipId)
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error
  if (!data) throw new Error('Campeonato nao encontrado.')
  if (produtoraId && data.produtora_id !== produtoraId) throw new Error('Este campeonato pertence a outra produtora.')

  if (data.criado_por === userId) return data
  if (data.produtora_id) {
    await requireProducerWorkspaceAccess(userId, String(data.produtora_id), capability)
    return data
  }
  throw new Error('Você não tem permissão para executar esta ação no campeonato.')
}

export async function requireManagedTeam(teamId: string | null | undefined, userId: string) {
  if (!teamId) throw new Error('Equipe obrigatoria.')
  const { data, error } = await supabaseAdmin
    .from('equipes')
    .select('id, auth_user_id, dono_auth_user_id')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!data || ![data.auth_user_id, data.dono_auth_user_id].includes(userId)) throw new Error('Voce nao pode gerenciar essa equipe.')
  return data
}

export async function requireTeamInChampionship(championshipId: string | null | undefined, teamId: string | null | undefined) {
  if (!championshipId || !teamId) throw new Error('Campeonato e equipe obrigatorios.')
  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id, grupo_id, line_id')
    .eq('campeonato_id', championshipId)
    .eq('equipe_id', teamId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Essa equipe nao esta inscrita nesse campeonato.')
  return data
}

export async function getLineupRule(campeonatoId: string, grupoId?: string | null) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_regras')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .or(grupoId ? `grupo_id.eq.${grupoId},grupo_id.is.null` : 'grupo_id.is.null')
    .order('grupo_id', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveLineupRule(data: Record<string, any>, createdByChampionshipId: string) {
  const payload = {
    campeonato_id: createdByChampionshipId,
    fase_id: data.fase_id || null,
    grupo_id: data.group_id || data.grupo_id || null,
    vagas_por_equipe: Number(data.vagas_por_equipe || 6),
    abre_em: parseOptionalDateTime(data.abre_em, { fieldLabel: 'Data de abertura da escalação' }),
    encerra_em: parseOptionalDateTime(data.encerra_em, { fieldLabel: 'Data de encerramento da escalação' }),
    permite_substituicao: Boolean(data.permite_substituicao),
    max_substituicoes_por_equipe: Number(data.max_substituicoes_por_equipe || 0),
    substituicao_encerra_em: parseOptionalDateTime(data.substituicao_encerra_em, {
      fieldLabel: 'Prazo de substituição',
    }),
    bloquear_convites_apos_encerramento: data.bloquear_convites_apos_encerramento !== false,
    status: 'ativo',
  }

  let query = supabaseAdmin.from('campeonato_regras').select('id').eq('campeonato_id', payload.campeonato_id)
  query = payload.grupo_id ? query.eq('grupo_id', payload.grupo_id) : query.is('grupo_id', null)
  const { data: existing, error: existingError } = await query.maybeSingle()
  if (existingError) throw existingError

  if (existing?.id) {
    const { data: updated, error } = await supabaseAdmin.from('campeonato_regras').update(payload).eq('id', existing.id).select('*').single()
    if (error) throw error
    return updated
  }

  const { data: inserted, error } = await supabaseAdmin.from('campeonato_regras').insert(payload).select('*').single()
  if (error) throw error
  return inserted
}

export function assertLineupOpen(rule: any, action = 'inscricao') {
  const now = Date.now()
  if (rule?.abre_em && new Date(rule.abre_em).getTime() > now) throw new Error('Escalacao ainda nao abriu.')
  if (rule?.encerra_em && new Date(rule.encerra_em).getTime() < now) throw new Error('Escalacao encerrada.')
  if (action === 'substituicao') {
    if (!rule?.permite_substituicao) throw new Error('Substituicao nao permitida neste campeonato.')
    if (rule?.substituicao_encerra_em && new Date(rule.substituicao_encerra_em).getTime() < now) throw new Error('Prazo de substituicao encerrado.')
  }
}

export async function assertPlayerCapacity(campeonatoId: string, equipeId: string, vagas = 6) {
  const { count, error } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('id', { count: 'exact', head: true })
    .eq('campeonato_id', campeonatoId)
    .eq('equipe_id', equipeId)
    .neq('status', 'deletado')
  if (error) throw error
  if ((count || 0) >= vagas) throw new Error('Essa equipe ja atingiu o limite de vagas de escalacao.')
}

export async function assertPlayerUniqueInChampionship(campeonatoId: string, campeonatoEquipeId: string | null | undefined, idJogo: string) {
  const cleanId = String(idJogo || '').trim()
  if (!cleanId) throw new Error('Informe o ID de jogo.')

  const { data: config, error: configError } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .select('permite_jogador_multiplas_equipes')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (configError) throw configError
  if (config?.permite_jogador_multiplas_equipes) return

  const { data: existing, error } = await supabaseAdmin
    .from('campeonato_jogadores')
    .select('id, campeonato_equipe_id')
    .eq('campeonato_id', campeonatoId)
    .eq('id_jogo', cleanId)
    .neq('status', 'deletado')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (existing && existing.campeonato_equipe_id !== campeonatoEquipeId) {
    throw new Error('Esse jogador ja esta inscrito em outra line deste campeonato.')
  }
}

export async function assertInviteAllowed(campeonatoId: string, equipeId?: string | null) {
  let grupoId: string | null = null
  if (equipeId) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('grupo_id')
      .eq('campeonato_id', campeonatoId)
      .eq('equipe_id', equipeId)
      .maybeSingle()
    if (error) throw error
    grupoId = data?.grupo_id || null
  }
  const rule = await getLineupRule(campeonatoId, grupoId)
  if (rule?.bloquear_convites_apos_encerramento !== false) assertLineupOpen(rule)
  return rule
}
