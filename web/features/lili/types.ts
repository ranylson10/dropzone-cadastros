export type LiliLocale = 'pt-BR' | 'es' | 'en'
export type LiliCurrency = 'BRL' | 'USD' | 'EUR'

export type LiliIntent =
  | 'menu'
  | 'listar_campeonatos_abertos'
  | 'buscar_campeonato'
  | 'abrir_campeonato'
  | 'ver_regulamento_campeonato'
  | 'abrir_topico_regulamento'
  | 'perguntar_regra_campeonato'
  | 'comprar_vaga'
  | 'selecionar_forma_pagamento_compra'
  | 'pagar_pix_compra'
  | 'pagar_cartao_compra'
  | 'pagar_paypal_compra'
  | 'capturar_paypal_compra'
  | 'selecionar_equipe_compra'
  | 'usar_convite_token'
  | 'validar_token_inscricao'
  | 'continuar_convite_grupo'
  | 'selecionar_equipe_convite_grupo'
  | 'selecionar_line_convite_grupo'
  | 'criar_line_convite_grupo'
  | 'selecionar_slot_convite_grupo'
  | 'confirmar_convite_grupo'
  | 'pagar_pix_convite_grupo'
  | 'pagar_cartao_convite_grupo'
  | 'pagar_paypal_convite_grupo'
  | 'capturar_paypal_convite_grupo'
  | 'falar_atendente_convite_grupo'
  | 'verificar_pagamento_convite_grupo'
  | 'listar_minhas_equipes'
  | 'listar_minhas_inscricoes'
  | 'listar_proximos_jogos'
  | 'resumo_minha_conta'
  | 'iniciar_inscricao'
  | 'iniciar_pagamento_inscricao'
  | 'verificar_pagamento_inscricao'
  | 'listar_minhas_vagas_compradas'
  | 'usar_vaga_comprada'
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
  selectedRulebookTopicId?: string | null
  selectedTeamId?: string | null
  selectedLineId?: string | null
  selectedLineName?: string | null
  selectedSlotId?: string | null
  selectedSlotLabel?: string | null
  purchaseToken?: string | null
  currentFlow?: string | null
  currentStep?: string | null
  awaitingLineName?: boolean
  awaitingGroupLineName?: boolean
  awaitingInviteToken?: boolean
  inviteToken?: string | null
  inviteHref?: string | null
  inviteKind?: string | null
  inviteGroupId?: string | null
  autoOpenInvite?: boolean
  awaitingRuleQuestion?: boolean
  ruleQuestion?: string | null
  selectedPaymentMethod?: 'pix' | 'cartao' | 'paypal' | 'whatsapp' | null
  awaitingPaymentDocument?: boolean
  paymentDocument?: string | null
  reservationId?: string | null
  reservationCode?: string | null
  reservationExpiresAt?: string | null
  paymentId?: string | null
  paypalOrderId?: string | null
  paypalApprovalUrl?: string | null
  purchaseId?: string | null
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
  kind: 'championship' | 'rulebook' | 'team' | 'registration' | 'agenda' | 'summary' | 'payment' | 'line' | 'slot'
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
