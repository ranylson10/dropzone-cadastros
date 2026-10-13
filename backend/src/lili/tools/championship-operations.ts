import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { getPublishedRulebook } from '@backend/campeonatos/rulebook'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import type { LiliCard, LiliLocale } from '@backend/lili/types'
import { liliRegistrationDeadlineOpen } from './common'
import { relationMissing } from './team-operations'

export type ManagedChampionship = {
  id: string
  nome: string
  tipo?: string | null
  logo_url?: string | null
  banner_url?: string | null
  status?: string | null
  aprovacao_status?: string | null
  permission: Awaited<ReturnType<typeof getCampeonatoPermission>>
}

export type ChampionshipOperationsOverview = {
  championship: ManagedChampionship
  config: any | null
  phases: any[]
  groups: any[]
  slots: any[]
  teams: any[]
  games: any[]
  rounds: any[]
  rulebookPublished: boolean
  issues: Array<{ level: 'critical' | 'attention' | 'info'; title: string; detail: string; area: string }>
}

export async function listManagedChampionships(authUserId: string): Promise<ManagedChampionship[]> {
  const { data, error } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status,criado_por,produtora_id,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error

  const checked = await Promise.all((data || []).map(async (championship: any) => {
    try {
      const permission = await getCampeonatoPermission(authUserId, String(championship.id))
      const operational = permission.role !== 'none' && (
        permission.canManage || permission.canOrganizeGroups || permission.canManageGames ||
        permission.canScore || permission.canGenerateToken || permission.role === 'owner'
      )
      return operational ? { ...championship, permission } as ManagedChampionship : null
    } catch {
      return null
    }
  }))
  return checked.filter(Boolean) as ManagedChampionship[]
}

export function permissionLabel(permission: ManagedChampionship['permission']) {
  if (permission.role === 'owner') return 'Organizador principal'
  if (permission.role === 'manager') return 'Staff da produtora'
  if (permission.role === 'seller') return 'Vendedor / operador'
  return 'Visualização'
}

export function managedChampionshipCards(items: ManagedChampionship[], locale: LiliLocale = 'pt-BR'): LiliCard[] {
  return items.map((item) => ({
    id: `managed-championship-${item.id}`,
    kind: 'championship',
    title: item.nome,
    subtitle: [item.tipo, permissionLabel(item.permission)].filter(Boolean).join(' • '),
    imageUrl: item.logo_url || item.banner_url || null,
    badges: [item.status || 'rascunho', item.aprovacao_status || 'sem aprovação'],
    details: [
      { label: 'Estrutura', value: item.permission.canOrganizeGroups ? 'Pode gerenciar' : 'Somente leitura' },
      { label: 'Jogos', value: item.permission.canManageGames ? 'Pode gerenciar' : 'Somente leitura' },
      { label: 'Pontuação', value: item.permission.canScore ? 'Pode pontuar' : 'Sem permissão' },
      { label: 'Convites', value: item.permission.canGenerateToken ? 'Pode gerar' : 'Sem permissão' },
    ],
    actions: [
      { id: `open-organizer-${item.id}`, label: locale === 'en' ? 'Open operations' : locale === 'es' ? 'Abrir gestión' : 'Abrir gestão', message: `Abrir central do organizador do campeonato ${item.nome}`, intent: 'abrir_central_organizador', variant: 'primary', context: { locale, selectedChampionshipId: item.id, currentFlow: 'organizer_center' } },
      { id: `open-page-${item.id}`, label: locale === 'en' ? 'Tournament page' : locale === 'es' ? 'Página del torneo' : 'Página do campeonato', href: `/campeonatos/${item.id}`, variant: 'secondary' },
    ],
  }))
}

