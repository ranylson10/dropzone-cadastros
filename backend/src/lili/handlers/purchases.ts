import { cancelPendingVacancyPurchase } from '@backend/billing/vacancy-purchase'
import { listUserVacancyPurchases, paymentCard, vacancyPurchaseCards, teamCards } from '@backend/lili/tools'
import { registrationContext, flowControlActions, claimContext } from '../helpers/registration'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handlePurchases(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'listar_minhas_vagas_compradas': {
      if (!user) {
        response = { reply: 'Para consultar suas vagas compradas, preciso confirmar sua identidade.', intent: match.intent, requiresAuth: true, context: { locale, currentFlow: 'vacancy_purchase' }, source: match.source }
        return response
      }
      const purchases = await listUserVacancyPurchases(user.id)
      const releasedCount = purchases.filter((item: any) => item.liberada).length
      const pendingCount = purchases.filter((item: any) => item.pendente).length
      const reviewCount = purchases.filter((item: any) => item.em_revisao_financeira).length
      const consumedCount = purchases.filter((item: any) => item.consumida && !item.em_revisao_financeira).length
      const closedCount = purchases.filter((item: any) => item.encerrada).length
      const summaryParts = [
        releasedCount ? `${releasedCount} vaga${releasedCount === 1 ? '' : 's'} pronta${releasedCount === 1 ? '' : 's'} para usar` : null,
        pendingCount ? `${pendingCount} pagamento${pendingCount === 1 ? '' : 's'} pendente${pendingCount === 1 ? '' : 's'}` : null,
        reviewCount ? `${reviewCount} inscrição${reviewCount === 1 ? '' : 'ões'} em revisão financeira` : null,
        consumedCount ? `${consumedCount} vaga${consumedCount === 1 ? '' : 's'} já utilizada${consumedCount === 1 ? '' : 's'}` : null,
        closedCount ? `${closedCount} compra${closedCount === 1 ? '' : 's'} encerrada${closedCount === 1 ? '' : 's'}` : null,
      ].filter(Boolean)
      response = {
        reply: purchases.length
          ? `Encontrei ${summaryParts.join(', ')}.`
          : 'Você ainda não possui compras de vaga registradas.',
        intent: match.intent,
        cards: vacancyPurchaseCards(purchases, locale),
        actions: [
          { id: 'buy-another-spot', label: 'Comprar outra vaga', message: 'Quero comprar uma vaga', intent: 'comprar_vaga', variant: 'primary', context: { locale } },
          { id: 'back-account-summary', label: 'Minha central', message: 'Mostrar resumo da minha conta', intent: 'resumo_minha_conta', variant: 'secondary', context: { locale } },
        ],
        context: { locale, currentFlow: 'vacancy_purchase' },
        source: 'system',
      }
      return response
    }

    case 'cancelar_compra_vaga_pendente': {
      if (!user) {
        response = { reply: 'Entre na sua conta para cancelar esta compra pendente.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!context.purchaseToken) throw new Error('Não encontrei o código da compra que deve ser cancelada.')
      const result = await cancelPendingVacancyPurchase({ token: context.purchaseToken, authUserId: user.id })
      response = {
        reply: result.alreadyClosed
          ? 'Esta compra já estava encerrada e não prendia mais nenhuma vaga.'
          : 'Compra cancelada. A cobrança foi invalidada e a vaga voltou imediatamente para venda.',
        intent: match.intent,
        actions: [
          { id: 'buy-after-cancel', label: 'Comprar outra vaga', message: 'Quero comprar uma vaga', intent: 'comprar_vaga', variant: 'primary', context: { locale } },
          { id: 'purchases-after-cancel', label: 'Minhas vagas compradas', message: 'Mostrar minhas vagas compradas', intent: 'listar_minhas_vagas_compradas', variant: 'secondary', context: { locale } },
          { id: 'menu-after-cancel', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale },
        source: 'system',
      }
      return response
    }

    case 'usar_vaga_comprada': {
      if (!user) {
        response = { reply: 'Entre na sua conta para usar esta vaga comprada.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!context.purchaseToken) throw new Error('Não encontrei o código desta vaga comprada.')
      const data = await claimContext(req, context)
      if (data.consumido) {
        response = { reply: 'Esta vaga já foi usada e a inscrição correspondente já está concluída.', intent: match.intent, actions: [{ id: 'view-registrations-used-spot', label: 'Ver minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes', variant: 'primary', context: { locale } }], context: { locale }, source: 'system' }
        return response
      }
      if (!data.liberado) {
        response = {
          reply: 'O pagamento desta vaga ainda não foi confirmado.',
          intent: match.intent,
          cards: data.payment ? [paymentCard({ token: data.compra.token, status: data.payment.status, valueCents: data.payment.valor_centavos, invoiceUrl: data.payment.invoice_url, pixPayload: data.payment.pix_payload, pixQrCode: data.payment.pix_qrcode })] : undefined,
          actions: [{ id: 'check-purchased-payment', label: 'Verificar pagamento', message: 'Verificar pagamento', intent: 'verificar_pagamento_inscricao', variant: 'primary', context }],
          context,
          source: 'system',
        }
        return response
      }
      const nextContext = registrationContext(context, { selectedChampionshipId: data.compra.campeonato_id, currentStep: 'team', selectedTeamId: null, selectedLineId: null, selectedLineName: null, selectedSlotId: null, selectedSlotLabel: null })
      response = {
        reply: `Sua vaga em ${data.campeonato?.nome || 'este campeonato'} está paga e liberada. Escolha a equipe que vai utilizá-la.`,
        intent: match.intent,
        cards: teamCards(data.equipes || []).map((card: any) => ({ ...card, actions: [{ id: `paid-spot-team-${card.id}`, label: 'Usar esta equipe', message: `Usar equipe ${card.title}`, intent: 'selecionar_equipe_compra', variant: 'primary', context: { ...nextContext, selectedTeamId: card.id } }] })),
        actions: flowControlActions(nextContext),
        context: nextContext,
        source: 'system',
      }
      return response
    }
  }
  return response
}
