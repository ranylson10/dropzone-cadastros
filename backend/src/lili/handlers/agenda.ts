import { getActiveAccount } from '@backend/auth/server-auth'
import { listAgenda } from '@backend/agenda/agenda.service'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { agendaCards, getLiliNotifications, notificationCards } from '@backend/lili/tools'
import { backToMainMenu } from '../helpers/navigation'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleAgenda(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'abrir_central_agenda': {
      if (!user) {
        response = { reply: locale === 'en' ? 'Sign in to view your schedule and notifications.' : locale === 'es' ? 'Inicia sesión para ver tu agenda y notificaciones.' : 'Entre na sua conta para consultar sua agenda e notificações.', intent: match.intent, requiresAuth: true, context: { locale, currentFlow: 'agenda' }, source: 'system' }
        return response
      }
      const today = new Date()
      const end = new Date(today); end.setDate(end.getDate() + 90)
      const iso = (d: Date) => d.toISOString().slice(0, 10)
      const activeAccount = await getActiveAccount(req, user)
      const activeType = String(activeAccount.profile_type || '')
      const activeName = String(activeAccount.name || activeAccount.username || '')
      const agendaRequest = activeType === 'equipe'
        ? { scope: 'equipe' as const, scopeId: String(activeAccount.id), from: iso(today), to: iso(end), authUserId: user.id }
        : { scope: 'me' as const, from: iso(today), to: iso(end), authUserId: user.id }
      const [agenda, notifications] = await Promise.all([
        listAgenda(agendaRequest),
        getLiliNotifications(user.id, 10),
      ])
      let matches = (agenda.items || []).filter((item: any) => item.source === 'jogo')
      if (activeType === 'jogador') {
        const { data: playerEntries } = await supabaseAdmin
          .from('campeonato_jogadores')
          .select('campeonato_id')
          .eq('jogador_id', activeAccount.id)
          .eq('status', 'ativo')
        const playerChampionships = new Set((playerEntries || []).map((item: any) => String(item.campeonato_id)))
        matches = matches.filter((item: any) => playerChampionships.has(String(item.meta?.campeonato_id || '')))
      }
      const agendaOwner = activeType === 'equipe'
        ? `da equipe ${activeName}`
        : activeType === 'jogador'
          ? `do jogador ${activeName}`
          : activeType === 'produtora'
            ? `da produtora ${activeName}`
            : activeType === 'manager'
              ? `do manager ${activeName}`
              : `do perfil ${activeName}`
      response = {
        reply: locale === 'en' ? `You have ${matches.length} upcoming match(es) and ${notifications.unread} unread notification(s).` : locale === 'es' ? `Tienes ${matches.length} próximo(s) partido(s) y ${notifications.unread} notificación(es) sin leer.` : `Esta é a agenda ${agendaOwner}: ${matches.length} próximo${matches.length === 1 ? '' : 's'} jogo${matches.length === 1 ? '' : 's'} e ${notifications.unread} notificação${notifications.unread === 1 ? '' : 'ões'} não lida${notifications.unread === 1 ? '' : 's'}.`,
        intent: match.intent,
        cards: [
          { id: 'agenda-summary', kind: 'summary', title: locale === 'en' ? 'Schedule and notifications' : locale === 'es' ? 'Agenda y notificaciones' : 'Agenda e notificações', details: [
            { label: locale === 'en' ? 'Upcoming matches' : locale === 'es' ? 'Próximos partidos' : 'Próximos jogos', value: String(matches.length) },
            { label: locale === 'en' ? 'Unread notifications' : locale === 'es' ? 'Notificaciones sin leer' : 'Notificações não lidas', value: String(notifications.unread) },
            { label: locale === 'en' ? 'Period checked' : locale === 'es' ? 'Período consultado' : 'Período consultado', value: locale === 'en' ? 'Next 90 days' : locale === 'es' ? 'Próximos 90 días' : 'Próximos 90 dias' },
          ] },
          ...agendaCards(matches.slice(0, 3), locale),
          ...notificationCards(notifications.items.slice(0, 3), locale),
        ],
        actions: [
          { id: 'agenda-all-games', label: locale === 'en' ? 'All upcoming matches' : locale === 'es' ? 'Todos los próximos partidos' : 'Todos os próximos jogos', message: 'Mostrar meus próximos jogos', intent: 'listar_proximos_jogos', variant: 'primary', context: { locale } },
          { id: 'agenda-notifications', label: locale === 'en' ? 'All notifications' : locale === 'es' ? 'Todas las notificaciones' : 'Todas as notificações', message: 'Mostrar minhas notificações', intent: 'listar_notificacoes', variant: 'secondary', context: { locale } },
          ...(notifications.unread ? [{ id: 'agenda-read-all', label: locale === 'en' ? 'Mark all as read' : locale === 'es' ? 'Marcar todas como leídas' : 'Marcar todas como lidas', message: 'Marcar todas notificações como lidas', intent: 'marcar_notificacoes_lidas' as const, variant: 'secondary' as const, context: { locale } }] : []),
          { id: 'agenda-open-page', label: locale === 'en' ? 'Open full schedule' : locale === 'es' ? 'Abrir agenda completa' : 'Abrir agenda completa', href: activeType === 'equipe' ? `/agenda?scope=equipe&scopeId=${activeAccount.id}` : '/agenda', variant: 'secondary' },
          { id: 'agenda-registrations', label: locale === 'en' ? 'Registered tournaments' : locale === 'es' ? 'Campeonatos inscritos' : 'Campeonatos inscritos', message: 'Mostrar campeonatos inscritos', intent: 'listar_minhas_inscricoes', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ], context: { locale, currentFlow: 'agenda', currentEntityType: activeType === 'equipe' || activeType === 'jogador' || activeType === 'manager' || activeType === 'produtora' ? activeType : 'geral', currentEntityId: String(activeAccount.id) }, source: match.source,
      }
      return response
    }
  }
  return response
}
