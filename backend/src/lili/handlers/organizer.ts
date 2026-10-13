import { listManagedChampionships, managedChampionshipCards, getChampionshipOperationsOverview, championshipOperationsSummaryCard, championshipStructureCards, championshipAuditCards } from '@backend/lili/tools'
import type { LiliAction } from '@backend/lili/types'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleOrganizer(state: LiliChatState): Promise<LiliChatResponse> {
  const { user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'listar_campeonatos_gerenciados': {
      if (!user) {
        response = { reply: 'Entre na sua conta para abrir a central do organizador.', intent: match.intent, requiresAuth: true, context, source: match.source }
        return response
      }
      const championships = await listManagedChampionships(user.id)
      response = {
        reply: championships.length
          ? `Encontrei ${championships.length} campeonato${championships.length === 1 ? '' : 's'} em que você possui acesso operacional. Escolha um para abrir a gestão completa.`
          : 'Não encontrei campeonatos que você administra ou opera nesta conta.',
        intent: match.intent,
        cards: managedChampionshipCards(championships, locale),
        actions: [
          { id: 'organizer-create-championship', label: 'Criar campeonato', href: '/campeonatos', variant: 'primary' },
          { id: 'organizer-back-menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale, currentFlow: 'organizer_center' },
        source: match.source,
      }
      return response
    }

    case 'abrir_central_organizador': {
      if (!user) {
        response = { reply: 'Entre na sua conta para abrir a gestão do campeonato.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!context.selectedChampionshipId) {
        const championships = await listManagedChampionships(user.id)
        response = {
          reply: championships.length ? 'Escolha o campeonato que deseja administrar.' : 'Não encontrei campeonatos com acesso operacional nesta conta.',
          intent: match.intent,
          cards: managedChampionshipCards(championships, locale),
          context: { locale, currentFlow: 'organizer_center' },
          source: 'system',
        }
        return response
      }
      const overview = await getChampionshipOperationsOverview(user.id, String(context.selectedChampionshipId))
      const critical = overview.issues.filter((issue) => issue.level === 'critical').length
      const attention = overview.issues.filter((issue) => issue.level === 'attention').length
      response = {
        reply: critical
          ? `Central do organizador de ${overview.championship.nome}. Encontrei ${critical} problema${critical === 1 ? '' : 's'} crítico${critical === 1 ? '' : 's'} e ${attention} ponto${attention === 1 ? '' : 's'} de atenção.`
          : attention
            ? `Central do organizador de ${overview.championship.nome}. A operação está funcionando, mas existem ${attention} ponto${attention === 1 ? '' : 's'} para revisar.`
            : `Central do organizador de ${overview.championship.nome}. A estrutura operacional básica está organizada.`,
        intent: match.intent,
        cards: [championshipOperationsSummaryCard(overview)],
        actions: [
          { id: `organizer-structure-${overview.championship.id}`, label: 'Fases, grupos e slots', message: `Ver estrutura do campeonato ${overview.championship.nome}`, intent: 'ver_estrutura_operacional_campeonato', variant: 'primary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' } },
          { id: `organizer-operation-${overview.championship.id}`, label: 'Jogos e inscrições', message: `Ver operação do campeonato ${overview.championship.nome}`, intent: 'ver_operacao_campeonato', variant: 'primary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' } },
          { id: `organizer-audit-${overview.championship.id}`, label: 'Auditar campeonato', message: `Auditar campeonato ${overview.championship.nome}`, intent: 'auditar_campeonato', variant: critical || attention ? 'primary' : 'secondary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' } },
          { id: `organizer-rulebook-${overview.championship.id}`, label: 'Regulamento', href: `/campeonatos/${overview.championship.id}/regulamento`, variant: 'secondary' },
          { id: `organizer-competitive-${overview.championship.id}`, label: 'Pontuação e resultados', message: `Abrir central competitiva do campeonato ${overview.championship.nome}`, intent: 'abrir_central_competitiva', variant: 'primary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'competitive_center' } },
          { id: `organizer-open-page-${overview.championship.id}`, label: 'Abrir painel completo', href: `/campeonatos/${overview.championship.id}`, variant: 'secondary' },
          { id: 'organizer-back-list', label: 'Outros campeonatos', message: 'Mostrar campeonatos que administro', intent: 'listar_campeonatos_gerenciados', variant: 'secondary', context: { locale } },
        ],
        context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' },
        source: 'system',
      }
      return response
    }

    case 'ver_estrutura_operacional_campeonato':

    case 'ver_operacao_campeonato':

    case 'auditar_campeonato': {
      if (!user || !context.selectedChampionshipId) throw new Error('Campeonato não informado.')
      const overview = await getChampionshipOperationsOverview(user.id, String(context.selectedChampionshipId))
      const backAction: LiliAction = {
        id: `organizer-back-${overview.championship.id}`,
        label: 'Voltar à central',
        message: `Abrir central do organizador do campeonato ${overview.championship.nome}`,
        intent: 'abrir_central_organizador',
        variant: 'secondary',
        context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' },
      }
      if (match.intent === 'ver_estrutura_operacional_campeonato') {
        response = {
          reply: overview.phases.length
            ? `Estrutura de ${overview.championship.nome}: ${overview.phases.length} fase(s), ${overview.groups.length} grupo(s) e ${overview.slots.length} slot(s).`
            : `${overview.championship.nome} ainda não possui fases configuradas.`,
          intent: match.intent,
          cards: overview.phases.length ? championshipStructureCards(overview) : [championshipAuditCards(overview).find((card) => card.title.includes('fase')) || championshipOperationsSummaryCard(overview)],
          actions: [
            { id: `structure-panel-${overview.championship.id}`, label: 'Organizar estrutura', href: `/campeonatos/${overview.championship.id}`, variant: 'primary' },
            { id: `structure-audit-${overview.championship.id}`, label: 'Auditar campeonato', message: `Auditar campeonato ${overview.championship.nome}`, intent: 'auditar_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' } },
            backAction,
          ],
          context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' },
          source: 'system',
        }
      } else if (match.intent === 'ver_operacao_campeonato') {
        const occupied = overview.slots.filter((slot: any) => slot.equipe_id || slot.line_id).length
        const activeTeams = overview.teams.filter((team: any) => String(team.status || 'ativo') === 'ativo').length
        const scheduledGames = overview.games.filter((game: any) => game.data || game.data_jogo || game.inicio_em).length
        response = {
          reply: `Operação de ${overview.championship.nome}: ${activeTeams} equipe(s) ativa(s), ${occupied}/${overview.slots.length} slots ocupados e ${scheduledGames}/${overview.games.length} jogos com data.`,
          intent: match.intent,
          cards: [{
            ...championshipOperationsSummaryCard(overview),
            id: `organizer-operation-${overview.championship.id}`,
            subtitle: 'Resumo de jogos, inscrições e publicação',
            details: [
              { label: 'Equipes ativas', value: String(activeTeams) },
              { label: 'Slots ocupados', value: `${occupied}/${overview.slots.length}` },
              { label: 'Jogos cadastrados', value: String(overview.games.length) },
              { label: 'Jogos com data', value: String(scheduledGames) },
              { label: 'Rodadas', value: String(overview.rounds.length) },
              { label: 'Inscrições', value: overview.config?.aceita_novas_inscricoes_equipes ? 'Abertas' : 'Fechadas' },
            ],
          }],
          actions: [
            { id: `operation-games-${overview.championship.id}`, label: 'Gerenciar jogos', href: `/campeonatos/${overview.championship.id}`, variant: 'primary' },
            { id: `operation-score-${overview.championship.id}`, label: 'Abrir pontuador', href: `/campeonatos/${overview.championship.id}`, variant: 'secondary' },
            { id: `operation-audit-${overview.championship.id}`, label: 'Ver pendências', message: `Auditar campeonato ${overview.championship.nome}`, intent: 'auditar_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' } },
            backAction,
          ],
          context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' },
          source: 'system',
        }
      } else {
        const critical = overview.issues.filter((issue) => issue.level === 'critical').length
        const attention = overview.issues.filter((issue) => issue.level === 'attention').length
        response = {
          reply: critical || attention
            ? `Auditoria concluída: ${critical} problema(s) crítico(s), ${attention} ponto(s) de atenção e ${overview.issues.length - critical - attention} informação(ões).`
            : 'Auditoria concluída. Não encontrei pendências operacionais básicas.',
          intent: match.intent,
          cards: championshipAuditCards(overview),
          actions: [
            { id: `audit-refresh-${overview.championship.id}`, label: 'Executar auditoria novamente', message: `Auditar campeonato ${overview.championship.nome}`, intent: 'auditar_campeonato', variant: 'primary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' } },
            { id: `audit-open-${overview.championship.id}`, label: 'Corrigir no painel', href: `/campeonatos/${overview.championship.id}`, variant: 'secondary' },
            backAction,
          ],
          context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'organizer_center' },
          source: 'system',
        }
      }
      return response
    }
  }
  return response
}
