import { createInternationalQuote, formatMoney } from '@backend/billing/currency'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { championshipCards, listOpenChampionships } from '@backend/lili/tools'
import type { LiliCurrency } from '@backend/lili/types'
import { menuActions, languageActions } from '../helpers/navigation'
import { flowControlActions, previousRegistrationContext } from '../helpers/registration'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleFlowControl(state: LiliChatState): Promise<LiliChatResponse> {
  const { message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'simular_pagamento_internacional': {
      const requestedCurrency: LiliCurrency = context.currency === 'EUR' || context.currency === 'USD'
        ? context.currency
        : locale === 'en' || locale === 'es' ? 'USD' : 'USD'

      if (!context.selectedChampionshipId) {
        const items = await listOpenChampionships()
        const cards = championshipCards(items, false, locale).map((card) => ({
          ...card,
          actions: [{
            id: `quote-${card.id}`,
            label: 'Calcular valor internacional',
            message: 'Calcular pagamento internacional',
            intent: 'simular_pagamento_internacional' as const,
            variant: 'primary' as const,
            context: { ...context, selectedChampionshipId: card.id, currency: requestedCurrency },
          }],
        }))
        response = {
          reply: items.length ? 'Escolha o campeonato para calcular o valor em dólar ou euro.' : 'Não há campeonatos com vagas abertas agora.',
          intent: match.intent,
          cards,
          actions: [{ id: 'menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }],
          context: { ...context, currency: requestedCurrency },
          source: match.source,
        }
        return response
      }

      const { data: config, error: configError } = await supabaseAdmin
        .from('campeonato_configuracoes')
        .select('valor_inscricao')
        .eq('campeonato_id', context.selectedChampionshipId)
        .maybeSingle()
      if (configError) throw configError
      const amount = Number(config?.valor_inscricao)
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Este campeonato não possui valor de inscrição configurado.')
      const quote = await createInternationalQuote(Math.round(amount * 100), requestedCurrency)
      const base = formatMoney(amount, 'BRL', locale)
      const total = formatMoney(quote.totalAmount, quote.currency, locale)
      response = {
        reply: `Cotação calculada e congelada por 10 minutos. O valor-base é ${base} e o total internacional é ${total}.`,
        intent: match.intent,
        cards: [{
          id: quote.quoteId,
          kind: 'payment',
          title: 'Cotação internacional',
          subtitle: `Válida até ${new Date(quote.expiresAt).toLocaleTimeString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          badges: [total],
          details: [
            { label: 'Valor-base', value: base },
            { label: 'Moeda', value: quote.currency },
            { label: 'Câmbio', value: `1 BRL = ${quote.rate.toFixed(6)} ${quote.currency}` },
            { label: 'Conversão', value: formatMoney(quote.convertedAmount, quote.currency, locale) },
            { label: 'Proteção cambial', value: `${quote.fxMarginPercent.toFixed(2)}%` },
            { label: 'Tarifa percentual configurada', value: `${quote.paypalPercent.toFixed(2)}%` },
            { label: 'Tarifa fixa configurada', value: formatMoney(quote.paypalFixed, quote.currency, locale) },
          ],
          actions: [
            { id: 'currency-usd', label: 'Calcular em USD', message: 'Calcular em dólar', intent: 'simular_pagamento_internacional', variant: requestedCurrency === 'USD' ? 'primary' : 'secondary', context: { ...context, currency: 'USD' } },
            { id: 'currency-eur', label: 'Calcular em EUR', message: 'Calcular em euro', intent: 'simular_pagamento_internacional', variant: requestedCurrency === 'EUR' ? 'primary' : 'secondary', context: { ...context, currency: 'EUR' } },
          ],
        }],
        actions: [{ id: 'menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }],
        context: { ...context, currency: requestedCurrency },
        source: 'system',
      }
      return response
    }

    case 'status_fluxo': {
      if (!context.currentFlow) {
        response = {
          reply: 'Você não possui nenhuma operação em andamento. Escolha uma opção para começar.',
          intent: match.intent,
          actions: menuActions(locale),
          context: { locale },
          source: 'system',
        }
        return response
      }

      const stepLabels: Record<string, string> = {
        championship: 'escolha do campeonato',
        team: 'escolha da equipe',
        payment: 'geração do pagamento',
        payment_wait: 'confirmação do pagamento',
        line: 'escolha da line',
        line_name: 'nome da nova line',
        slot: 'escolha do slot',
        confirm: 'confirmação final',
      }
      const currentStepLabel = stepLabels[String(context.currentStep || '')] || 'andamento da operação'
      const details = [
        context.selectedChampionshipId ? { label: 'Campeonato', value: 'Selecionado' } : null,
        context.selectedTeamId ? { label: 'Equipe', value: 'Selecionada' } : null,
        context.selectedLineName ? { label: 'Line', value: context.selectedLineName } : null,
        context.selectedSlotLabel ? { label: 'Slot', value: context.selectedSlotLabel } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>

      response = {
        reply: `Você parou na etapa de ${currentStepLabel}.`,
        intent: match.intent,
        cards: details.length ? [{
          id: 'flow-status',
          kind: 'summary',
          title: 'Resumo da operação',
          details,
        }] : undefined,
        actions: [
          {
            id: 'resume-flow',
            label: 'Continuar de onde parei',
            message: 'Continuar inscrição',
            intent: 'iniciar_inscricao',
            variant: 'primary',
            context,
          },
          ...flowControlActions(context),
        ],
        context,
        source: 'system',
      }
      return response
    }

    case 'reiniciar_conversa':
      response = {
        reply: 'Conversa reiniciada. Apaguei apenas o contexto temporário deste atendimento; nenhum dado salvo no sistema foi removido.',
        intent: match.intent,
        actions: menuActions(locale),
        context: { locale },
        source: 'system',
      }
      return response

    case 'cancelar_fluxo':
      response = {
        reply: context.currentFlow
          ? 'Operação cancelada. Nenhuma etapa pendente foi concluída.'
          : 'Não havia nenhuma operação em andamento.',
        intent: match.intent,
        actions: menuActions(locale),
        context: { locale },
        source: 'system',
      }
      return response

    case 'voltar_etapa': {
      if (context.currentFlow !== 'registration') {
        response = {
          reply: 'Você já está no início. Escolha o que deseja fazer.',
          intent: match.intent,
          actions: menuActions(locale),
          context: { locale },
          source: 'system',
        }
        return response
      }
      const previousContext = previousRegistrationContext(context)
      if (!previousContext.currentFlow) {
        response = {
          reply: 'Voltei ao início da conversa.',
          intent: match.intent,
          actions: menuActions(locale),
          context: { locale },
          source: 'system',
        }
        return response
      }
      response = {
        reply: 'Voltei uma etapa. Vamos continuar daqui.',
        intent: 'iniciar_inscricao',
        actions: [{
          id: 'continue-previous-step',
          label: 'Continuar',
          message: 'Continuar inscrição',
          intent: 'iniciar_inscricao',
          variant: 'primary',
          context: previousContext,
        }, ...flowControlActions(previousContext)],
        context: previousContext,
        source: 'system',
      }
      return response
    }

    case 'alterar_idioma':
      response = {
        reply: 'Escolha o idioma da conversa.',
        intent: match.intent,
        actions: languageActions(),
        context: { ...context, locale },
        source: 'system',
      }
      return response

    default:
      response = context.currentFlow
        ? {
            reply: 'Não entendi esse comando dentro da operação atual. Você pode continuar da etapa em que parou, voltar uma etapa ou cancelar sem concluir nada.',
            intent: 'desconhecido',
            actions: [
              { id: 'continue-flow', label: 'Continuar de onde parei', message: 'Continuar inscrição', intent: 'iniciar_inscricao', variant: 'primary', context },
              ...flowControlActions(context),
            ],
            context,
            source: match.source,
          }
        : {
            reply: 'Ainda não reconheci esse pedido. Escolha uma opção abaixo ou escreva, por exemplo, “quero ver campeonatos com vagas”.',
            intent: 'desconhecido', actions: menuActions(locale), context: { locale }, source: match.source,
          }
  }
  return response
}
