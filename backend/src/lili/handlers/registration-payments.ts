import { getAccountsForUser, getActiveAccount } from '@backend/auth/server-auth'
import { claimVacancyPurchase, createVacancyPurchase } from '@backend/billing/vacancy-purchase'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { buildRegistrationSummary, paymentCard, slotCards, teamCards } from '@backend/lili/tools'
import { menuActions } from '../helpers/navigation'
import { registrationReceiptCard, registrationContext, flowControlActions, claimContext } from '../helpers/registration'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleRegistrationPayments(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'iniciar_pagamento_inscricao': {
      if (!user) {
        response = { reply: 'Para gerar o pagamento, preciso que você entre na sua conta.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!context.selectedChampionshipId) throw new Error('Escolha o campeonato antes de gerar o pagamento.')
      const account = await getActiveAccount(req, user)
      const email = String(user.email || account?.data?.email_contato || '').trim()
      const name = String(account?.name || user.user_metadata?.full_name || email).trim()
      const { compra, payment } = await createVacancyPurchase({
        campeonatoId: context.selectedChampionshipId,
        authUserId: user.id,
        payerName: name || 'Comprador',
        payerEmail: email,
      })
      const nextContext = registrationContext(context, { purchaseToken: compra.token, currentStep: 'payment_wait' })
      response = {
        reply: 'Pagamento criado. Conclua o PIX e depois toque em “Já paguei, verificar”. Não precisa sair desta conversa.',
        intent: match.intent,
        cards: [paymentCard({
          token: compra.token,
          status: payment?.status || compra.status,
          valueCents: payment?.valor_centavos || compra.valor_centavos,
          invoiceUrl: payment?.asaas_invoice_url,
          pixPayload: payment?.asaas_pix_payload,
          pixQrCode: payment?.asaas_pix_qrcode,
          expiresAt: compra.expira_em,
        })],
        actions: [
          { id: 'check-payment', label: 'Já paguei, verificar', message: 'Verificar pagamento', intent: 'verificar_pagamento_inscricao', variant: 'primary', context: nextContext },
          { id: 'menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' },
        ],
        context: nextContext,
        source: 'system',
      }
      return response
    }

    case 'verificar_pagamento_inscricao': {
      if (!user) {
        response = { reply: 'Entre na conta para verificar este pagamento.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      const data = await claimContext(req, context)
      if (!data.liberado && !data.consumido) {
        const paymentStatus = String(data.payment?.status || data.compra.status || 'pendente').toLowerCase()
        const terminalPayment = ['recusado', 'negado', 'cancelado', 'expirado', 'estornado'].includes(paymentStatus)
        const underReview = ['em_analise', 'aguardando'].includes(paymentStatus)
        const paymentMethod = data.payment?.metodo || context.selectedPaymentMethod || null
        const paymentCardData = data.payment ? paymentCard({
          token: data.compra.token,
          status: data.payment.status,
          valueCents: data.payment.valor_centavos,
          invoiceUrl: data.payment.invoice_url,
          pixPayload: data.payment.pix_payload,
          pixQrCode: data.payment.pix_qrcode,
          expiresAt: data.compra.expira_em,
          method: paymentMethod,
        }) : undefined
        response = {
          reply: terminalPayment
            ? paymentStatus === 'expirado'
              ? 'O prazo desta cobrança terminou e a vaga foi liberada. Você pode iniciar uma nova compra.'
              : paymentStatus === 'estornado'
                ? 'Este pagamento foi estornado e não libera vaga.'
                : 'O pagamento não foi aprovado. Tente novamente ou escolha outro meio de pagamento.'
            : underReview
              ? 'O pagamento está em análise pela operadora. Aguarde a atualização antes de tentar outra cobrança.'
              : 'O pagamento ainda não foi confirmado. Aguarde alguns segundos e tente novamente.',
          intent: match.intent,
          cards: paymentCardData ? [paymentCardData] : undefined,
          actions: terminalPayment
            ? [
                { id: 'retry-purchase-payment', label: 'Tentar outra forma de pagamento', message: `Comprar vaga em ${data.campeonato?.nome || 'este campeonato'}`, intent: 'comprar_vaga', variant: 'primary', context: { locale, selectedChampionshipId: data.compra.campeonato_id, currentFlow: 'vacancy_purchase' } },
                { id: 'back-payment-menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
              ]
            : [{ id: 'check-again', label: underReview ? 'Atualizar análise' : 'Verificar novamente', message: 'Verificar pagamento novamente', intent: 'verificar_pagamento_inscricao', variant: 'primary', context }],
          context,
          source: 'system',
        }
        return response
      }
      if (data.consumido) {
        response = { reply: 'Esta compra já foi usada e a inscrição já está concluída.', intent: match.intent, actions: menuActions(locale), context: { locale }, source: 'system' }
        return response
      }
      const nextContext = registrationContext(context, { currentStep: 'team', selectedTeamId: null, selectedLineId: null, selectedLineName: null })
      response = {
        reply: 'Pagamento confirmado. Agora escolha a equipe que usará esta vaga.',
        intent: match.intent,
        cards: teamCards(data.equipes || []).map((card: any) => ({ ...card, actions: [{ id: `purchase-team-${card.id}`, label: 'Usar esta equipe', message: `Usar equipe ${card.title}`, intent: 'selecionar_equipe_compra', variant: 'primary', context: { ...nextContext, selectedTeamId: card.id } }] })),
        actions: flowControlActions(nextContext),
        context: nextContext,
        source: 'system',
      }
      return response
    }

    case 'criar_line_inscricao':
      response = {
        reply: 'Digite o nome da nova line. Depois eu vou mostrar os slots livres.',
        intent: match.intent,
        actions: flowControlActions(registrationContext(context, { awaitingLineName: true, selectedLineId: null, selectedLineName: null, currentStep: 'line_name' })),
        context: registrationContext(context, { awaitingLineName: true, selectedLineId: null, selectedLineName: null, currentStep: 'line_name' }),
        source: 'system',
      }
      return response

    case 'selecionar_line_inscricao': {
      const data = await claimContext(req, context)
      const nextContext = registrationContext(context, { currentStep: 'slot', awaitingLineName: false })
      response = {
        reply: `Line ${context.selectedLineName || 'selecionada'}. Agora escolha um slot livre no grupo ${data.grupo?.nome || ''}.`,
        intent: match.intent,
        cards: slotCards(data.slots_livres || [], nextContext),
        actions: flowControlActions(nextContext),
        context: nextContext,
        source: 'system',
      }
      return response
    }

    case 'selecionar_slot_inscricao': {
      if (!context.selectedChampionshipId || !context.selectedTeamId || !context.selectedSlotId || (!context.selectedLineId && !context.selectedLineName)) {
        throw new Error('Faltam dados para confirmar a inscrição.')
      }
      const summary = await buildRegistrationSummary(context.selectedChampionshipId, context.selectedTeamId)
      response = {
        reply: 'Confira os dados antes de confirmar. A inscrição só será criada depois da sua confirmação.',
        intent: match.intent,
        cards: [{ id: 'final-summary', kind: 'summary', title: 'Confirmar inscrição', details: [
          { label: 'Campeonato', value: summary.championship.nome },
          { label: 'Equipe', value: summary.team.nome },
          { label: 'Line', value: context.selectedLineName || 'Line selecionada' },
          { label: 'Slot', value: context.selectedSlotLabel || 'Selecionado' },
        ] }],
        actions: [
          { id: 'confirm', label: 'Confirmar inscrição', message: 'Confirmar inscrição agora', intent: 'confirmar_inscricao', variant: 'primary', context: registrationContext(context, { currentStep: 'confirm' }) },
          { id: 'change-slot', label: 'Escolher outro slot', message: 'Quero escolher outro slot', intent: 'selecionar_line_inscricao', variant: 'secondary', context: registrationContext(context, { selectedSlotId: null, selectedSlotLabel: null, currentStep: 'slot' }) },
        ],
        context: registrationContext(context, { currentStep: 'confirm' }),
        source: 'system',
      }
      return response
    }

    case 'confirmar_inscricao': {
      if (!user) {
        response = { reply: 'Entre na conta para confirmar a inscrição.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!context.purchaseToken || !context.selectedTeamId || !context.selectedSlotId) throw new Error('Faltam dados para confirmar a inscrição.')
      const accounts = await getAccountsForUser(user)
      const result = await claimVacancyPurchase({
        token: context.purchaseToken,
        authUserId: user.id,
        accounts,
        equipeId: context.selectedTeamId,
        lineId: context.selectedLineId || null,
        nomeLine: context.selectedLineId ? null : context.selectedLineName || null,
        slotId: context.selectedSlotId,
      })
      const [championshipResult, groupResult, teamResult] = await Promise.all([
        supabaseAdmin.from('campeonatos').select('nome').eq('id', result.compra.campeonato_id).maybeSingle(),
        result.grupo_id
          ? supabaseAdmin.from('campeonato_grupos').select('nome').eq('id', result.grupo_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabaseAdmin.from('equipes').select('nome').eq('id', context.selectedTeamId).maybeSingle(),
      ])
      const paymentMethod = String(result.compra?.meta?.metodo_pagamento || result.compra?.meta?.payment_method || context.selectedPaymentMethod || 'Pagamento confirmado').toUpperCase()
      response = {
        reply: result.mensagem || 'Inscrição concluída com sucesso.',
        intent: match.intent,
        cards: [registrationReceiptCard({
          id: String(result.campeonato_equipe_id),
          campeonato: championshipResult.data?.nome || 'Campeonato confirmado',
          equipe: teamResult.data?.nome || 'Equipe confirmada',
          line: result.line.nome,
          grupo: groupResult.data?.nome || 'Grupo confirmado',
          slot: result.slot.slot_letra || String(result.slot.slot_numero),
          pagamento: paymentMethod,
          valorCentavos: result.compra?.valor_centavos,
          protocolo: String(result.compra?.token || result.campeonato_equipe_id),
          confirmadoEm: result.compra?.consumido_em || new Date().toISOString(),
        })],
        actions: [
          { id: 'view-registration-after-purchase', label: 'Ver minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes', variant: 'primary', context: { locale } },
          { id: 'view-rules-after-purchase', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: result.compra.campeonato_id } },
          { id: 'menu-after-purchase', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale },
        source: 'system',
      }
      return response
    }
  }
  return response
}
