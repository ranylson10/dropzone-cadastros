export type LiliLocale = 'pt-BR' | 'es' | 'en'
export type LiliCurrency = 'BRL' | 'USD' | 'EUR'

export type LiliIntent =
  | 'menu'
  | 'listar_campeonatos_abertos'
  | 'buscar_campeonato'
  | 'abrir_campeonato'
  | 'comprar_vaga'
  | 'validar_token_inscricao'
  | 'listar_minhas_equipes'
  | 'listar_minhas_inscricoes'
  | 'iniciar_inscricao'
  | 'iniciar_pagamento_inscricao'
  | 'verificar_pagamento_inscricao'
  | 'selecionar_line_inscricao'
  | 'criar_line_inscricao'
  | 'selecionar_slot_inscricao'
  | 'confirmar_inscricao'
  | 'alterar_idioma'
  | 'voltar_etapa'
  | 'cancelar_fluxo'
  | 'status_fluxo'
  | 'reiniciar_conversa'
  | 'simular_pagamento_internacional'
  | 'desconhecido'

export type LiliClientContext = {
  locale?: LiliLocale
  currency?: LiliCurrency
  selectedChampionshipId?: string | null
  selectedTeamId?: string | null
  selectedLineId?: string | null
  selectedLineName?: string | null
  selectedSlotId?: string | null
  selectedSlotLabel?: string | null
  purchaseToken?: string | null
  currentFlow?: string | null
  currentStep?: string | null
  awaitingLineName?: boolean
  awaitingInviteToken?: boolean
  inviteToken?: string | null
  inviteHref?: string | null
}

export type LiliAction = {
  id: string
  label: string
  message?: string
  intent?: LiliIntent
  variant?: 'primary' | 'secondary'
  href?: string
  copyText?: string
  context?: LiliClientContext
}

export type LiliCard = {
  id: string
  kind: 'championship' | 'team' | 'registration' | 'summary' | 'payment' | 'line' | 'slot'
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
  locale?: LiliLocale
}
