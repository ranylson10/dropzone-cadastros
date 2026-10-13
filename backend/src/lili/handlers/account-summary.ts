import { listAgenda } from '@backend/agenda/agenda.service'
import { agendaCards, listUserRegistrations, listUserVacancyPurchases, listUserTeams } from '@backend/lili/tools'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleAccountSummary(state: LiliChatState): Promise<LiliChatResponse> {
  const { user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'resumo_minha_conta': {
      if (!user) {
        response = {
          reply: locale === 'en'
            ? 'To open your account overview, I need to confirm your identity.'
            : locale === 'es'
              ? 'Para abrir el resumen de tu cuenta, necesito confirmar tu identidad.'
              : 'Para abrir o resumo da sua conta, preciso confirmar sua identidade.',
          intent: match.intent,
          requiresAuth: true,
          context: { locale, currentFlow: 'account_summary' },
          source: match.source,
        }
        return response
      }

      const today = new Date()
      const end = new Date(today)
      end.setDate(end.getDate() + 90)
      const isoDate = (value: Date) => value.toISOString().slice(0, 10)
      const [teams, registrations, agenda, vacancyPurchases] = await Promise.all([
        listUserTeams(user),
        listUserRegistrations(user),
        listAgenda({ scope: 'me', from: isoDate(today), to: isoDate(end), authUserId: user.id }),
        listUserVacancyPurchases(user.id),
      ])
      const championshipIds = new Set(registrations.map((item: any) => String(item.campeonato?.id || item.campeonato_id || '')).filter(Boolean))
      const pendingCount = registrations.filter((item: any) => String(item.status || '').toLowerCase() !== 'ativo').length
      const nextMatch = (agenda.items || []).find((item: any) => item.source === 'jogo')
      const labels = locale === 'en'
        ? { teams: 'Teams managed', championships: 'Tournaments', registrations: 'Registrations', paidSpots: 'Paid spots to use', pendingPayments: 'Pending payments', pending: 'Pending review', next: 'Next match', none: 'No match scheduled', title: 'Your DropZone overview' }
        : locale === 'es'
          ? { teams: 'Equipos administrados', championships: 'Campeonatos', registrations: 'Inscripciones', paidSpots: 'Cupos pagados por usar', pendingPayments: 'Pagos pendientes', pending: 'Pendientes', next: 'Próximo partido', none: 'Ningún partido programado', title: 'Resumen de tu cuenta DropZone' }
          : { teams: 'Equipes administradas', championships: 'Campeonatos', registrations: 'Inscrições', paidSpots: 'Vagas pagas para usar', pendingPayments: 'Pagamentos pendentes', pending: 'Pendências', next: 'Próximo jogo', none: 'Nenhum jogo agendado', title: 'Resumo da sua conta DropZone' }
      const nextMatchValue = nextMatch
        ? [nextMatch.titulo || 'Jogo', nextMatch.data, nextMatch.horario_inicio].filter(Boolean).join(' • ')
        : labels.none
      const paidSpotsCount = vacancyPurchases.filter((item: any) => item.liberada).length
      const pendingPaymentsCount = vacancyPurchases.length - paidSpotsCount

      response = {
        reply: labels.title,
        intent: match.intent,
        cards: [{
          id: 'account-overview',
          kind: 'summary',
          title: labels.title,
          details: [
            { label: labels.teams, value: String(teams.length) },
            { label: labels.championships, value: String(championshipIds.size) },
            { label: labels.registrations, value: String(registrations.length) },
            { label: labels.paidSpots, value: String(paidSpotsCount) },
            { label: labels.pendingPayments, value: String(pendingPaymentsCount) },
            { label: labels.pending, value: String(pendingCount) },
            { label: labels.next, value: nextMatchValue },
          ],
        }],
        actions: [
          { id: 'summary-financial-center', label: locale === 'en' ? 'Financial center' : locale === 'es' ? 'Central financiera' : 'Central financeira', message: 'Abrir minha central financeira', intent: 'abrir_central_financeira', variant: 'primary', context: { locale } },
          ...(vacancyPurchases.length ? [{ id: 'summary-purchased-spots', label: locale === 'en' ? 'My purchased spots' : locale === 'es' ? 'Mis cupos comprados' : 'Minhas vagas compradas', message: 'Mostrar minhas vagas compradas', intent: 'listar_minhas_vagas_compradas' as const, variant: 'secondary' as const, context: { locale } }] : []),
          { id: 'summary-registrations', label: locale === 'en' ? 'My registrations' : locale === 'es' ? 'Mis inscripciones' : 'Minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes', variant: vacancyPurchases.length ? 'secondary' : 'primary', context: { locale } },
          { id: 'summary-games', label: locale === 'en' ? 'Upcoming matches' : locale === 'es' ? 'Próximos partidos' : 'Próximos jogos', message: 'Mostrar meus próximos jogos', intent: 'listar_proximos_jogos', variant: 'secondary', context: { locale } },
          { id: 'summary-teams', label: locale === 'en' ? 'My teams' : locale === 'es' ? 'Mis equipos' : 'Minhas equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes', variant: 'secondary', context: { locale } },
          { id: 'summary-agenda', label: locale === 'en' ? 'Full schedule' : locale === 'es' ? 'Agenda completa' : 'Agenda completa', href: '/agenda', variant: 'secondary' },
        ],
        context: { locale },
        source: match.source,
      }
      return response
    }

    case 'listar_proximos_jogos': {
      if (!user) {
        response = {
          reply: locale === 'en'
            ? 'To show your upcoming matches, I need to confirm your identity.'
            : locale === 'es'
              ? 'Para mostrar tus próximos partidos, necesito confirmar tu identidad.'
              : 'Para mostrar seus próximos jogos, preciso confirmar sua identidade.',
          intent: match.intent,
          requiresAuth: true,
          context: { locale, currentFlow: 'agenda' },
          source: match.source,
        }
        return response
      }

      const today = new Date()
      const end = new Date(today)
      end.setDate(end.getDate() + 90)
      const isoDate = (value: Date) => value.toISOString().slice(0, 10)
      const agenda = await listAgenda({
        scope: 'me',
        from: isoDate(today),
        to: isoDate(end),
        authUserId: user.id,
      })
      const matches = (agenda.items || [])
        .filter((item: any) => item.source === 'jogo')
        .slice(0, 20)

      response = {
        reply: matches.length
          ? locale === 'en'
            ? `I found ${matches.length} upcoming match${matches.length === 1 ? '' : 'es'} in the next 90 days.`
            : locale === 'es'
              ? `Encontré ${matches.length} próximo${matches.length === 1 ? '' : 's'} partido${matches.length === 1 ? '' : 's'} en los próximos 90 días.`
              : `Encontrei ${matches.length} próximo${matches.length === 1 ? '' : 's'} jogo${matches.length === 1 ? '' : 's'} nos próximos 90 dias.`
          : locale === 'en'
            ? 'I did not find scheduled matches for your teams in the next 90 days.'
            : locale === 'es'
              ? 'No encontré partidos programados para tus equipos en los próximos 90 días.'
              : 'Não encontrei jogos agendados para suas equipes nos próximos 90 dias.',
        intent: match.intent,
        cards: agendaCards(matches, locale),
        actions: [
          { id: 'open-full-agenda', label: locale === 'en' ? 'Open full schedule' : locale === 'es' ? 'Abrir agenda completa' : 'Abrir agenda completa', href: '/agenda', variant: 'primary' },
          { id: 'menu-agenda', label: locale === 'en' ? 'Back to start' : locale === 'es' ? 'Volver al inicio' : 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale },
        source: match.source,
      }
      return response
    }
  }
  return response
}
