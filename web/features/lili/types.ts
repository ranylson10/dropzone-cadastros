export type LiliIntent =
  | 'menu'
  | 'listar_campeonatos_abertos'
  | 'buscar_campeonato'
  | 'listar_minhas_equipes'
  | 'iniciar_inscricao'
  | 'desconhecido'

export type LiliClientContext = {
  selectedChampionshipId?: string | null
  selectedTeamId?: string | null
  currentFlow?: string | null
}

export type LiliAction = {
  id: string
  label: string
  message?: string
  intent?: LiliIntent
  variant?: 'primary' | 'secondary'
  href?: string
  context?: LiliClientContext
}

export type LiliCard = {
  id: string
  kind: 'championship' | 'team' | 'summary'
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  badges?: string[]
  details?: Array<{ label: string; value: string }>
  actions?: LiliAction[]
}

export type LiliChatResponse = {
  reply: string
  intent: LiliIntent
  requiresAuth?: boolean
  actions?: LiliAction[]
  cards?: LiliCard[]
  context?: LiliClientContext
  source?: 'rule' | 'pattern' | 'gemini' | 'system'
}
