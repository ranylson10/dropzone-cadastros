import { getActiveAccount } from '@backend/auth/server-auth'
import { isPaidStatus } from '@backend/billing/asaas'
import { captureVacancyPayPalOrder, createLiliPayPalOrder, paypalConfigured } from '@backend/billing/paypal'
import { createVacancyPurchase } from '@backend/billing/vacancy-purchase'
import { createInternationalQuote, formatMoney } from '@backend/billing/currency'
import { championshipCards, getChampionshipDetails, lineCards, listOpenChampionships, paymentCard, teamCards } from '@backend/lili/tools'
import { registrationContext, flowControlActions, claimContext } from '../helpers/registration'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handlePurchasePayments(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'comprar_vaga': {
      if (!context.selectedChampionshipId) {
        const items = await listOpenChampionships()
        response = {
          reply: items.length ? 'Escolha o campeonato em que deseja comprar uma vaga diretamente pelo sistema.' : 'Não há campeonatos com vagas disponíveis para compra agora.',
          intent: match.intent,
          cards: championshipCards(items, true, locale),
          actions: [
            { id: 'have-token', label: 'Já tenho token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
            { id: 'menu-buy', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
          ],
          context: { locale, currentFlow: 'vacancy_purchase', currentStep: 'championship' },
          source: 'system',
        }
        return response
      }
      const item = await getChampionshipDetails(context.selectedChampionshipId)
      if (!item.aceita_novas_inscricoes_equipes || Number(item.vagas_livres || 0) <= 0) {
        response = { reply: 'Este campeonato não possui vaga disponível para compra neste momento.', intent: match.intent, actions: [{ id: 'other-spots', label: 'Ver outros campeonatos', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'primary', context: { locale } }], context: { locale }, source: 'system' }
        return response
      }
      if (!item.prazo_aberto) {
        response = { reply: 'O prazo de inscrição deste campeonato já encerrou.', intent: match.intent, actions: [{ id: 'other-open-deadline', label: 'Ver outros campeonatos', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'primary', context: { locale } }], context: { locale }, source: 'system' }
        return response
      }
      if (item.price_mode === 'free') {
        const freeContext = { locale, selectedChampionshipId: item.id, currentFlow: 'registration', currentStep: 'team' }
        response = {
          reply: 'A inscrição neste campeonato é gratuita. Escolha sua equipe para continuar sem pagamento.',
          intent: match.intent,
          actions: [{ id: `start-free-${item.id}`, label: 'Continuar inscrição grátis', message: 'Continuar inscrição', intent: 'iniciar_inscricao', variant: 'primary', context: freeContext }, { id: 'free-token', label: 'Já tenho convite ou token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } }],
          context: freeContext,
          source: 'system',
        }
        return response
      }
      if (item.price_mode === 'consult') {
        const whatsappAvailable = Boolean(item.pagamento_whatsapp_ativo && Array.isArray(item.contatos_whatsapp) && item.contatos_whatsapp.length)
        response = {
          reply: whatsappAvailable ? 'O valor desta vaga está sob consulta. Fale com a organização pelo WhatsApp para negociar e receber seu token.' : 'O valor desta vaga está sob consulta, mas a organização ainda não cadastrou um canal de atendimento.',
          intent: match.intent,
          actions: [
            ...(whatsappAvailable ? [{ id: `consult-whatsapp-${item.id}`, label: '🟢 Escolher vendedor no WhatsApp', message: 'Quero falar com um vendedor pelo WhatsApp', intent: 'falar_atendente_compra' as const, variant: 'whatsapp' as const, context: { locale, selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase' } }] : []),
            { id: 'consult-token', label: 'Já tenho token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
            { id: 'consult-back', label: 'Ver outros campeonatos', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'secondary', context: { locale } },
          ],
          context: { locale, selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase' },
          source: 'system',
        }
        return response
      }
      const nextContext = { locale, selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase', currentStep: 'payment_method' }
      const onlineValue = Number(item.valor_inscricao || 0)
      const asaasMinimumMet = onlineValue >= 5
      const pixAvailable = Boolean(item.pagamento_pix_ativo && asaasMinimumMet)
      const cardAvailable = Boolean(item.pagamento_cartao_ativo && asaasMinimumMet)
      const paypalAvailable = Boolean(item.pagamento_paypal_ativo && paypalConfigured())
      const minimumNotice = !asaasMinimumMet && (item.pagamento_pix_ativo || item.pagamento_cartao_ativo)
        ? ' PIX e cartão não aparecem porque estes meios exigem cobrança mínima de R$ 5,00.'
        : ''
      response = {
        reply: `Escolha como deseja comprar a vaga. Depois que o pagamento for confirmado, a Lili libera a escolha da equipe, line e slot.${minimumNotice}`,
        intent: match.intent,
        cards: [{ id: item.id, kind: 'championship', title: item.nome, imageUrl: item.logo_url || item.banner_url || null, badges: [`${item.vagas_livres} vaga${Number(item.vagas_livres) === 1 ? '' : 's'} disponível${Number(item.vagas_livres) === 1 ? '' : 'is'}`], details: [
          { label: 'Valor', value: `R$ ${onlineValue.toFixed(2).replace('.', ',')}` },
          ...(!asaasMinimumMet && (item.pagamento_pix_ativo || item.pagamento_cartao_ativo) ? [{ label: 'PIX e cartão', value: 'Disponíveis a partir de R$ 5,00' }] : []),
        ] }],
        actions: [
          ...(pixAvailable ? [{ id: 'buy-pix', label: '💠 PIX', message: 'Comprar vaga por PIX', intent: 'pagar_pix_compra' as const, variant: 'primary' as const, context: { ...nextContext, selectedPaymentMethod: 'pix' as const } }] : []),
          ...(cardAvailable ? [{ id: 'buy-card', label: `💳 Cartão${Number(item.cartao_max_parcelas || 1) > 1 ? ` até ${item.cartao_max_parcelas}x` : ''}`, message: 'Comprar vaga com cartão', intent: 'pagar_cartao_compra' as const, variant: 'primary' as const, context: { ...nextContext, selectedPaymentMethod: 'cartao' as const } }] : []),
          ...(paypalAvailable ? [{ id: 'buy-paypal', label: '🅿️ PayPal', message: 'Comprar vaga com PayPal', intent: 'pagar_paypal_compra' as const, variant: 'secondary' as const, context: { ...nextContext, selectedPaymentMethod: 'paypal' as const } }] : []),
          ...(item.pagamento_whatsapp_ativo && Array.isArray(item.contatos_whatsapp) && item.contatos_whatsapp.length ? [{ id: 'buy-whatsapp', label: '🟢 Escolher vendedor no WhatsApp', message: 'Quero comprar pelo WhatsApp', intent: 'falar_atendente_compra' as const, variant: 'whatsapp' as const, context: { ...nextContext, selectedPaymentMethod: 'whatsapp' as const } }] : []),
          { id: 'have-token-selected', label: 'Já tenho token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
        ],
        context: nextContext,
        source: 'system',
      }
      return response
    }

    case 'pagar_pix_compra':

    case 'pagar_cartao_compra': {
      if (!user) { response = { reply: 'Entre na conta para gerar o pagamento.', intent: match.intent, requiresAuth: true, context, source: 'system' }; return response }
      if (!context.selectedChampionshipId) throw new Error('Campeonato não selecionado.')
      const method: 'pix' | 'cartao' = match.intent === 'pagar_cartao_compra' ? 'cartao' : 'pix'
      const paymentChampionship = await getChampionshipDetails(context.selectedChampionshipId)
      if (Number(paymentChampionship.valor_inscricao || 0) < 5) {
        response = {
          reply: 'PIX e cartão exigem valor mínimo de R$ 5,00. Para esta vaga, use PayPal ou WhatsApp quando estiverem disponíveis.',
          intent: match.intent,
          actions: [
            ...(paymentChampionship.pagamento_paypal_ativo && paypalConfigured() ? [{ id: 'minimum-use-paypal', label: '🅿️ Usar PayPal', message: 'Comprar vaga com PayPal', intent: 'pagar_paypal_compra' as const, variant: 'primary' as const, context: { ...context, selectedPaymentMethod: 'paypal' as const } }] : []),
            { id: 'minimum-back-methods', label: 'Voltar aos pagamentos', message: 'Comprar vaga', intent: 'comprar_vaga', variant: 'secondary', context: { locale, selectedChampionshipId: context.selectedChampionshipId, currentFlow: 'vacancy_purchase' } },
          ],
          context,
          source: 'system',
        }
        return response
      }
      const digits = String(context.paymentDocument || '').replace(/\D/g, '')
      if (![11, 14].includes(digits.length)) {
        const nextContext = { ...context, selectedPaymentMethod: method, awaitingPaymentDocument: true, currentStep: 'payment_document' }
        response = { reply: 'Digite o CPF ou CNPJ do pagador para gerar a cobrança segura.', intent: match.intent, actions: [{ id: 'back-buy-method', label: 'Voltar', message: 'Voltar uma etapa', intent: 'voltar_etapa', variant: 'secondary', context: nextContext }], context: nextContext, source: 'system' }
        return response
      }
      const account = await getActiveAccount(req, user)
      const email = String(user.email || account?.data?.email_contato || '').trim()
      const name = String(account?.name || user.user_metadata?.full_name || email).trim()
      const { compra, payment } = await createVacancyPurchase({ campeonatoId: context.selectedChampionshipId, authUserId: user.id, payerName: name || 'Comprador', payerEmail: email, cpfCnpj: digits, method })
      const nextContext = registrationContext(context, { purchaseToken: compra.token, purchaseId: compra.id, awaitingPaymentDocument: false, currentStep: 'payment_wait' })
      response = {
        reply: method === 'pix' ? 'Cobrança PIX criada. Pague e depois toque em “Já paguei, verificar”.' : 'Checkout seguro do cartão criado. Conclua o pagamento e use o retorno automático para continuar na Lili.',
        intent: match.intent,
        cards: [paymentCard({ token: compra.token, status: payment?.status || compra.status, valueCents: payment?.valor_centavos || compra.valor_centavos, invoiceUrl: payment?.asaas_invoice_url, pixPayload: payment?.asaas_pix_payload, pixQrCode: payment?.asaas_pix_qrcode, expiresAt: compra.expira_em, method, maxInstallments: paymentChampionship.cartao_max_parcelas })],
        actions: [{ id: 'check-direct-payment', label: 'Já paguei, verificar', message: 'Verificar pagamento', intent: 'verificar_pagamento_inscricao', variant: 'primary', context: nextContext }, { id: 'menu-after-payment', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }],
        context: nextContext, source: 'system',
      }
      return response
    }

    case 'pagar_paypal_compra': {
      if (!user) { response = { reply: 'Entre na conta para pagar com PayPal.', intent: match.intent, requiresAuth: true, context, source: 'system' }; return response }
      if (!context.selectedChampionshipId) throw new Error('Campeonato não selecionado.')
      if (!paypalConfigured()) throw new Error('PayPal ainda não foi configurado na Vercel.')
      if (!context.currency) {
        response = { reply: 'Escolha a moeda do pagamento PayPal.', intent: match.intent, actions: [
          { id: 'buy-paypal-brl', label: 'Real (BRL)', message: 'Pagar em reais pelo PayPal', intent: 'pagar_paypal_compra', variant: 'primary', context: { ...context, currency: 'BRL', selectedPaymentMethod: 'paypal' } },
          { id: 'buy-paypal-usd', label: 'Dólar (USD)', message: 'Pagar em dólares pelo PayPal', intent: 'pagar_paypal_compra', variant: 'secondary', context: { ...context, currency: 'USD', selectedPaymentMethod: 'paypal' } },
          { id: 'buy-paypal-eur', label: 'Euro (EUR)', message: 'Pagar em euros pelo PayPal', intent: 'pagar_paypal_compra', variant: 'secondary', context: { ...context, currency: 'EUR', selectedPaymentMethod: 'paypal' } },
        ], context: { ...context, selectedPaymentMethod: 'paypal' }, source: 'system' }
        return response
      }
      const item = await getChampionshipDetails(context.selectedChampionshipId)
      const base = Number(item.valor_inscricao || 0)
      if (base <= 0) throw new Error('Este campeonato não possui valor online cobrável.')
      const quote = context.currency === 'BRL' ? { currency: 'BRL' as const, totalMinor: Math.round(base * 100) } : await createInternationalQuote(Math.round(base * 100), context.currency)
      const account = await getActiveAccount(req, user)
      const email = String(user.email || account?.data?.email_contato || '').trim()
      const name = String(account?.name || user.user_metadata?.full_name || email).trim()
      const { compra } = await createVacancyPurchase({ campeonatoId: context.selectedChampionshipId, authUserId: user.id, payerName: name || 'Comprador', payerEmail: email, method: 'paypal' })
      const payment = await createLiliPayPalOrder({ reservation: compra, campeonatoNome: item.nome, amountMinor: quote.totalMinor, currency: quote.currency, quote, returnOrigin: req.nextUrl.origin, referenceType: 'sistema_compras_vaga' })
      const nextContext = registrationContext(context, { purchaseToken: compra.token, purchaseId: compra.id, paypalOrderId: payment.paypal_order_id, paypalApprovalUrl: payment.paypal_approval_url, currentStep: 'payment_wait' })
      response = { reply: 'Ordem PayPal criada. Abra o PayPal, aprove o pagamento e volte para a Lili.', intent: match.intent, cards: [{ id: payment.id, kind: 'payment', title: 'Pagamento PayPal', subtitle: item.nome, expiresAt: compra.expira_em, details: [{ label: 'Valor', value: formatMoney(quote.totalMinor / 100, quote.currency, locale) }, { label: 'Moeda', value: quote.currency }], actions: [{ id: 'open-paypal-buy', label: 'Abrir PayPal', href: payment.paypal_approval_url, variant: 'primary' }] }], actions: [{ id: 'check-paypal-buy', label: 'Já paguei, verificar', message: 'Verificar pagamento PayPal da vaga', intent: 'capturar_paypal_compra', variant: 'secondary', context: nextContext }], context: nextContext, source: 'system' }
      return response
    }

    case 'capturar_paypal_compra': {
      if (!user || !context.purchaseId || !context.paypalOrderId || !context.purchaseToken) throw new Error('Retorno do PayPal incompleto.')
      const payment = await captureVacancyPayPalOrder({ orderId: context.paypalOrderId, purchaseId: context.purchaseId, authUserId: user.id })
      if (!isPaidStatus(payment.status)) {
        response = { reply: 'O PayPal ainda não confirmou o pagamento. Tente novamente em alguns segundos.', intent: match.intent, actions: [{ id: 'retry-paypal-buy', label: 'Verificar novamente', message: 'Verificar pagamento PayPal da vaga', intent: 'capturar_paypal_compra', variant: 'primary', context }], context, source: 'system' }
        return response
      }
      const data = await claimContext(req, context)
      const nextContext = registrationContext(context, { currentStep: 'team', selectedTeamId: null, selectedLineId: null, selectedLineName: null, selectedSlotId: null, selectedSlotLabel: null })
      response = { reply: 'Pagamento confirmado. Agora escolha a equipe que usará esta vaga.', intent: match.intent, cards: teamCards(data.equipes || []).map((card: any) => ({ ...card, actions: [{ id: `purchase-team-${card.id}`, label: 'Usar esta equipe', message: `Usar equipe ${card.title}`, intent: 'selecionar_equipe_compra', variant: 'primary', context: { ...nextContext, selectedTeamId: card.id } }] })), actions: flowControlActions(nextContext), context: nextContext, source: 'system' }
      return response
    }

    case 'selecionar_equipe_compra': {
      const data = await claimContext(req, context)
      const nextContext = registrationContext(context, { currentStep: 'line' })
      response = { reply: data.lines?.length ? 'Equipe selecionada. Agora escolha uma line disponível.' : 'Equipe selecionada. Digite o nome da nova line.', intent: match.intent, cards: data.lines?.length ? lineCards(data.lines, nextContext) : undefined, actions: data.lines?.length ? [{ id: 'new-line-after-buy', label: 'Criar nova line', message: 'Quero criar uma nova line', intent: 'criar_line_inscricao', variant: 'secondary', context: nextContext }, ...flowControlActions(nextContext)] : flowControlActions(registrationContext(nextContext, { awaitingLineName: true, currentStep: 'line_name' })), context: data.lines?.length ? nextContext : registrationContext(nextContext, { awaitingLineName: true, currentStep: 'line_name' }), source: 'system' }
      return response
    }
  }
  return response
}
