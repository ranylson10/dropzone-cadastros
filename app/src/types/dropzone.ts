export type ProfileType = 'jogador' | 'equipe' | 'produtora' | 'manager' | 'broadcast'

export type MobileActionId =
  | 'browse_vacancies'
  | 'buy_slot'
  | 'my_championships'
  | 'lineup'
  | 'team_directory'
  | 'team_public'
  | 'team_roster'
  | 'team_create'
  | 'player_directory'
  | 'player_public'
  | 'agenda'
  | 'invites'
  | 'wallet'
  | 'commerce'
  | 'rank'
  | 'lili'
  | 'seller_sales'
  | 'producer_overview'
  | 'token_action'
  | 'dashboard'
  | 'profile_management'
  | 'profile_create'
  | 'line_management'
  | 'player_dashboard'
  | 'championship_management'

export type MobileRoute =
  | 'home'
  | 'search'
  | 'vacancies'
  | 'purchase_claim'
  | 'championship_actions'
  | 'championship_public'
  | 'my_championships'
  | 'lineup'
  | 'team_directory'
  | 'team_public'
  | 'team_roster'
  | 'team_create'
  | 'player_directory'
  | 'player_public'
  | 'agenda'
  | 'invites'
  | 'wallet'
  | 'commerce'
  | 'rank'
  | 'lili'
  | 'seller_sales'
  | 'producer_overview'
  | 'token_action'
  | 'dashboard'
  | 'profile_management'
  | 'profile_create'
  | 'line_management'
  | 'player_dashboard'
  | 'championship_management'

export type MobileQuickAction = {
  id: MobileActionId
  title: string
  description: string
  profileTypes: ProfileType[]
  priority: number
}

export type ChampionshipCard = {
  id: string
  name: string
  mode: string
  logoUrl?: string | null
  bannerUrl?: string | null
  priceLabel: string
  prizeLabel?: string | null
  freeSlots: number
  nextMatchLabel?: string | null
  hasLive?: boolean
}

export type UserTask = {
  id: string
  title: string
  description: string
  action: MobileActionId
  severity?: 'info' | 'warning' | 'success'
}

export type ScreenProps = {
  onNavigate: (route: MobileRoute) => void
  onBack?: () => void
  profileType: ProfileType
  selectedChampionship?: ChampionshipCard | null
  selectedAdminChampionshipId?: string | null
  selectedLineup?: {
    campeonato_equipe_id?: string
    campeonato_nome?: string
    equipe_nome?: string
    line_nome?: string
    fase_nome?: string
    grupo_nome?: string
    data_jogo?: string | null
    horario?: string | null
    jogadores_confirmados?: number
    limite_jogadores?: number
    vagas_disponiveis?: number
    link_token?: string | null
    link_ativo?: boolean
    link_expira_em?: string | null
    jogadores?: unknown[]
  } | null
  onSelectChampionship?: (championship: ChampionshipCard) => void
  onManageChampionship?: (championshipId?: string | null) => void
  onSelectLineup?: (lineup: ScreenProps['selectedLineup']) => void
  selectedTeamId?: string | null
  selectedLineId?: string | null
  selectedPlayerId?: string | null
  onSelectTeam?: (teamId: string) => void
  onManageTeam?: (teamId: string) => void
  onManageLine?: (teamId: string, lineId: string) => void
  onSelectPlayer?: (playerId: string) => void
  requireAuth?: (action?: () => void) => boolean
}
