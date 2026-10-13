import { paypalConfigured } from '@backend/billing/paypal'
import { championshipCards, getChampionshipDetails, getPublishedChampionshipRulebook, findRulebookAnswers, listOpenChampionships, rulebookTopicCards, rulebookTopicDetailCard } from '@backend/lili/tools'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleChampionships(state: LiliChatState): Promise<LiliChatResponse> {
  const { user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'listar_campeonatos_abertos': {
      const items = await listOpenChampionships()
      response = {
        reply: items.length ? `Encontrei ${items.length} campeonato${items.length === 1 ? '' : 's'} com vagas abertas.` : 'Não encontrei campeonatos com vagas abertas neste momento.',
        intent: match.intent,
        cards: championshipCards(items, false, locale),
        actions: [
          { id: 'buy-list', label: 'Comprar uma vaga', message: 'Quero comprar uma vaga', intent: 'comprar_vaga', variant: 'primary', context: { locale } },
          { id: 'register-token', label: 'Já tenho convite ou token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
          { id: 'menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' },
        ],
        context: { locale },
        source: match.source,
      }
      return response
    }

    case 'abrir_campeonato': {
      if (!context.selectedChampionshipId) throw new Error('Campeonato não informado.')
      const item = await getChampionshipDetails(context.selectedChampionshipId)
      const money = (value: number | string | null | undefined) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`
      const formatDate = (value: string) => new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR')
      const paymentMethods = [
        item.valor_inscricao != null && item.pagamento_pix_ativo ? '💠 PIX' : null,
        item.valor_inscricao != null && item.pagamento_cartao_ativo ? `💳 Cartão${Number(item.cartao_max_parcelas || 1) > 1 ? ` até ${item.cartao_max_parcelas}x` : ''}` : null,
        item.valor_inscricao != null && item.pagamento_paypal_ativo && paypalConfigured() ? `🅿️ PayPal (${(Array.isArray(item.paypal_moedas) ? item.paypal_moedas : ['BRL']).join('/')})` : null,
        item.pagamento_whatsapp_ativo && Array.isArray(item.contatos_whatsapp) && item.contatos_whatsapp.length ? '🟢 WhatsApp' : null,
      ].filter(Boolean) as string[]
      const prizeValue = item.premiacao_valor != null
        ? money(item.premiacao_valor)
        : item.premiacao_texto
          ? String(item.premiacao_texto)
          : null
      const details = [
        { label: 'Disponibilidade', value: Number(item.vagas_livres || 0) > 0 ? `${item.vagas_livres} vaga${Number(item.vagas_livres || 0) === 1 ? '' : 's'} disponível${Number(item.vagas_livres || 0) === 1 ? '' : 'eis'} agora` : 'Sem vagas disponíveis no momento' },
        Number(item.vagas_em_compra || 0) > 0 ? { label: 'Em processo de compra', value: `${item.vagas_em_compra} vaga${Number(item.vagas_em_compra) === 1 ? '' : 's'} temporariamente reservada${Number(item.vagas_em_compra) === 1 ? '' : 's'}` } : null,
        item.price_mode === 'free' ? { label: 'Inscrição', value: 'Gratuita' } : item.price_mode === 'consult' ? { label: 'Valor da vaga', value: 'Sob consulta' } : { label: 'Valor da vaga', value: money(item.valor_inscricao) },
        prizeValue ? { label: 'Premiação', value: prizeValue } : null,
        item.jogadores_por_vaga ? { label: 'Jogadores por vaga', value: `${item.jogadores_por_vaga} player${Number(item.jogadores_por_vaga) === 1 ? '' : 's'}` } : null,
        item.vagas_por_equipe ? { label: 'Vagas por equipe', value: `${item.vagas_por_equipe}` } : null,
        { label: 'Live', value: item.tem_live ? '▶️ Sim, com transmissão' : 'Sem live confirmada' },
        { label: 'Troféu', value: item.tem_trofeu ? '🏆 Sim' : '🏆 Não' },
        { label: 'Troca de jogador', value: item.permite_troca_jogadores ? (item.data_limite_trocas ? `✅ Permitida até ${formatDate(item.data_limite_trocas)}` : '✅ Permitida') : '🚫 Não permitida' },
        paymentMethods.length ? { label: 'Pagamento', value: paymentMethods.join(' • ') } : null,
        item.data_limite_inscricao ? { label: 'Inscrições até', value: formatDate(item.data_limite_inscricao) } : null,
        item.plataforma ? { label: 'Plataforma', value: String(item.plataforma) } : null,
        item.servidor ? { label: 'Servidor', value: String(item.servidor) } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>
      const canBuy = Boolean(item.aceita_novas_inscricoes_equipes && item.prazo_aberto && Number(item.vagas_livres || 0) > 0)
      const buyAction = canBuy ? { id: `buy-${item.id}`, label: item.price_mode === 'free' ? 'Fazer inscrição grátis' : item.price_mode === 'consult' ? 'Consultar vaga' : 'Comprar vaga', message: item.price_mode === 'free' ? `Fazer inscrição grátis em ${item.nome}` : item.price_mode === 'consult' ? `Consultar vaga em ${item.nome}` : `Comprar vaga em ${item.nome}`, intent: 'comprar_vaga' as const, variant: 'primary' as const, context: { locale, selectedChampionshipId: item.id, currentFlow: item.price_mode === 'free' ? 'registration' : 'vacancy_purchase' } } : null
      response = {
        reply: `Aqui estão os detalhes de ${item.nome}.`,
        intent: match.intent,
        cards: [{
          id: item.id,
          kind: 'championship',
          title: item.nome,
          subtitle: [item.tipo, item.plataforma, item.servidor].filter(Boolean).join(' • '),
          imageUrl: item.logo_url || item.banner_url || null,
          badges: [`${item.vagas_livres || 0} vaga${Number(item.vagas_livres || 0) === 1 ? '' : 's'} livre${Number(item.vagas_livres || 0) === 1 ? '' : 's'}`],
          details,
          actions: buyAction ? [buyAction] : undefined,
        }],
        actions: [
          ...(buyAction ? [buyAction] : []),
          { id: `rules-${item.id}`, label: 'Ver regras por tópico', message: `Ver regulamento de ${item.nome}`, intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules' } },
          { id: `token-${item.id}`, label: 'Usar convite ou token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
          { id: 'back-open', label: 'Voltar aos campeonatos', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'secondary', context: { locale } },
        ],
        context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship' },
        source: 'system',
      }
      return response
    }

    case 'ver_regulamento_campeonato': {
      if (!context.selectedChampionshipId) {
        const items = await listOpenChampionships()
        response = {
          reply: items.length
            ? 'Escolha o campeonato para consultar as regras organizadas por tópico.'
            : 'Não encontrei campeonatos disponíveis para consultar agora.',
          intent: match.intent,
          cards: championshipCards(items, false, locale),
          actions: [{ id: 'back-rulebook-menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } }],
          context: { locale, currentFlow: 'championship_rules' },
          source: 'system',
        }
        return response
      }

      const [item, rulebook] = await Promise.all([
        getChampionshipDetails(context.selectedChampionshipId),
        getPublishedChampionshipRulebook(context.selectedChampionshipId, user?.id),
      ])
      if (!rulebook) {
        response = {
          reply: `Não encontrei um regulamento disponível para ${item.nome}. Se o regulamento ainda estiver em rascunho, somente administradores do campeonato podem consultá-lo pela Lili.`,
          intent: match.intent,
          actions: [
            { id: `open-public-${item.id}`, label: 'Abrir página do campeonato', href: `/campeonatos/${item.id}`, variant: 'secondary' },
            { id: `back-details-${item.id}`, label: 'Voltar aos detalhes', message: `Abrir campeonato ${item.nome}`, intent: 'abrir_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
          ],
          context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship' },
          source: 'system',
        }
        return response
      }

      const topicCards = rulebookTopicCards(rulebook, item.id)
      response = {
        reply: topicCards.length
          ? rulebook.visibility === 'draft'
            ? `Encontrei o regulamento de ${item.nome}. Ele ainda está em ${rulebook.status === 'em_revisao' ? 'revisão' : 'rascunho'}, então esta consulta está disponível somente para administradores do campeonato.`
            : `Estas são as regras publicadas de ${item.nome}. Escolha um tópico para ver somente as regras que precisa.`
          : `O regulamento de ${item.nome} foi encontrado, mas não possui tópicos visíveis.`,
        intent: match.intent,
        cards: topicCards,
        actions: [
          { id: `ask-rule-${item.id}`, label: 'Perguntar sobre as regras', message: 'Quero perguntar sobre as regras', intent: 'perguntar_regra_campeonato', variant: 'primary', context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules', awaitingRuleQuestion: true } },
          { id: `full-rulebook-${item.id}`, label: 'Abrir regulamento completo', href: `/campeonatos/${item.id}/regulamento`, variant: 'secondary' },
          { id: `back-details-${item.id}`, label: 'Voltar aos detalhes', message: `Abrir campeonato ${item.nome}`, intent: 'abrir_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
        ],
        context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules' },
        source: 'system',
      }
      return response
    }

    case 'abrir_topico_regulamento': {
      if (!context.selectedChampionshipId || !context.selectedRulebookTopicId) {
        response = {
          reply: 'Não consegui identificar o tópico selecionado. Escolha novamente na lista de tópicos.',
          intent: match.intent,
          actions: [{ id: 'back-rulebook-topics', label: 'Ver tópicos', message: 'Ver regulamento', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: context.selectedChampionshipId || null } }],
          context: { locale, selectedChampionshipId: context.selectedChampionshipId || null, currentFlow: 'championship_rules' },
          source: 'system',
        }
        return response
      }

      const [item, rulebook] = await Promise.all([
        getChampionshipDetails(context.selectedChampionshipId),
        getPublishedChampionshipRulebook(context.selectedChampionshipId, user?.id),
      ])
      const card = rulebook ? rulebookTopicDetailCard(rulebook, item.id, context.selectedRulebookTopicId) : null
      if (!rulebook || !card) {
        response = {
          reply: `Não encontrei esse tópico no regulamento de ${item.nome}.`,
          intent: match.intent,
          actions: [{ id: `back-rulebook-topics-${item.id}`, label: 'Voltar aos tópicos', message: `Ver regulamento de ${item.nome}`, intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } }],
          context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules' },
          source: 'system',
        }
        return response
      }

      response = {
        reply: `Estas são as regras do tópico “${card.title}” em ${item.nome}.`,
        intent: match.intent,
        cards: [card],
        actions: [
          { id: `ask-rule-topic-${item.id}`, label: 'Perguntar sobre as regras', message: 'Quero perguntar sobre as regras', intent: 'perguntar_regra_campeonato', variant: 'primary', context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules', awaitingRuleQuestion: true } },
          { id: `back-rulebook-topics-${item.id}`, label: 'Voltar aos tópicos', message: `Ver regulamento de ${item.nome}`, intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
        ],
        context: { locale, selectedChampionshipId: item.id, selectedRulebookTopicId: context.selectedRulebookTopicId, currentFlow: 'championship_rules', currentStep: 'rulebook_topic_open' },
        source: 'system',
      }
      return response
    }

    case 'perguntar_regra_campeonato': {
      if (!context.selectedChampionshipId) {
        const items = await listOpenChampionships()
        response = {
          reply: items.length
            ? 'Escolha primeiro o campeonato sobre o qual deseja perguntar.'
            : 'Não encontrei campeonatos disponíveis para consultar agora.',
          intent: match.intent,
          cards: championshipCards(items, false, locale),
          actions: [{ id: 'back-rule-question-menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } }],
          context: { locale, currentFlow: 'championship_rules' },
          source: 'system',
        }
        return response
      }

      const [item, rulebook] = await Promise.all([
        getChampionshipDetails(context.selectedChampionshipId),
        getPublishedChampionshipRulebook(context.selectedChampionshipId, user?.id),
      ])
      if (!rulebook) {
        response = {
          reply: `Não encontrei um regulamento disponível para consulta em ${item.nome}. Se ele ainda estiver em rascunho, somente administradores do campeonato podem acessá-lo pela Lili.`,
          intent: match.intent,
          actions: [{ id: `back-details-${item.id}`, label: 'Voltar aos detalhes', message: `Abrir campeonato ${item.nome}`, intent: 'abrir_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } }],
          context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship' },
          source: 'system',
        }
        return response
      }

      const question = String(context.ruleQuestion || '').trim()
      if (!question || context.awaitingRuleQuestion) {
        response = {
          reply: `Qual é a sua dúvida sobre as regras de ${item.nome}? Escreva de forma direta, por exemplo: “quantos jogadores podem ser escalados?” ou “qual é a pontuação por posição?”.`,
          intent: match.intent,
          actions: [
            { id: `show-rules-${item.id}`, label: 'Ver todos os tópicos', message: `Ver regulamento de ${item.nome}`, intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
            { id: `back-details-${item.id}`, label: 'Voltar aos detalhes', message: `Abrir campeonato ${item.nome}`, intent: 'abrir_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
          ],
          context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules', currentStep: 'ask_rule', awaitingRuleQuestion: true, ruleQuestion: null },
          source: 'system',
        }
        return response
      }

      const cards = findRulebookAnswers(rulebook, question, item.id)
      response = {
        reply: cards.length
          ? `Encontrei estas regras publicadas de ${item.nome} relacionadas à sua pergunta. A Lili não inventa uma interpretação: confira o texto oficial abaixo.`
          : `Não encontrei um artigo claramente relacionado a “${question}” no regulamento publicado de ${item.nome}. Tente usar palavras mais específicas ou consulte os tópicos completos.`,
        intent: match.intent,
        cards,
        actions: [
          { id: `ask-another-rule-${item.id}`, label: 'Fazer outra pergunta', message: 'Quero perguntar sobre as regras', intent: 'perguntar_regra_campeonato', variant: 'primary', context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules', awaitingRuleQuestion: true, ruleQuestion: null } },
          { id: `show-all-rules-${item.id}`, label: 'Ver todos os tópicos', message: `Ver regulamento de ${item.nome}`, intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
          { id: `full-rulebook-answer-${item.id}`, label: 'Abrir regulamento completo', href: `/campeonatos/${item.id}/regulamento`, variant: 'secondary' },
        ],
        context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules', currentStep: 'rule_answer', awaitingRuleQuestion: false, ruleQuestion: null },
        source: 'system',
      }
      return response
    }

    case 'buscar_campeonato': {
      const term = match.searchTerm || message
      let items = await listOpenChampionships(term)
      if (!items.length && term) {
        const words = term.split(/\s+/).filter((word) => word.length >= 3)
        for (const word of words) {
          items = await listOpenChampionships(word)
          if (items.length) break
        }
      }
      response = {
        reply: items.length ? `Encontrei estes campeonatos parecidos com “${term}”.` : `Não encontrei campeonato com o nome “${term}”. Posso mostrar os campeonatos com vagas abertas.`,
        intent: match.intent,
        cards: championshipCards(items, false, locale),
        actions: items.length
          ? [{ id: 'menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }]
          : [{ id: 'open', label: 'Ver campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'primary' }],
        source: match.source,
      }
      return response
    }
  }
  return response
}
