export type ProfileType = 'jogador' | 'equipe' | 'produtora' | 'manager' | 'broadcast'

export type MobileActionId =
  | 'browse_vacancies'
  | 'buy_slot'
  | 'my_championships'
  | 'lineup'
  | 'team_roster'
  | 'agenda'
  | 'invites'
  | 'wallet'
  | 'rank'
  | 'lili'
  | 'seller_sales'
  | 'producer_overview'

export type MobileRoute =
  | 'home'
  | 'vacancies'
  | 'purchase_claim'
  | 'my_championships'
  | 'lineup'
  | 'team_roster'
  | 'agenda'
  | 'invites'
  | 'wallet'
  | 'rank'
  | 'lili'
  | 'seller_sales'
  | 'producer_overview'

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
  onSelectChampionship?: (championship: ChampionshipCard) => void
}