export async function getChampionshipOperationsOverview(authUserId: string, championshipId: string): Promise<ChampionshipOperationsOverview> {
  const permission = await getCampeonatoPermission(authUserId, championshipId)
  if (permission.role === 'none') throw new Error('Você não possui acesso operacional a este campeonato.')

  const { data: championship, error: championshipError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,logo_url,banner_url,status,aprovacao_status,criado_por,produtora_id,created_at')
    .eq('id', championshipId)
    .is('deleted_at', null)
    .maybeSingle()
  if (championshipError) throw championshipError
  if (!championship) throw new Error('Campeonato não encontrado.')

  const results = await Promise.all([
    supabaseAdmin.from('campeonato_configuracoes').select('*').eq('campeonato_id', championshipId).maybeSingle(),
    supabaseAdmin.from('campeonato_fases').select('*').eq('campeonato_id', championshipId).order('ordem', { ascending: true }),
    supabaseAdmin.from('campeonato_grupos').select('*').eq('campeonato_id', championshipId),
    supabaseAdmin.from('campeonato_slots').select('*').eq('campeonato_id', championshipId).neq('status', 'excluido'),
    supabaseAdmin.from('campeonato_equipes').select('*').eq('campeonato_id', championshipId).neq('status', 'excluido'),
    supabaseAdmin.from('campeonato_jogos').select('*').eq('campeonato_id', championshipId),
    supabaseAdmin.from('campeonato_rodadas').select('*').eq('campeonato_id', championshipId),
  ])

  const [configResult, phasesResult, groupsResult, slotsResult, teamsResult, gamesResult, roundsResult] = results
  for (const result of [configResult, phasesResult, groupsResult, slotsResult, teamsResult, gamesResult]) {
    if (result.error && !relationMissing(result.error)) throw result.error
  }
  if (roundsResult.error && !relationMissing(roundsResult.error)) throw roundsResult.error

  const config = configResult.error ? null : configResult.data || null
  const phases = phasesResult.error ? [] : phasesResult.data || []
  const groups = groupsResult.error ? [] : groupsResult.data || []
  const slots = slotsResult.error ? [] : slotsResult.data || []
  const teams = teamsResult.error ? [] : teamsResult.data || []
  const games = gamesResult.error ? [] : gamesResult.data || []
  const rounds = roundsResult.error ? [] : roundsResult.data || []
  let rulebookPublished = false
  try {
    const published = await getPublishedRulebook(championshipId)
    rulebookPublished = Boolean(published)
  } catch { rulebookPublished = false }

  const issues: ChampionshipOperationsOverview['issues'] = []
  const add = (level: 'critical' | 'attention' | 'info', area: string, title: string, detail: string) => issues.push({ level, area, title, detail })
  if (!config) add('critical', 'Configuração', 'Configuração principal ausente', 'Complete as configurações gerais antes de abrir inscrições.')
  if (championship.status !== 'ativo') add('attention', 'Publicação', 'Campeonato não está ativo', `Status atual: ${championship.status || 'não informado'}.`)
  if (championship.aprovacao_status && championship.aprovacao_status !== 'aprovado') add('attention', 'Publicação', 'Aprovação pendente', `Aprovação atual: ${championship.aprovacao_status}.`)
  if (!phases.length) add('critical', 'Estrutura', 'Nenhuma fase criada', 'Crie a primeira fase para organizar grupos, slots e jogos.')
  if (phases.length && !groups.length) add('attention', 'Estrutura', 'Nenhum grupo criado', 'As fases existem, mas ainda não há grupos operacionais.')
  if (groups.length && !slots.length) add('critical', 'Vagas', 'Nenhum slot criado', 'Crie os slots dos grupos antes de receber equipes.')
  const occupiedSlots = slots.filter((slot: any) => slot.equipe_id || slot.line_id)
  const incompleteOccupied = occupiedSlots.filter((slot: any) => !slot.equipe_id || !slot.line_id)
  if (incompleteOccupied.length) add('attention', 'Vagas', 'Slots ocupados incompletos', `${incompleteOccupied.length} slot(s) possuem equipe ou line ausente.`)
  const activeTeams = teams.filter((team: any) => String(team.status || 'ativo') === 'ativo')
  const unallocatedTeams = activeTeams.filter((team: any) => !team.grupo_id || (!team.slot_id && !team.slot_numero))
  if (unallocatedTeams.length) add('attention', 'Equipes', 'Equipes sem alocação completa', `${unallocatedTeams.length} inscrição(ões) precisam de grupo ou slot.`)
  if (!activeTeams.length) add('info', 'Equipes', 'Nenhuma equipe inscrita', 'O campeonato ainda não possui inscrições ativas.')
  if (phases.length && !games.length) add('attention', 'Jogos', 'Nenhum jogo criado', 'A estrutura existe, mas o calendário de jogos ainda está vazio.')
  const gamesWithoutSchedule = games.filter((game: any) => !game.data && !game.data_jogo && !game.inicio_em)
  if (gamesWithoutSchedule.length) add('attention', 'Jogos', 'Jogos sem data', `${gamesWithoutSchedule.length} jogo(s) ainda não possuem data definida.`)
  if (!rulebookPublished) add('attention', 'Regulamento', 'Regulamento não publicado', 'Publique o regulamento para que equipes e jogadores consultem regras oficiais.')
  if (config?.aceita_novas_inscricoes_equipes && config?.data_limite_inscricao && !liliRegistrationDeadlineOpen(config.data_limite_inscricao)) {
    add('critical', 'Inscrições', 'Prazo encerrado com inscrições abertas', 'Feche as inscrições ou atualize a data limite.')
  }
  if (!issues.length) add('info', 'Auditoria', 'Estrutura operacional organizada', 'Não encontrei pendências básicas neste momento.')

  return { championship: { ...championship, permission }, config, phases, groups, slots, teams, games, rounds, rulebookPublished, issues }
}

export function championshipOperationsSummaryCard(overview: ChampionshipOperationsOverview): LiliCard {
  const occupied = overview.slots.filter((slot: any) => slot.equipe_id || slot.line_id).length
  const activeTeams = overview.teams.filter((team: any) => String(team.status || 'ativo') === 'ativo').length
  const critical = overview.issues.filter((issue) => issue.level === 'critical').length
  const attention = overview.issues.filter((issue) => issue.level === 'attention').length
  return {
    id: `organizer-summary-${overview.championship.id}`,
    kind: 'championship',
    title: overview.championship.nome,
    subtitle: permissionLabel(overview.championship.permission),
    imageUrl: overview.championship.logo_url || overview.championship.banner_url || null,
    badges: critical ? [`⛔ ${critical} crítico(s)`] : attention ? [`⚠️ ${attention} atenção`] : ['✅ Estrutura organizada'],
    details: [
      { label: 'Fases', value: String(overview.phases.length) },
      { label: 'Grupos', value: String(overview.groups.length) },
      { label: 'Slots', value: `${occupied}/${overview.slots.length} ocupados` },
      { label: 'Equipes ativas', value: String(activeTeams) },
      { label: 'Jogos', value: String(overview.games.length) },
      { label: 'Regulamento', value: overview.rulebookPublished ? 'Publicado' : 'Pendente' },
    ],
  }
}

export function championshipStructureCards(overview: ChampionshipOperationsOverview): LiliCard[] {
  return overview.phases.map((phase: any) => {
    const groups = overview.groups.filter((group: any) => String(group.fase_id) === String(phase.id))
    const groupIds = new Set(groups.map((group: any) => String(group.id)))
    const slots = overview.slots.filter((slot: any) => String(slot.fase_id || '') === String(phase.id) || groupIds.has(String(slot.grupo_id)))
    const occupied = slots.filter((slot: any) => slot.equipe_id || slot.line_id).length
    const games = overview.games.filter((game: any) => String(game.fase_id || '') === String(phase.id)).length
    return {
      id: `phase-${phase.id}`,
      kind: 'summary',
      title: phase.nome || `Fase ${phase.ordem || ''}`.trim(),
      subtitle: `Ordem ${phase.ordem || '—'}`,
      badges: [phase.status || 'configurada'],
      details: [
        { label: 'Grupos', value: String(groups.length) },
        { label: 'Slots', value: String(slots.length) },
        { label: 'Ocupação', value: `${occupied}/${slots.length}` },
        { label: 'Jogos', value: String(games) },
      ],
      actions: [{ id: `open-structure-${phase.id}`, label: 'Abrir estrutura completa', href: `/campeonatos/${overview.championship.id}`, variant: 'secondary' }],
    }
  })
}

export function championshipAuditCards(overview: ChampionshipOperationsOverview): LiliCard[] {
  return overview.issues.map((issue, index) => ({
    id: `championship-audit-${index}`,
    kind: 'summary',
    title: `${issue.level === 'critical' ? '⛔' : issue.level === 'attention' ? '⚠️' : 'ℹ️'} ${issue.title}`,
    subtitle: issue.area,
    badges: [issue.level === 'critical' ? 'Crítico' : issue.level === 'attention' ? 'Atenção' : 'Informação'],
    details: [{ label: 'Diagnóstico', value: issue.detail }],
    actions: [{ id: `audit-open-${index}`, label: 'Abrir painel do campeonato', href: `/campeonatos/${overview.championship.id}`, variant: issue.level === 'critical' ? 'primary' : 'secondary' }],
  }))
}
