import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliCard } from '@backend/lili/types'

export type TeamOperationsOverview = {
  lines: any[]
  players: any[]
  staff: any[]
  managerInvites: any[]
  playerInvites: any[]
  activeRegistrations: any[]
  issues: Array<{ level: 'attention' | 'info'; title: string; detail: string }>
}

export function relationMissing(error: any) {
  return ['42P01', 'PGRST205'].includes(String(error?.code || ''))
}

export async function getTeamOperationsOverview(teamId: string): Promise<TeamOperationsOverview> {
  const [linesResult, playersResult, staffResult, managerInvitesResult, playerInvitesResult, registrationsResult] = await Promise.all([
    supabaseAdmin
      .from('equipe_lines')
      .select('id,equipe_id,nome,tag,logo_url,status,created_at,updated_at')
      .eq('equipe_id', teamId)
      .neq('status', 'inativo')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('equipe_jogadores')
      .select('id,equipe_id,jogador_auth_user_id,jogador_id,jogador_temporario_id,nick,foto_url,id_jogo,funcao,localidade,origem,status,created_at,updated_at')
      .eq('equipe_id', teamId)
      .eq('status', 'ativo')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('manager_equipe')
      .select('id,manager_id,pode_ver,pode_editar,pode_escalar,pode_gerar_token,status,created_at')
      .eq('equipe_id', teamId)
      .eq('status', 'ativo')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('equipe_manager_convites')
      .select('id,manager_id,manager_username,status,expira_em,created_at,pode_ver,pode_editar,pode_escalar,pode_gerar_token')
      .eq('equipe_id', teamId)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('tokens')
      .select('id,token,status,usado,expira_em,created_at')
      .eq('equipe_id', teamId)
      .eq('tipo', 'convite_jogador_equipe')
      .eq('status', 'ativo')
      .eq('usado', false)
      .order('created_at', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('campeonato_equipes')
      .select('id,line_id,campeonato_id,status,nome_exibicao,slot_numero')
      .eq('equipe_id', teamId)
      .eq('status', 'ativo'),
  ])

  for (const result of [linesResult, playersResult, staffResult, registrationsResult]) {
    if (result.error) throw result.error
  }
  if (managerInvitesResult.error && !relationMissing(managerInvitesResult.error)) throw managerInvitesResult.error
  if (playerInvitesResult.error && !relationMissing(playerInvitesResult.error)) throw playerInvitesResult.error

  const staffRows = staffResult.data || []
  const managerIds = [...new Set(staffRows.map((row: any) => row.manager_id).filter(Boolean))]
  const { data: managers, error: managersError } = managerIds.length
    ? await supabaseAdmin
        .from('managers')
        .select('id,username,nome,avatar_url,public_id,status')
        .in('id', managerIds)
    : { data: [] as any[], error: null }
  if (managersError) throw managersError
  const managerMap = new Map((managers || []).map((row: any) => [row.id, row]))
  const staff = staffRows.map((row: any) => ({ ...row, manager: managerMap.get(row.manager_id) || null }))

  const lines = linesResult.data || []
  const players = playersResult.data || []
  const managerInvites = managerInvitesResult.error ? [] : managerInvitesResult.data || []
  const playerInvites = playerInvitesResult.error ? [] : playerInvitesResult.data || []
  const activeRegistrations = registrationsResult.data || []

  const issues: TeamOperationsOverview['issues'] = []
  if (!lines.length) issues.push({ level: 'attention', title: 'Nenhuma line criada', detail: 'Crie pelo menos uma line antes de preparar inscrições e escalações.' })
  if (!players.length) issues.push({ level: 'attention', title: 'Elenco vazio', detail: 'Convide jogadores para formar o elenco oficial da equipe.' })
  if (players.some((row: any) => !String(row.id_jogo || '').trim())) issues.push({ level: 'attention', title: 'Jogadores sem ID do jogo', detail: `${players.filter((row: any) => !String(row.id_jogo || '').trim()).length} jogador(es) precisam completar o ID do Free Fire.` })
  if (players.some((row: any) => !String(row.funcao || '').trim())) issues.push({ level: 'info', title: 'Funções incompletas', detail: `${players.filter((row: any) => !String(row.funcao || '').trim()).length} jogador(es) ainda não possuem função informada.` })
  if (activeRegistrations.some((row: any) => !row.line_id)) issues.push({ level: 'attention', title: 'Inscrição sem line vinculada', detail: `${activeRegistrations.filter((row: any) => !row.line_id).length} inscrição(ões) ativas precisam de revisão.` })
  if (managerInvites.some((row: any) => row.expira_em && new Date(row.expira_em).getTime() < Date.now())) issues.push({ level: 'info', title: 'Convites de manager vencidos', detail: 'Existem convites pendentes com prazo expirado que podem ser cancelados e reenviados.' })
  if (!issues.length) issues.push({ level: 'info', title: 'Equipe organizada', detail: 'Não encontrei pendências operacionais básicas neste momento.' })

  return { lines, players, staff, managerInvites, playerInvites, activeRegistrations, issues }
}

export function teamRosterCards(players: any[], teamId: string): LiliCard[] {
  return players.map((player: any) => ({
    id: `player-${player.id}`,
    kind: 'summary',
    title: player.nick || 'Jogador',
    subtitle: [player.funcao, player.localidade].filter(Boolean).join(' • ') || 'Jogador do elenco',
    imageUrl: player.foto_url || null,
    badges: [player.id_jogo ? `ID ${player.id_jogo}` : 'ID pendente', player.origem === 'convite' ? 'Via convite' : 'Elenco'],
    details: [
      { label: 'Função', value: player.funcao || 'Não informada' },
      { label: 'ID do jogo', value: player.id_jogo || 'Não informado' },
      { label: 'Status', value: player.status || 'ativo' },
    ],
    actions: [{ id: `open-player-${player.id}`, label: 'Abrir equipe', href: `/equipes/${teamId}`, variant: 'secondary' }],
  }))
}

export function teamLineManagementCards(lines: any[], registrations: any[], teamId: string): LiliCard[] {
  const countByLine = new Map<string, number>()
  for (const registration of registrations) {
    if (!registration.line_id) continue
    countByLine.set(registration.line_id, (countByLine.get(registration.line_id) || 0) + 1)
  }
  return lines.map((line: any) => ({
    id: `manage-line-${line.id}`,
    kind: 'line',
    title: line.nome,
    subtitle: line.tag || 'Line da equipe',
    imageUrl: line.logo_url || null,
    badges: [`${countByLine.get(line.id) || 0} campeonato(s) ativo(s)`, line.status || 'ativo'],
    details: [
      { label: 'Participações ativas', value: String(countByLine.get(line.id) || 0) },
      { label: 'Atualizada', value: line.updated_at ? new Date(line.updated_at).toLocaleDateString('pt-BR') : 'Sem registro' },
    ],
    actions: [{ id: `manage-line-page-${line.id}`, label: 'Gerenciar lines', href: `/equipes/${teamId}`, variant: 'primary' }],
  }))
}

export function teamStaffCards(staff: any[], teamId: string): LiliCard[] {
  return staff.map((row: any) => {
    const manager = row.manager || {}
    const permissions = [
      row.pode_ver ? 'ver' : null,
      row.pode_editar ? 'editar' : null,
      row.pode_escalar ? 'escalar' : null,
      row.pode_gerar_token ? 'gerar token' : null,
    ].filter(Boolean)
    return {
      id: `staff-${row.id}`,
      kind: 'summary',
      title: manager.nome || manager.username || 'Manager',
      subtitle: manager.username ? `@${manager.username}` : 'Staff da equipe',
      imageUrl: manager.avatar_url || null,
      badges: permissions.length ? permissions.map(String) : ['Sem permissões'],
      details: [{ label: 'Permissões', value: permissions.join(', ') || 'Nenhuma permissão ativa' }],
      actions: [{ id: `staff-page-${row.id}`, label: 'Gerenciar staff', href: `/equipes/${teamId}`, variant: 'primary' }],
    } as LiliCard
  })
}

export function teamAuditCards(overview: TeamOperationsOverview, teamId: string): LiliCard[] {
  return overview.issues.map((issue, index) => ({
    id: `team-audit-${index}`,
    kind: 'summary',
    title: issue.title,
    subtitle: issue.detail,
    badges: [issue.level === 'attention' ? 'Atenção' : 'Informação'],
    actions: [{ id: `resolve-team-audit-${index}`, label: 'Abrir gestão da equipe', href: `/equipes/${teamId}`, variant: issue.level === 'attention' ? 'primary' : 'secondary' }],
  }))
}
