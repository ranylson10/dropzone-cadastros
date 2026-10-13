import { getLiliNotifications, markAllLiliNotificationsRead, notificationCards, getLiliWalletOverview, walletSummaryCard, walletMovementCards, withdrawalCards, getLiliSellerOverview, sellerOverviewCards } from '@backend/lili/tools'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleAccountServices(state: LiliChatState): Promise<LiliChatResponse> {
  const { user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'listar_notificacoes': {
      if (!user) { response = { reply: 'Entre na sua conta para consultar suas notificações.', intent: match.intent, requiresAuth: true, context: { locale }, source: 'system' }; return response }
      const notifications = await getLiliNotifications(user.id, 30)
      response = {
        reply: notifications.items.length ? `Encontrei ${notifications.items.length} notificação${notifications.items.length === 1 ? '' : 'ões'}. ${notifications.unread} ainda não lida${notifications.unread === 1 ? '' : 's'}.` : 'Você não possui notificações no momento.',
        intent: match.intent, cards: notificationCards(notifications.items, locale),
        actions: [
          ...(notifications.unread ? [{ id: 'notifications-read-all', label: 'Marcar todas como lidas', message: 'Marcar todas notificações como lidas', intent: 'marcar_notificacoes_lidas' as const, variant: 'primary' as const, context: { locale } }] : []),
          { id: 'notifications-agenda', label: 'Voltar para agenda', message: 'Abrir central de agenda', intent: 'abrir_central_agenda', variant: 'secondary', context: { locale } },
        ], context: { locale }, source: match.source,
      }
      return response
    }

    case 'marcar_notificacoes_lidas': {
      if (!user) { response = { reply: 'Entre na sua conta para atualizar suas notificações.', intent: match.intent, requiresAuth: true, context: { locale }, source: 'system' }; return response }
      await markAllLiliNotificationsRead(user.id)
      response = { reply: 'Todas as suas notificações foram marcadas como lidas.', intent: match.intent, actions: [{ id: 'notifications-refresh', label: 'Ver notificações', message: 'Mostrar minhas notificações', intent: 'listar_notificacoes', variant: 'primary', context: { locale } }], context: { locale }, source: 'system' }
      return response
    }

    case 'abrir_central_carteira': {
      if (!user) { response = { reply: 'Entre na sua conta para abrir sua carteira.', intent: match.intent, requiresAuth: true, context: { locale }, source: 'system' }; return response }
      const wallet = await getLiliWalletOverview(user)
      response = {
        reply: wallet.wallet ? 'Aqui está o resumo atualizado da sua carteira.' : 'Sua carteira ainda não foi criada ou configurada.',
        intent: match.intent, cards: wallet.wallet ? [walletSummaryCard(wallet, locale)] : undefined,
        actions: [
          ...(wallet.wallet ? [
            { id: 'wallet-movements', label: 'Ver movimentações', message: 'Mostrar movimentações da carteira', intent: 'listar_movimentacoes_carteira' as const, variant: 'primary' as const, context: { locale } },
            { id: 'wallet-withdrawals', label: 'Acompanhar saques', message: 'Mostrar meus saques', intent: 'listar_saques_carteira' as const, variant: 'secondary' as const, context: { locale } },
          ] : []),
          { id: 'wallet-page', label: wallet.wallet ? 'Solicitar saque ou cadastrar PIX' : 'Configurar carteira', href: '/carteira', variant: 'secondary' },
        ], context: { locale }, source: match.source,
      }
      return response
    }

    case 'listar_movimentacoes_carteira': {
      if (!user) { response = { reply: 'Entre na sua conta para consultar o extrato.', intent: match.intent, requiresAuth: true, context: { locale }, source: 'system' }; return response }
      const wallet = await getLiliWalletOverview(user)
      response = { reply: wallet.movements.length ? `Encontrei ${wallet.movements.length} movimentação${wallet.movements.length === 1 ? '' : 'ões'} recente${wallet.movements.length === 1 ? '' : 's'}.` : 'Sua carteira ainda não possui movimentações.', intent: match.intent, cards: walletMovementCards(wallet.movements, locale), actions: [{ id: 'movements-wallet', label: 'Voltar para carteira', message: 'Abrir central da carteira', intent: 'abrir_central_carteira', variant: 'secondary', context: { locale } }], context: { locale }, source: match.source }
      return response
    }

    case 'listar_saques_carteira': {
      if (!user) { response = { reply: 'Entre na sua conta para acompanhar seus saques.', intent: match.intent, requiresAuth: true, context: { locale }, source: 'system' }; return response }
      const wallet = await getLiliWalletOverview(user)
      response = { reply: wallet.withdrawals.length ? `Encontrei ${wallet.withdrawals.length} solicitação${wallet.withdrawals.length === 1 ? '' : 'ões'} de saque.` : 'Você ainda não solicitou saques.', intent: match.intent, cards: withdrawalCards(wallet.withdrawals, locale), actions: [{ id: 'withdrawals-new', label: 'Solicitar novo saque', href: '/carteira', variant: 'primary' }, { id: 'withdrawals-wallet', label: 'Voltar para carteira', message: 'Abrir central da carteira', intent: 'abrir_central_carteira', variant: 'secondary', context: { locale } }], context: { locale }, source: match.source }
      return response
    }

    case 'abrir_central_vendedores': {
      if (!user) { response = { reply: 'Entre na sua conta para acessar vendas e vendedores.', intent: match.intent, requiresAuth: true, context: { locale }, source: 'system' }; return response }
      const seller = await getLiliSellerOverview(user)
      const cards = sellerOverviewCards(seller, locale)
      response = {
        reply: cards.length ? 'Reuni seus dados de vendas e da equipe comercial.' : 'Sua conta ainda não possui perfil de vendedor nem produtora com vendedores cadastrados.',
        intent: match.intent, cards,
        actions: [
          ...(seller.manager ? [{ id: 'seller-my-page', label: 'Abrir minhas vagas', href: `/vendedores/${seller.manager.id}`, variant: 'primary' as const }] : []),
          ...(seller.producer ? [{ id: 'seller-producer-page', label: 'Gerenciar equipe comercial', href: '/produtoras', variant: 'primary' as const }] : []),
          { id: 'seller-wallet', label: 'Ver carteira e comissões', message: 'Abrir central da carteira', intent: 'abrir_central_carteira', variant: 'secondary', context: { locale } },
        ], context: { locale }, source: match.source,
      }
      return response
    }
  }
  return response
}
