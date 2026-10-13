import type { LiliChatState, LiliIntentHandler } from './chat-state'
import { handleNavigation } from './handlers/navigation'
import { handleAgenda } from './handlers/agenda'
import { handleLineups } from './handlers/lineups'
import { handleAccountServices } from './handlers/account-services'
import { handleCompetitive } from './handlers/competitive'
import { handleChampionships } from './handlers/championships'
import { handleOrganizer } from './handlers/organizer'
import { handleTeams } from './handlers/teams'
import { handleRegistrations } from './handlers/registrations'
import { handleFinancial } from './handlers/financial'
import { handlePurchases } from './handlers/purchases'
import { handleAccountSummary } from './handlers/account-summary'
import { handleInviteResolution } from './handlers/invite-resolution'
import { handleLineupInvites } from './handlers/lineup-invites'
import { handleGroupInvites } from './handlers/group-invites'
import { handleGroupPayments } from './handlers/group-payments'
import { handlePurchasePayments } from './handlers/purchase-payments'
import { handleRegistrationPayments } from './handlers/registration-payments'
import { handleFlowControl } from './handlers/flow-control'

const handlers: Record<string, LiliIntentHandler> = {
  'ajuda_contextual': handleNavigation,
  'menu': handleNavigation,
  'orientar_cadastro': handleNavigation,
  'explorar_campeonatos': handleNavigation,
  'explorar_equipes': handleNavigation,
  'explorar_jogadores': handleNavigation,
  'explorar_organizacao': handleNavigation,
  'explorar_servicos': handleNavigation,
  'abrir_central_agenda': handleAgenda,
  'escalar_elenco': handleLineups,
  'abrir_escalacoes_equipe': handleLineups,
  'gerar_token_escalacao': handleLineups,
  'listar_notificacoes': handleAccountServices,
  'marcar_notificacoes_lidas': handleAccountServices,
  'abrir_central_carteira': handleAccountServices,
  'listar_movimentacoes_carteira': handleAccountServices,
  'listar_saques_carteira': handleAccountServices,
  'abrir_central_vendedores': handleAccountServices,
  'abrir_central_competitiva': handleCompetitive,
  'listar_jogos_pontuacao': handleCompetitive,
  'auditar_resultados_campeonato': handleCompetitive,
  'listar_campeonatos_abertos': handleChampionships,
  'abrir_campeonato': handleChampionships,
  'ver_regulamento_campeonato': handleChampionships,
  'abrir_topico_regulamento': handleChampionships,
  'perguntar_regra_campeonato': handleChampionships,
  'buscar_campeonato': handleChampionships,
  'listar_campeonatos_gerenciados': handleOrganizer,
  'abrir_central_organizador': handleOrganizer,
  'ver_estrutura_operacional_campeonato': handleOrganizer,
  'ver_operacao_campeonato': handleOrganizer,
  'auditar_campeonato': handleOrganizer,
  'listar_minhas_equipes': handleTeams,
  'abrir_equipe': handleTeams,
  'central_operacional_equipe': handleTeams,
  'ver_elenco_equipe': handleTeams,
  'ver_lines_equipe': handleTeams,
  'ver_staff_equipe': handleTeams,
  'ver_convites_equipe': handleTeams,
  'auditar_equipe': handleTeams,
  'ver_agenda_equipe': handleTeams,
  'ver_campeonatos_equipe': handleTeams,
  'listar_minhas_inscricoes': handleRegistrations,
  'abrir_central_financeira': handleFinancial,
  'listar_revisoes_financeiras': handleFinancial,
  'listar_historico_revisoes_financeiras': handleFinancial,
  'resolver_revisao_financeira': handleFinancial,
  'listar_minhas_vagas_compradas': handlePurchases,
  'cancelar_compra_vaga_pendente': handlePurchases,
  'usar_vaga_comprada': handlePurchases,
  'resumo_minha_conta': handleAccountSummary,
  'listar_proximos_jogos': handleAccountSummary,
  'usar_convite_token': handleInviteResolution,
  'iniciar_inscricao': handleInviteResolution,
  'validar_token_inscricao': handleInviteResolution,
  'continuar_convite_escalacao': handleLineupInvites,
  'confirmar_convite_escalacao': handleLineupInvites,
  'continuar_convite_grupo': handleGroupInvites,
  'selecionar_equipe_convite_grupo': handleGroupInvites,
  'criar_line_convite_grupo': handleGroupInvites,
  'selecionar_line_convite_grupo': handleGroupInvites,
  'selecionar_slot_convite_grupo': handleGroupInvites,
  'pagar_pix_convite_grupo': handleGroupPayments,
  'pagar_cartao_convite_grupo': handleGroupPayments,
  'verificar_pagamento_convite_grupo': handleGroupPayments,
  'falar_atendente_convite_grupo': handleGroupPayments,
  'falar_atendente_compra': handleGroupPayments,
  'pagar_paypal_convite_grupo': handleGroupPayments,
  'capturar_paypal_convite_grupo': handleGroupPayments,
  'confirmar_convite_grupo': handleGroupPayments,
  'comprar_vaga': handlePurchasePayments,
  'pagar_pix_compra': handlePurchasePayments,
  'pagar_cartao_compra': handlePurchasePayments,
  'pagar_paypal_compra': handlePurchasePayments,
  'capturar_paypal_compra': handlePurchasePayments,
  'selecionar_equipe_compra': handlePurchasePayments,
  'iniciar_pagamento_inscricao': handleRegistrationPayments,
  'verificar_pagamento_inscricao': handleRegistrationPayments,
  'criar_line_inscricao': handleRegistrationPayments,
  'selecionar_line_inscricao': handleRegistrationPayments,
  'selecionar_slot_inscricao': handleRegistrationPayments,
  'confirmar_inscricao': handleRegistrationPayments,
  'simular_pagamento_internacional': handleFlowControl,
  'status_fluxo': handleFlowControl,
  'reiniciar_conversa': handleFlowControl,
  'cancelar_fluxo': handleFlowControl,
  'voltar_etapa': handleFlowControl,
  'alterar_idioma': handleFlowControl,
}

export function dispatchLiliIntent(state: LiliChatState) {
  return (handlers[state.match.intent] || handleFlowControl)(state)
}
