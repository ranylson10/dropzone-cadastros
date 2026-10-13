import { NextRequest } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import type { LiliAction, LiliChatResponse, LiliClientContext, LiliIntent, LiliLocale } from '@backend/lili/types'

export async function optionalUser(req: NextRequest) {
  try { return await getBearerUser(req) } catch { return null }
}

export function menuActions(locale: LiliLocale) {
  const labels = locale === 'es'
    ? { open: 'Campeonatos con cupos', lineup: 'Gestionar plantilla', registrations: 'Campeonatos inscritos', agenda: 'Mi agenda', setup: 'Crear perfil o equipo' }
    : locale === 'en'
      ? { open: 'Tournaments with spots', lineup: 'Manage lineup', registrations: 'Registered tournaments', agenda: 'My schedule', setup: 'Create profile or team' }
      : { open: 'Campeonatos com vagas', lineup: 'Escalar elenco', registrations: 'Campeonatos inscritos', agenda: 'Minha agenda', setup: 'Criar perfil ou equipe' }
  return [
    { id: 'menu-open-championships', label: labels.open, message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos' as LiliIntent, variant: 'primary' as const, context: { locale } },
    { id: 'menu-lineup', label: labels.lineup, message: 'Escalar elenco', intent: 'escalar_elenco' as LiliIntent, variant: 'primary' as const, context: { locale } },
    { id: 'menu-registrations', label: labels.registrations, message: 'Mostrar campeonatos inscritos', intent: 'listar_minhas_inscricoes' as LiliIntent, variant: 'primary' as const, context: { locale } },
    { id: 'menu-agenda', label: labels.agenda, message: 'Abrir minha agenda', intent: 'abrir_central_agenda' as LiliIntent, variant: 'primary' as const, context: { locale } },
    { id: 'menu-guided-setup', label: labels.setup, message: 'Me ajuda a cadastrar', intent: 'orientar_cadastro' as LiliIntent, variant: 'secondary' as const, context: { locale } },
  ]
}

export function backToMainMenu(locale: LiliLocale): LiliAction {
  return {
    id: 'back-main-menu',
    label: locale === 'en' ? 'Back to main menu' : locale === 'es' ? 'Volver al menú principal' : 'Voltar ao menu principal',
    message: locale === 'en' ? 'Back to start' : locale === 'es' ? 'Volver al inicio' : 'Voltar ao início',
    intent: 'menu',
    variant: 'secondary',
    context: { locale },
  }
}

export function languageActions() {
  return [
    { id: 'lang-pt', label: 'Português', message: 'Português', intent: 'menu' as LiliIntent, variant: 'secondary' as const, context: { locale: 'pt-BR' as const } },
    { id: 'lang-es', label: 'Español', message: 'Español', intent: 'menu' as LiliIntent, variant: 'secondary' as const, context: { locale: 'es' as const } },
    { id: 'lang-en', label: 'English', message: 'English', intent: 'menu' as LiliIntent, variant: 'secondary' as const, context: { locale: 'en' as const } },
  ]
}

export function contextualHelpResponse(context: LiliClientContext, locale: LiliLocale): LiliChatResponse {
  const type = context.currentEntityType || 'geral'
  const id = context.currentEntityId || null
  const withId = (patch: Partial<LiliClientContext> = {}) => ({ ...context, ...patch, locale })
  const common = [backToMainMenu(locale)]

  if (type === 'campeonato') {
    return {
      reply: locale === 'en' ? 'I recognized that you came from a tournament page. Choose what you need.' : locale === 'es' ? 'Identifiqué que vienes de una página de torneo. Elige lo que necesitas.' : 'Identifiquei que você veio de uma página de campeonato. Escolha o que precisa.',
      intent: 'ajuda_contextual',
      actions: [
        ...(id ? [{ id: 'ctx-open-championship', label: 'Ver detalhes do campeonato', message: 'Abrir campeonato', intent: 'abrir_campeonato' as LiliIntent, variant: 'primary' as const, context: withId({ selectedChampionshipId: id }) }] : []),
        ...(id ? [{ id: 'ctx-rules', label: 'Consultar regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato' as LiliIntent, variant: 'primary' as const, context: withId({ selectedChampionshipId: id }) }] : []),
        ...(id ? [{ id: 'ctx-operations', label: 'Operação do campeonato', message: 'Ver operação do campeonato', intent: 'ver_operacao_campeonato' as LiliIntent, variant: 'secondary' as const, context: withId({ selectedChampionshipId: id }) }] : []),
        ...(id ? [{ id: 'ctx-audit', label: 'Auditar campeonato', message: 'Auditar campeonato', intent: 'auditar_campeonato' as LiliIntent, variant: 'secondary' as const, context: withId({ selectedChampionshipId: id }) }] : []),
        { id: 'ctx-register', label: 'Inscrição e vagas', message: 'Quero fazer uma inscrição', intent: 'iniciar_inscricao', variant: 'secondary', context: withId(id ? { selectedChampionshipId: id } : {}) },
        ...common,
      ], context: withId(), source: 'system',
    }
  }

  if (type === 'equipe') return { reply: 'Você está na área de equipes. Posso mostrar elenco, lines, staff, convites, inscrições e pendências.', intent: 'ajuda_contextual', actions: [
    { id: 'ctx-team-roster', label: 'Ver elenco', message: 'Ver elenco da equipe', intent: 'ver_elenco_equipe', variant: 'primary', context: withId(id ? { selectedTeamId: id } : {}) },
    { id: 'ctx-team-lines', label: 'Ver lines', message: 'Ver lines da equipe', intent: 'ver_lines_equipe', variant: 'primary', context: withId(id ? { selectedTeamId: id } : {}) },
    { id: 'ctx-team-staff', label: 'Managers e staff', message: 'Ver staff da equipe', intent: 'ver_staff_equipe', variant: 'secondary', context: withId(id ? { selectedTeamId: id } : {}) },
    { id: 'ctx-team-audit', label: 'Ver pendências', message: 'Auditar equipe', intent: 'auditar_equipe', variant: 'secondary', context: withId(id ? { selectedTeamId: id } : {}) }, ...common], context: withId(), source: 'system' }

  if (type === 'jogador') return { reply: 'Você está na área de jogadores. Posso ajudar a consultar perfis, elenco e informações pendentes.', intent: 'ajuda_contextual', actions: [
    { id: 'ctx-players-list', label: 'Lista de jogadores', href: '/jogadores', variant: 'primary' },
    { id: 'ctx-player-roster', label: 'Elenco da minha equipe', message: 'Ver elenco da equipe', intent: 'ver_elenco_equipe', variant: 'primary', context: withId() },
    { id: 'ctx-player-pending', label: 'Dados pendentes', message: 'Auditar equipe', intent: 'auditar_equipe', variant: 'secondary', context: withId() }, ...common], context: withId(), source: 'system' }

  if (type === 'carteira') return { reply: 'Você está na carteira. Posso consultar saldo, movimentações, saques e situação financeira.', intent: 'ajuda_contextual', actions: [
    { id: 'ctx-wallet', label: 'Resumo da carteira', message: 'Abrir central da carteira', intent: 'abrir_central_carteira', variant: 'primary', context: withId() },
    { id: 'ctx-wallet-moves', label: 'Movimentações', message: 'Ver movimentações da carteira', intent: 'listar_movimentacoes_carteira', variant: 'primary', context: withId() },
    { id: 'ctx-wallet-withdrawals', label: 'Meus saques', message: 'Ver meus saques', intent: 'listar_saques_carteira', variant: 'secondary', context: withId() }, ...common], context: withId(), source: 'system' }

  if (type === 'agenda') return { reply: 'Você está na agenda. Posso mostrar próximos jogos, compromissos e notificações.', intent: 'ajuda_contextual', actions: [
    { id: 'ctx-agenda', label: 'Agenda e notificações', message: 'Abrir central de agenda', intent: 'abrir_central_agenda', variant: 'primary', context: withId() },
    { id: 'ctx-games', label: 'Próximos jogos', message: 'Mostrar próximos jogos', intent: 'listar_proximos_jogos', variant: 'primary', context: withId() },
    { id: 'ctx-notifications', label: 'Notificações', message: 'Mostrar minhas notificações', intent: 'listar_notificacoes', variant: 'secondary', context: withId() }, ...common], context: withId(), source: 'system' }

  if (type === 'pontuador') return { reply: 'Você está na operação competitiva. Posso ajudar com jogos, pontuação e auditoria de resultados.', intent: 'ajuda_contextual', actions: [
    { id: 'ctx-competitive', label: 'Central competitiva', message: 'Abrir central competitiva', intent: 'abrir_central_competitiva', variant: 'primary', context: withId(id ? { selectedChampionshipId: id } : {}) },
    { id: 'ctx-scoring', label: 'Jogos para pontuar', message: 'Mostrar jogos para pontuar', intent: 'listar_jogos_pontuacao', variant: 'primary', context: withId(id ? { selectedChampionshipId: id } : {}) },
    { id: 'ctx-results-audit', label: 'Auditar resultados', message: 'Auditar resultados', intent: 'auditar_resultados_campeonato', variant: 'secondary', context: withId(id ? { selectedChampionshipId: id } : {}) },
    ...common], context: withId(), source: 'system' }

  return { reply: 'Posso orientar você com base na área do sistema que estava acessando.', intent: 'ajuda_contextual', actions: menuActions(locale), context: withId(), source: 'system' }
}
