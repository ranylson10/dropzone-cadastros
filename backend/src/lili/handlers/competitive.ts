import { listManagedChampionships, managedChampionshipCards, getCompetitiveOperationsOverview, competitiveSummaryCard, scoringGameCards, competitiveAuditCards } from '@backend/lili/tools'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleCompetitive(state: LiliChatState): Promise<LiliChatResponse> {
  const { user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'abrir_central_competitiva': {
      if (!user) { response = { reply: 'Entre na sua conta para acessar pontuação e resultados.', intent: match.intent, requiresAuth: true, context: { locale }, source: 'system' }; return response }
      let championshipId = context.selectedChampionshipId ? String(context.selectedChampionshipId) : ''
      if (!championshipId) {
        const managed = await listManagedChampionships(user.id)
        if (!managed.length) {
          response = { reply: 'Não encontrei campeonatos com acesso operacional na sua conta.', intent: match.intent, actions: [{ id: 'competitive-back', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } }], context: { locale }, source: 'system' }
          return response
        }
        response = {
          reply: 'Escolha o campeonato para consultar pontuação e resultados.',
          intent: match.intent,
          cards: managedChampionshipCards(managed, locale),
          actions: [{ id: 'competitive-back-menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } }],
          context: { locale, currentFlow: 'competitive_center' }, source: 'system',
        }
        return response
      }
      const overview = await getCompetitiveOperationsOverview(user.id, championshipId)
      const critical = overview.issues.filter((issue) => issue.level === 'critical').length
      const attention = overview.issues.filter((issue) => issue.level === 'attention').length
      response = {
        reply: critical || attention
          ? `Central competitiva de ${overview.championship.nome}: encontrei ${critical} problema(s) crítico(s) e ${attention} ponto(s) de atenção.`
          : `Central competitiva de ${overview.championship.nome} pronta. Pontuação e resultados estão organizados.`,
        intent: match.intent,
        cards: [competitiveSummaryCard(overview, locale)],
        actions: [
          { id: `competitive-games-${championshipId}`, label: 'Jogos e pontuador', message: `Mostrar jogos para pontuar de ${overview.championship.nome}`, intent: 'listar_jogos_pontuacao', variant: 'primary', context: { locale, selectedChampionshipId: championshipId, currentFlow: 'competitive_center' } },
          { id: `competitive-audit-${championshipId}`, label: 'Auditar resultados', message: `Auditar resultados do campeonato ${overview.championship.nome}`, intent: 'auditar_resultados_campeonato', variant: critical ? 'primary' : 'secondary', context: { locale, selectedChampionshipId: championshipId, currentFlow: 'competitive_center' } },
          { id: `competitive-championship-${championshipId}`, label: 'Abrir campeonato', href: `/campeonatos/${championshipId}`, variant: 'secondary' },
          { id: 'competitive-other', label: 'Escolher outro campeonato', message: 'Mostrar campeonatos que administro', intent: 'listar_campeonatos_gerenciados', variant: 'secondary', context: { locale } },
        ],
        context: { locale, selectedChampionshipId: championshipId, currentFlow: 'competitive_center' }, source: 'system',
      }
      return response
    }

    case 'listar_jogos_pontuacao': {
      if (!user || !context.selectedChampionshipId) throw new Error('Campeonato não informado.')
      const overview = await getCompetitiveOperationsOverview(user.id, String(context.selectedChampionshipId))
      response = {
        reply: overview.games.length ? `Encontrei ${overview.games.length} jogo(s) em ${overview.championship.nome}. Abra o pontuador do jogo desejado.` : `${overview.championship.nome} ainda não possui jogos cadastrados.`,
        intent: match.intent,
        cards: overview.games.length ? scoringGameCards(overview, locale) : [competitiveSummaryCard(overview, locale)],
        actions: [
          { id: `games-audit-${overview.championship.id}`, label: 'Auditar resultados', message: `Auditar resultados do campeonato ${overview.championship.nome}`, intent: 'auditar_resultados_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'competitive_center' } },
          { id: `games-back-${overview.championship.id}`, label: 'Voltar à central competitiva', message: `Abrir central competitiva do campeonato ${overview.championship.nome}`, intent: 'abrir_central_competitiva', variant: 'secondary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'competitive_center' } },
        ],
        context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'competitive_center' }, source: 'system',
      }
      return response
    }

    case 'auditar_resultados_campeonato': {
      if (!user || !context.selectedChampionshipId) throw new Error('Campeonato não informado.')
      const overview = await getCompetitiveOperationsOverview(user.id, String(context.selectedChampionshipId))
      const critical = overview.issues.filter((issue) => issue.level === 'critical').length
      const attention = overview.issues.filter((issue) => issue.level === 'attention').length
      response = {
        reply: critical || attention ? `Auditoria competitiva concluída: ${critical} problema(s) crítico(s) e ${attention} ponto(s) de atenção.` : 'Auditoria competitiva concluída sem pendências básicas.',
        intent: match.intent,
        cards: competitiveAuditCards(overview),
        actions: [
          { id: `audit-games-${overview.championship.id}`, label: 'Abrir jogos e pontuador', message: `Mostrar jogos para pontuar de ${overview.championship.nome}`, intent: 'listar_jogos_pontuacao', variant: 'primary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'competitive_center' } },
          { id: `audit-refresh-${overview.championship.id}`, label: 'Auditar novamente', message: `Auditar resultados do campeonato ${overview.championship.nome}`, intent: 'auditar_resultados_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'competitive_center' } },
          { id: `audit-back-competitive-${overview.championship.id}`, label: 'Voltar à central competitiva', message: `Abrir central competitiva do campeonato ${overview.championship.nome}`, intent: 'abrir_central_competitiva', variant: 'secondary', context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'competitive_center' } },
        ],
        context: { locale, selectedChampionshipId: overview.championship.id, currentFlow: 'competitive_center' }, source: 'system',
      }
      return response
    }
  }
  return response
}
