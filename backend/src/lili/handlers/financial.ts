import { listVacancyFinancialReviews, resolveVacancyFinancialReview } from '@backend/billing/vacancy-purchase'
import { financialCenterCards, financialReviewCards, financialReviewHistoryCards, listUserVacancyPurchases } from '@backend/lili/tools'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleFinancial(state: LiliChatState): Promise<LiliChatResponse> {
  const { user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'abrir_central_financeira': {
      if (!user) {
        response = {
          reply: locale === 'en'
            ? 'Sign in to open your financial center.'
            : locale === 'es'
              ? 'Inicia sesión para abrir tu central financiera.'
              : 'Entre na sua conta para abrir sua central financeira.',
          intent: match.intent,
          requiresAuth: true,
          context: { locale, currentFlow: 'financial_center' },
          source: 'system',
        }
        return response
      }

      const [purchases, pendingReviews, reviewHistory] = await Promise.all([
        listUserVacancyPurchases(user.id),
        listVacancyFinancialReviews(user.id, 'pending'),
        listVacancyFinancialReviews(user.id, 'history'),
      ])
      const pendingPayments = purchases.filter((item: any) => item.pendente).length
      const paidToUse = purchases.filter((item: any) => item.liberada).length
      const reviewCount = pendingReviews.length
      const reply = locale === 'en'
        ? `Financial overview: ${pendingPayments} pending payment${pendingPayments === 1 ? '' : 's'}, ${paidToUse} paid spot${paidToUse === 1 ? '' : 's'} ready to use${reviewCount ? `, and ${reviewCount} organizer review${reviewCount === 1 ? '' : 's'}` : ''}.`
        : locale === 'es'
          ? `Resumen financiero: ${pendingPayments} pago${pendingPayments === 1 ? '' : 's'} pendiente${pendingPayments === 1 ? '' : 's'}, ${paidToUse} cupo${paidToUse === 1 ? '' : 's'} pagado${paidToUse === 1 ? '' : 's'} por usar${reviewCount ? ` y ${reviewCount} revisión${reviewCount === 1 ? '' : 'es'} como organizador` : ''}.`
          : `Resumo financeiro: ${pendingPayments} pagamento${pendingPayments === 1 ? '' : 's'} pendente${pendingPayments === 1 ? '' : 's'}, ${paidToUse} vaga${paidToUse === 1 ? '' : 's'} paga${paidToUse === 1 ? '' : 's'} para usar${reviewCount ? ` e ${reviewCount} revisão${reviewCount === 1 ? '' : 'ões'} como organizador` : ''}.`

      response = {
        reply,
        intent: match.intent,
        cards: financialCenterCards({ purchases, pendingReviews, reviewHistory, locale }),
        actions: [
          { id: 'financial-center-refresh', label: locale === 'en' ? 'Refresh' : locale === 'es' ? 'Actualizar' : 'Atualizar central', message: 'Abrir minha central financeira', intent: 'abrir_central_financeira', variant: 'secondary', context: { locale } },
          { id: 'financial-center-account', label: locale === 'en' ? 'Account overview' : locale === 'es' ? 'Resumen de cuenta' : 'Minha central', message: 'Mostrar resumo da minha conta', intent: 'resumo_minha_conta', variant: 'secondary', context: { locale } },
          { id: 'financial-center-menu', label: locale === 'en' ? 'Back to start' : locale === 'es' ? 'Volver al inicio' : 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale, currentFlow: 'financial_center' },
        source: 'system',
      }
      return response
    }

    case 'listar_revisoes_financeiras': {
      if (!user) {
        response = { reply: 'Entre na sua conta para consultar revisões financeiras dos seus campeonatos.', intent: match.intent, requiresAuth: true, context: { locale, currentFlow: 'financial_review' }, source: 'system' }
        return response
      }
      const reviews = await listVacancyFinancialReviews(user.id)
      response = {
        reply: reviews.length
          ? `Encontrei ${reviews.length} revisão${reviews.length === 1 ? '' : 'ões'} financeira${reviews.length === 1 ? '' : 's'} que precisa${reviews.length === 1 ? '' : 'm'} de decisão.`
          : 'Não existem revisões financeiras pendentes nos campeonatos que você administra.',
        intent: match.intent,
        cards: financialReviewCards(reviews, locale),
        actions: [
          { id: 'financial-review-refresh', label: 'Atualizar lista', message: 'Mostrar revisões financeiras pendentes', intent: 'listar_revisoes_financeiras', variant: 'secondary', context: { locale, currentFlow: 'financial_review' } },
          { id: 'financial-review-history', label: 'Ver histórico encerrado', message: 'Mostrar histórico de revisões financeiras', intent: 'listar_historico_revisoes_financeiras', variant: 'secondary', context: { locale, currentFlow: 'financial_review_history' } },
          { id: 'financial-review-menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale, currentFlow: 'financial_review' },
        source: 'system',
      }
      return response
    }

    case 'listar_historico_revisoes_financeiras': {
      if (!user) {
        response = { reply: 'Entre na sua conta para consultar o histórico financeiro dos seus campeonatos.', intent: match.intent, requiresAuth: true, context: { locale, currentFlow: 'financial_review_history' }, source: 'system' }
        return response
      }
      const reviews = await listVacancyFinancialReviews(user.id, 'history')
      response = {
        reply: reviews.length
          ? `Encontrei ${reviews.length} revisão${reviews.length === 1 ? '' : 'ões'} financeira${reviews.length === 1 ? '' : 's'} já encerrada${reviews.length === 1 ? '' : 's'}.`
          : 'Ainda não existem revisões financeiras encerradas nos campeonatos que você administra.',
        intent: match.intent,
        cards: financialReviewHistoryCards(reviews, locale),
        actions: [
          { id: 'financial-history-pending', label: 'Ver pendências atuais', message: 'Mostrar revisões financeiras pendentes', intent: 'listar_revisoes_financeiras', variant: 'primary', context: { locale, currentFlow: 'financial_review' } },
          { id: 'financial-history-refresh', label: 'Atualizar histórico', message: 'Mostrar histórico de revisões financeiras', intent: 'listar_historico_revisoes_financeiras', variant: 'secondary', context: { locale, currentFlow: 'financial_review_history' } },
          { id: 'financial-history-menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale, currentFlow: 'financial_review_history' },
        source: 'system',
      }
      return response
    }

    case 'resolver_revisao_financeira': {
      if (!user) {
        response = { reply: 'Entre na sua conta para decidir esta revisão financeira.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!context.selectedFinancialReviewId || !context.selectedFinancialReviewDecision) {
        throw new Error('Não consegui identificar a revisão financeira ou a decisão escolhida.')
      }
      const result = await resolveVacancyFinancialReview({
        compraId: context.selectedFinancialReviewId,
        authUserId: user.id,
        decision: context.selectedFinancialReviewDecision,
      })
      const decisionMessage = context.selectedFinancialReviewDecision === 'manter_inscricao'
        ? 'Decisão registrada: a inscrição será mantida. O comprador foi notificado.'
        : context.selectedFinancialReviewDecision === 'solicitar_regularizacao'
          ? 'Regularização solicitada. A inscrição continua preservada e o comprador foi notificado.'
          : 'Pendência marcada como regularizada. A revisão financeira foi encerrada.'
      response = {
        reply: result.alreadyResolved ? 'Esta revisão já havia sido encerrada anteriormente.' : decisionMessage,
        intent: match.intent,
        actions: [
          { id: 'financial-review-back', label: 'Ver revisões pendentes', message: 'Mostrar revisões financeiras pendentes', intent: 'listar_revisoes_financeiras', variant: 'primary', context: { locale, currentFlow: 'financial_review' } },
          { id: 'financial-review-home', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale, currentFlow: 'financial_review' },
        source: 'system',
      }
      return response
    }
  }
  return response
}
