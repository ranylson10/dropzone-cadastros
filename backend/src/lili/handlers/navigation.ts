import { menuActions, backToMainMenu, contextualHelpResponse } from '../helpers/navigation'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleNavigation(state: LiliChatState): Promise<LiliChatResponse> {
  const { user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'ajuda_contextual':
      response = contextualHelpResponse(context, locale)
      return response

    case 'menu':
      response = {
        reply: user
          ? 'Estou por aqui. Quer encontrar um campeonato, organizar o elenco, acompanhar suas inscrições ou conferir a agenda?'
          : 'Oi! Eu sou a Lili, sua assistente no DropZone. Posso começar mostrando campeonatos com vagas; quando você escolher uma área privada, eu te ajudo a entrar e continuo do mesmo ponto.',
        intent: 'menu', actions: menuActions(locale), context: { locale }, source: match.source,
      }
      return response

    case 'orientar_cadastro': {
      const nextContext = { locale, currentFlow: 'guided_setup' }
      response = {
        reply: user
          ? 'Boa. Você pode criar perfil de jogador ou equipe por aqui. Workspaces de produtora são privados e só são liberados por convite da administração.'
          : 'Boa. Primeiro eu preciso confirmar sua conta; depois te levo direto para o cadastro certo e volto para continuar daqui.',
        intent: match.intent,
        requiresAuth: !user,
        actions: user ? [
          { id: 'setup-player', label: 'Criar perfil de jogador', href: `/?cadastro=jogador&vincular=1&returnTo=${encodeURIComponent('/lili')}`, variant: 'primary', context: nextContext },
          { id: 'setup-team', label: 'Criar perfil de equipe', href: `/?cadastro=equipe&vincular=1&returnTo=${encodeURIComponent('/lili')}`, variant: 'primary', context: nextContext },
          { id: 'setup-use-token', label: 'Tenho um convite/token', message: 'Tenho um token', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ] : [backToMainMenu(locale)],
        context: nextContext,
        source: 'system',
      }
      return response
    }

    case 'explorar_campeonatos': {
      response = {
        reply: locale === 'en'
          ? 'What tournament information do you want to access?'
          : locale === 'es'
            ? '¿Qué información de campeonatos quieres consultar?'
            : 'Quais dados de campeonatos você quer acessar?',
        intent: match.intent,
        actions: [
          { id: 'championships-open', label: locale === 'en' ? 'Open tournaments' : locale === 'es' ? 'Torneos abiertos' : 'Campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'primary', context: { locale } },
          { id: 'championships-all', label: locale === 'en' ? 'All tournaments' : locale === 'es' ? 'Todos los torneos' : 'Todos os campeonatos', href: '/campeonatos', variant: 'secondary' },
          { id: 'championships-registrations', label: locale === 'en' ? 'My registrations' : locale === 'es' ? 'Mis inscripciones' : 'Minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes', variant: 'primary', context: { locale } },
          { id: 'championships-managed', label: locale === 'en' ? 'Tournaments I manage' : locale === 'es' ? 'Torneos que administro' : 'Campeonatos que administro', message: 'Mostrar campeonatos que administro', intent: 'listar_campeonatos_gerenciados', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ],
        context: { locale }, source: match.source,
      }
      return response
    }

    case 'explorar_equipes': {
      response = {
        reply: locale === 'en'
          ? 'What team information do you want to access?'
          : locale === 'es'
            ? '¿Qué información de equipos quieres consultar?'
            : 'Quais dados de equipes você quer acessar?',
        intent: match.intent,
        actions: [
          { id: 'teams-list', label: locale === 'en' ? 'Browse teams' : locale === 'es' ? 'Ver equipos' : 'Lista de equipes', href: '/equipes', variant: 'primary' },
          { id: 'teams-mine', label: locale === 'en' ? 'My teams' : locale === 'es' ? 'Mis equipos' : 'Minhas equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes', variant: 'primary', context: { locale } },
          { id: 'teams-management', label: locale === 'en' ? 'Manage my team' : locale === 'es' ? 'Gestionar mi equipo' : 'Gerenciar minha equipe', message: 'Gerenciar minha equipe', intent: 'central_operacional_equipe', variant: 'secondary', context: { locale } },
          { id: 'teams-audit', label: locale === 'en' ? 'Check team issues' : locale === 'es' ? 'Revisar problemas del equipo' : 'Ver pendências da equipe', message: 'Auditar equipe', intent: 'auditar_equipe', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ], context: { locale }, source: match.source,
      }
      return response
    }

    case 'explorar_jogadores': {
      response = {
        reply: locale === 'en'
          ? 'What player information do you want to access?'
          : locale === 'es'
            ? '¿Qué información de jugadores quieres consultar?'
            : 'Quais dados de jogadores você quer acessar?',
        intent: match.intent,
        actions: [
          { id: 'players-list', label: locale === 'en' ? 'Browse players' : locale === 'es' ? 'Ver jugadores' : 'Lista de jogadores', href: '/jogadores', variant: 'primary' },
          { id: 'players-roster', label: locale === 'en' ? 'Team roster' : locale === 'es' ? 'Plantilla del equipo' : 'Elenco da minha equipe', message: 'Ver elenco da equipe', intent: 'ver_elenco_equipe', variant: 'primary', context: { locale } },
          { id: 'players-pending', label: locale === 'en' ? 'Missing player data' : locale === 'es' ? 'Datos pendientes de jugadores' : 'Dados pendentes dos jogadores', message: 'Auditar equipe', intent: 'auditar_equipe', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ], context: { locale }, source: match.source,
      }
      return response
    }

    case 'explorar_organizacao': {
      response = {
        reply: locale === 'en' ? 'Choose the private area of your organization.' : locale === 'es' ? 'Elige el área privada de tu organización.' : 'Escolha a área privada da sua organização.',
        intent: match.intent,
        actions: [
          { id: 'org-account', label: locale === 'en' ? 'My account overview' : locale === 'es' ? 'Resumen de mi cuenta' : 'Resumo da minha conta', message: 'Mostrar resumo da minha conta', intent: 'resumo_minha_conta', variant: 'primary', context: { locale } },
          { id: 'org-team', label: locale === 'en' ? 'Team management' : locale === 'es' ? 'Gestión del equipo' : 'Gestão da equipe', message: 'Gerenciar minha equipe', intent: 'central_operacional_equipe', variant: 'primary', context: { locale } },
          { id: 'org-tournaments', label: locale === 'en' ? 'Tournament management' : locale === 'es' ? 'Gestión de torneos' : 'Gestão de campeonatos', message: 'Mostrar campeonatos que administro', intent: 'listar_campeonatos_gerenciados', variant: 'primary', context: { locale } },
          { id: 'org-managers', label: locale === 'en' ? 'Managers and staff' : locale === 'es' ? 'Managers y staff' : 'Managers e staff', href: '/managers', variant: 'secondary' },
          { id: 'org-producers', label: locale === 'en' ? 'Producer profile' : locale === 'es' ? 'Perfil de productora' : 'Perfil da produtora', href: '/produtoras', variant: 'secondary' },
          backToMainMenu(locale),
        ], context: { locale }, source: match.source,
      }
      return response
    }

    case 'explorar_servicos': {
      response = {
        reply: locale === 'en' ? 'Choose the service you want to access.' : locale === 'es' ? 'Elige el servicio que quieres acceder.' : 'Escolha o serviço que deseja acessar.',
        intent: match.intent,
        actions: [
          { id: 'services-schedule', label: locale === 'en' ? 'Schedule and notifications' : locale === 'es' ? 'Agenda y notificaciones' : 'Agenda e notificações', message: 'Abrir central de agenda', intent: 'abrir_central_agenda', variant: 'primary', context: { locale } },
          { id: 'services-financial', label: locale === 'en' ? 'Financial center' : locale === 'es' ? 'Central financiera' : 'Central financeira', message: 'Abrir minha central financeira', intent: 'abrir_central_financeira', variant: 'primary', context: { locale } },
          { id: 'services-registration', label: locale === 'en' ? 'Registration and spots' : locale === 'es' ? 'Inscripción y cupos' : 'Inscrição e vagas', message: 'Quero fazer uma inscrição', intent: 'iniciar_inscricao', variant: 'secondary', context: { locale } },
          { id: 'services-invite', label: locale === 'en' ? 'Invite or token' : locale === 'es' ? 'Invitación o token' : 'Convite ou token', message: 'Tenho um convite ou token', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
          { id: 'services-wallet', label: locale === 'en' ? 'Wallet and withdrawals' : locale === 'es' ? 'Cartera y retiros' : 'Carteira e saques', message: 'Abrir central da carteira', intent: 'abrir_central_carteira', variant: 'secondary', context: { locale } },
          { id: 'services-sellers', label: locale === 'en' ? 'Sales and sellers' : locale === 'es' ? 'Ventas y vendedores' : 'Vendas e vendedores', message: 'Abrir central de vendedores', intent: 'abrir_central_vendedores', variant: 'secondary', context: { locale } },
          { id: 'services-competitive', label: locale === 'en' ? 'Scoring and results' : locale === 'es' ? 'Puntuación y resultados' : 'Pontuação e resultados', message: 'Abrir central competitiva', intent: 'abrir_central_competitiva', variant: 'secondary', context: { locale } },
          backToMainMenu(locale),
        ], context: { locale }, source: match.source,
      }
      return response
    }
  }
  return response
}
