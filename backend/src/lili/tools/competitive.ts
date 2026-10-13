import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import type { LiliCard, LiliLocale } from '@backend/lili/types'
import { ManagedChampionship } from './championship-operations'

export type CompetitiveOperationsOverview = {
  championship: ManagedChampionship
  games: any[]
  teamResults: any[]
  playerResults: any[]
  issues: Array<{ level: 'critical' | 'attention' | 'info'; title: string; detail: string }>
}

export async function getCompetitiveOperationsOverview(authUserId: string, championshipId: string): Promise<CompetitiveOperationsOverview> {
  const permission = await getCampeonatoPermission(authUserId, championshipId)
  if (permission.role === 'none') throw new Error('Você não possui acesso operacional a este campeonato.')

  const { data: championship, error: championshipError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status')
    .eq('id', championshipId)
    .maybeSingle()
  if (championshipError) throw championshipError
  if (!championship) throw new Error('Campeonato não encontrado.')

  const [gamesResult, teamResultsResult, playerResultsResult] = await Promise.all([
    supabaseAdmin.from('campeonato_jogos').select('*').eq('campeonato_id', championshipId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('campeonato_resultados_equipes').select('*').eq('campeonato_id', championshipId).order('updated_at', { ascending: false }).limit(500),
    supabaseAdmin.from('campeonato_resultados_jogadores').select('*').eq('campeonato_id', championshipId).order('updated_at', { ascending: false }).limit(1000),
  ])

  for (const result of [gamesResult, teamResultsResult, playerResultsResult]) {
    if (result.error) throw result.error
  }

  const games = gamesResult.data || []
  const teamResults = teamResultsResult.data || []
  const playerResults = playerResultsResult.data || []
  const issues: CompetitiveOperationsOverview['issues'] = []

  if (!games.length) issues.push({ level: 'attention', title: 'Nenhum jogo cadastrado', detail: 'Crie os jogos antes de abrir o pontuador.' })
  const unscheduled = games.filter((game: any) => !(game.data || game.data_jogo || game.inicio_em || game.data_hora))
  if (unscheduled.length) issues.push({ level: 'attention', title: 'Jogos sem horário', detail: `${unscheduled.length} jogo(s) ainda não possuem data e horário definidos.` })

  const teamKillsByMatch = new Map<string, number>()
  for (const row of teamResults) teamKillsByMatch.set(`${row.partida_id}:${row.campeonato_equipe_id}`, Number(row.abates || 0))
  const playerKillsByMatch = new Map<string, number>()
  for (const row of playerResults) {
    const key = `${row.partida_id}:${row.campeonato_equipe_id}`
    playerKillsByMatch.set(key, (playerKillsByMatch.get(key) || 0) + Number(row.abates || 0))
  }
  const killMismatches = [...teamKillsByMatch.entries()].filter(([key, teamKills]) => playerKillsByMatch.has(key) && playerKillsByMatch.get(key) !== teamKills)
  if (killMismatches.length) issues.push({ level: 'critical', title: 'Divergência de abates', detail: `${killMismatches.length} resultado(s) possuem total da equipe diferente da soma dos jogadores.` })

  const invalidPositions = teamResults.filter((row: any) => Number(row.posicao || 0) <= 0)
  if (invalidPositions.length) issues.push({ level: 'critical', title: 'Posições inválidas', detail: `${invalidPositions.length} resultado(s) possuem posição inválida.` })

  const resultGameIds = new Set(teamResults.map((row: any) => String(row.jogo_id || '')).filter(Boolean))
  const gamesWithoutResults = games.filter((game: any) => {
    const state = String(game.status || game.situacao || '').toLowerCase()
    const finished = ['finalizado', 'encerrado', 'concluido', 'concluído'].includes(state)
    return finished && !resultGameIds.has(String(game.id))
  })
  if (gamesWithoutResults.length) issues.push({ level: 'attention', title: 'Jogos finalizados sem resultados', detail: `${gamesWithoutResults.length} jogo(s) aparecem como finalizados, mas não possuem resultados de equipe.` })

  if (!issues.length) issues.push({ level: 'info', title: 'Operação competitiva organizada', detail: 'Não encontrei pendências básicas de pontuação ou resultados.' })

  return {
    championship: { ...championship, permission } as ManagedChampionship,
    games,
    teamResults,
    playerResults,
    issues,
  }
}

export function gameDateLabel(game: any, locale: LiliLocale) {
  const raw = game.data_hora || game.inicio_em || game.data_jogo || game.data
  if (!raw) return 'Horário não definido'
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) return String(raw)
  return date.toLocaleString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR')
}

export function competitiveSummaryCard(overview: CompetitiveOperationsOverview, locale: LiliLocale = 'pt-BR'): LiliCard {
  const critical = overview.issues.filter((issue) => issue.level === 'critical').length
  const attention = overview.issues.filter((issue) => issue.level === 'attention').length
  return {
    id: `competitive-summary-${overview.championship.id}`,
    kind: 'summary',
    title: overview.championship.nome,
    subtitle: 'Pontuação e resultados',
    imageUrl: overview.championship.logo_url || overview.championship.banner_url || null,
    badges: [`${overview.games.length} jogo(s)`, `${overview.teamResults.length} resultado(s)`],
    details: [
      { label: 'Resultados de equipes', value: String(overview.teamResults.length) },
      { label: 'Resultados de jogadores', value: String(overview.playerResults.length) },
      { label: 'Alertas críticos', value: String(critical) },
      { label: 'Pontos de atenção', value: String(attention) },
    ],
  }
}

export function scoringGameCards(overview: CompetitiveOperationsOverview, locale: LiliLocale = 'pt-BR'): LiliCard[] {
  const resultsByGame = new Map<string, number>()
  for (const row of overview.teamResults) resultsByGame.set(String(row.jogo_id), (resultsByGame.get(String(row.jogo_id)) || 0) + 1)
  return overview.games.slice(0, 20).map((game: any, index: number) => ({
    id: `score-game-${game.id}`,
    kind: 'game',
    title: game.nome || game.titulo || `Jogo ${index + 1}`,
    subtitle: game.grupo_nome || game.fase_nome || game.status || 'Jogo do campeonato',
    badges: [game.status || game.situacao || 'Pendente', `${resultsByGame.get(String(game.id)) || 0} resultado(s)`],
    details: [
      { label: 'Data e hora', value: gameDateLabel(game, locale) },
      { label: 'Quedas', value: String(game.quantidade_partidas || game.numero_quedas || (Array.isArray(game.quedas) ? game.quedas.length : 'Não informado')) },
      { label: 'Resultados lançados', value: String(resultsByGame.get(String(game.id)) || 0) },
    ],
    actions: [{ id: `open-score-${game.id}`, label: 'Abrir pontuador', href: `/campeonatos/${overview.championship.id}/pontuador/${game.id}`, variant: 'primary' }],
  }))
}

export function competitiveAuditCards(overview: CompetitiveOperationsOverview): LiliCard[] {
  return overview.issues.map((issue, index) => ({
    id: `competitive-audit-${index}`,
    kind: 'result',
    title: issue.title,
    subtitle: issue.detail,
    badges: [issue.level === 'critical' ? 'Crítico' : issue.level === 'attention' ? 'Atenção' : 'Informação'],
    actions: [{ id: `competitive-fix-${index}`, label: 'Abrir campeonato', href: `/campeonatos/${overview.championship.id}`, variant: issue.level === 'critical' ? 'primary' : 'secondary' }],
  }))
}
