import { supabaseAdmin } from '../shared/supabase-admin'

const BLOCKED_STATUSES = new Set(['finalizado', 'cancelado', 'encerrado', 'inativo', 'excluido'])

export type LineupWindow = {
  allowed: boolean
  reason: string | null
  openAt: string | null
  closeAt: string | null
  scheduledAt: string | null
  game: any | null
}

function activeStatus(value: unknown) {
  return !BLOCKED_STATUSES.has(String(value || '').toLowerCase())
}

function dateTimeSaoPaulo(date?: string | null, time?: string | null) {
  if (!date) return null
  const cleanDate = String(date).slice(0, 10)
  const cleanTime = String(time || '23:59').slice(0, 5)
  const parsed = new Date(`${cleanDate}T${cleanTime}:00-03:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatPtBr(value: string | null) {
  if (!value) return 'data e hora não definidas'
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fromRule(rule: any): LineupWindow {
  const now = Date.now()
  const openAt = rule?.abre_em || null
  const closeAt = rule?.encerra_em || null
  if (openAt && new Date(openAt).getTime() > now) {
    return { allowed: false, reason: `A escalação ainda não abriu. Liberação prevista para ${formatPtBr(openAt)}.`, openAt, closeAt, scheduledAt: null, game: null }
  }
  if (closeAt && new Date(closeAt).getTime() <= now) {
    return { allowed: false, reason: `Prazo de escalação encerrado em ${formatPtBr(closeAt)}.`, openAt, closeAt, scheduledAt: null, game: null }
  }
  return { allowed: true, reason: null, openAt, closeAt, scheduledAt: null, game: null }
}

export async function resolveLineupWindow(campeonatoId: string, grupoId?: string | null): Promise<LineupWindow> {
  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('campeonato_regras_escalacao')
    .select('*')
    .eq('campeonato_id', campeonatoId)
  if (rulesError) throw rulesError
  const rule = (rules || []).find((row: any) => row.grupo_id && grupoId && row.grupo_id === grupoId)
    || (rules || []).find((row: any) => !row.grupo_id)
    || null

  const { data: relations, error: relError } = grupoId
    ? await supabaseAdmin.from('campeonato_jogos_grupos').select('jogo_id').eq('campeonato_id', campeonatoId).eq('grupo_id', grupoId)
    : { data: [], error: null as any }
  if (relError) throw relError

  const gameIds = [...new Set((relations || []).map((row: any) => row.jogo_id).filter(Boolean))]
  if (!gameIds.length) return fromRule(rule)

  const { data: games, error: gamesError } = await supabaseAdmin
    .from('campeonato_jogos')
    .select('id,nome,data_jogo,horario,status,limite_escalacao_minutos,escalacao_abre_horas_antes,escalacao_fecha_horas_antes,permite_troca_jogadores,limite_troca_minutos')
    .eq('campeonato_id', campeonatoId)
    .in('id', gameIds)
  if (gamesError) throw gamesError

  const candidates = (games || [])
    .filter((game: any) => activeStatus(game.status))
    .map((game: any) => ({ game, scheduled: dateTimeSaoPaulo(game.data_jogo, game.horario) }))
    .filter((item: any) => item.scheduled)
    .sort((a: any, b: any) => a.scheduled.getTime() - b.scheduled.getTime())

  if (!candidates.length) return fromRule(rule)

  const now = Date.now()
  const next = candidates.find((item: any) => item.scheduled.getTime() >= now) || candidates[candidates.length - 1]
  const game = next.game
  const scheduled = next.scheduled as Date
  const openHours = game.escalacao_abre_horas_antes == null ? null : Math.max(0, Number(game.escalacao_abre_horas_antes))
  const closeHours = game.escalacao_fecha_horas_antes == null
    ? (game.limite_escalacao_minutos == null ? null : Math.max(0, Number(game.limite_escalacao_minutos) / 60))
    : Math.max(0, Number(game.escalacao_fecha_horas_antes))
  const openAt = openHours == null ? (rule?.abre_em || null) : new Date(scheduled.getTime() - openHours * 60 * 60 * 1000).toISOString()
  const closeAt = closeHours == null ? (rule?.encerra_em || null) : new Date(scheduled.getTime() - closeHours * 60 * 60 * 1000).toISOString()
  const scheduledAt = scheduled.toISOString()

  if (openAt && new Date(openAt).getTime() > now) {
    return { allowed: false, reason: `A escalação de ${game.nome || 'este jogo'} ainda não abriu. Liberação prevista para ${formatPtBr(openAt)}.`, openAt, closeAt, scheduledAt, game }
  }
  if (closeAt && new Date(closeAt).getTime() <= now) {
    return { allowed: false, reason: `Prazo de escalação de ${game.nome || 'este jogo'} encerrado em ${formatPtBr(closeAt)}.`, openAt, closeAt, scheduledAt, game }
  }
  return { allowed: true, reason: null, openAt, closeAt, scheduledAt, game }
}

export async function assertLineupWindowOpen(campeonatoId: string, grupoId?: string | null) {
  const window = await resolveLineupWindow(campeonatoId, grupoId)
  if (!window.allowed) throw new Error(window.reason || 'Escalação fora do prazo.')
  return window
}

export function assertLineupSwapAllowed(window: LineupWindow, changedFormation: boolean, hasExistingFormation: boolean) {
  if (!changedFormation || !hasExistingFormation) return
  const game = window.game || {}
  if (game.permite_troca_jogadores === false) {
    throw new Error('Troca de jogadores bloqueada para este jogo.')
  }
  const limitMinutes = game.limite_troca_minutos == null ? null : Math.max(0, Number(game.limite_troca_minutos))
  if (limitMinutes == null || !window.scheduledAt) return
  const swapClosesAt = new Date(new Date(window.scheduledAt).getTime() - limitMinutes * 60 * 1000).toISOString()
  if (Date.now() > new Date(swapClosesAt).getTime()) {
    throw new Error(`Prazo de troca de jogadores encerrado em ${formatPtBr(swapClosesAt)}.`)
  }
}

export async function assertPlayerNotInAnotherTeam(campeonatoId: string, player: { jogadorId?: string | null; idJogo?: string | null }, currentParticipationId?: string | null) {
  const { data: config, error: configError } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .select('permite_jogador_multiplas_equipes')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (configError) throw configError
  if (config?.permite_jogador_multiplas_equipes) return

  let query = supabaseAdmin
    .from('campeonato_jogadores')
    .select('id,nick,id_jogo,campeonato_equipe_id,equipe_id')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'ativo')
  if (currentParticipationId) query = query.neq('campeonato_equipe_id', currentParticipationId)

  const filters: string[] = []
  if (player.jogadorId) filters.push(`jogador_id.eq.${player.jogadorId}`)
  if (player.idJogo) filters.push(`id_jogo.eq.${String(player.idJogo).replaceAll(',', '')}`)
  if (!filters.length) return
  const { data, error } = await query.or(filters.join(','))
  if (error) throw error
  if ((data || []).length) {
    const found = data[0]
    throw new Error(`Este jogador já está inscrito neste campeonato por outra equipe/line (${found.nick || found.id_jogo || 'jogador'}).`)
  }
}
