import { getActiveAccount } from '@backend/auth/server-auth'
import { isPaidStatus } from '@backend/billing/asaas'
import { reserveSlotForLili, confirmLiliReservation } from '@backend/billing/lili-slot-reservation'
import { createLiliAsaasPayment, getLiliPaymentStatus } from '@backend/billing/lili-payment'
import { captureLiliPayPalOrder, createLiliPayPalOrder, getLiliPayPalPaymentStatus, paypalConfigured } from '@backend/billing/paypal'
import { createInternationalQuote, formatMoney } from '@backend/billing/currency'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { getChampionshipDetails, paymentCard } from '@backend/lili/tools'
import { whatsappContactActions } from '../helpers/contacts'
import { menuActions } from '../helpers/navigation'
import { loadGroupInviteInChat, confirmGroupInviteInChat } from '../helpers/group-invites'
import type { LiliChatState } from '../chat-state'
import type { LiliChatResponse } from '../types'

export async function handleGroupPayments(state: LiliChatState): Promise<LiliChatResponse> {
  const { req, user, message, locale, match } = state
  let { context } = state
  let response!: LiliChatResponse
  switch (state.match.intent) {
    case 'pagar_pix_convite_grupo':

    case 'pagar_cartao_convite_grupo': {
      if (!user) {
        response = { reply: 'Entre na conta para reservar o slot e gerar o pagamento.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      const method: 'pix' | 'cartao' = match.intent === 'pagar_cartao_convite_grupo' ? 'cartao' : 'pix'
      const digits = String(context.paymentDocument || '').replace(/\D/g, '')
      if (![11, 14].includes(digits.length)) {
        const nextContext = { ...context, selectedPaymentMethod: method, awaitingPaymentDocument: true, currentStep: 'payment_document' }
        response = {
          reply: 'Digite o CPF ou CNPJ do pagador. O documento será usado somente para gerar a cobrança segura.',
          intent: match.intent,
          actions: [{ id: 'cancel-payment-document', label: 'Voltar', message: 'Voltar uma etapa', intent: 'voltar_etapa', variant: 'secondary', context: nextContext }],
          context: nextContext,
          source: 'system',
        }
        return response
      }
      const invite = await loadGroupInviteInChat(req, String(context.inviteToken), String(context.selectedTeamId))
      const { data: cfg } = await supabaseAdmin.from('campeonato_configuracoes').select('valor_inscricao').eq('campeonato_id', invite.campeonato.id).maybeSingle()
      const valueCents = Math.round(Number(cfg?.valor_inscricao || 0) * 100)
      if (valueCents < 100) throw new Error('Este campeonato não possui valor online cobrável.')
      const reservation = await reserveSlotForLili({
        campeonatoId: invite.campeonato.id,
        grupoId: invite.grupo.id,
        slotId: String(context.selectedSlotId),
        authUserId: user.id,
        equipeId: String(context.selectedTeamId),
        lineId: context.selectedLineId || null,
        nomeLine: context.selectedLineId ? null : context.selectedLineName || null,
        conviteToken: context.inviteToken || null,
        metodo: method,
        minutes: 15,
        meta: { campeonato_nome: invite.campeonato.nome, grupo_nome: invite.grupo.nome, slot: context.selectedSlotLabel },
      })
      const account = await getActiveAccount(req, user)
      const email = String(user.email || account?.data?.email_contato || '').trim()
      const name = String(account?.name || user.user_metadata?.full_name || email).trim()
      const payment = await createLiliAsaasPayment({ reservation, payerName: name || 'Equipe', payerEmail: email, cpfCnpj: digits, campeonatoNome: invite.campeonato.nome, valorCentavos: valueCents, method })
      const nextContext = { ...context, awaitingPaymentDocument: false, reservationId: reservation.id, reservationCode: reservation.codigo, reservationExpiresAt: reservation.expira_em, paymentId: payment.id, currentStep: 'payment_wait' }
      response = {
        reply: method === 'pix'
          ? `Slot reservado até ${new Date(reservation.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Pague pelo QR Code ou PIX copia e cola.`
          : `Slot reservado até ${new Date(reservation.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Abra o checkout seguro para pagar com cartão.`,
        intent: match.intent,
        cards: [paymentCard({ token: reservation.codigo, status: payment.status, valueCents: payment.valor_centavos, invoiceUrl: payment.asaas_invoice_url, pixPayload: payment.asaas_pix_payload, pixQrCode: payment.asaas_pix_qrcode })],
        actions: [
          { id: 'check-group-payment', label: 'Já paguei, verificar', message: 'Verificar pagamento', intent: 'verificar_pagamento_convite_grupo', variant: 'primary', context: nextContext },
          { id: 'group-payment-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: nextContext },
        ],
        context: nextContext,
        source: 'system',
      }
      return response
    }

    case 'verificar_pagamento_convite_grupo': {
      if (!user || !context.reservationId) throw new Error('Reserva de pagamento não localizada.')
      const payment = context.selectedPaymentMethod === 'paypal'
        ? await getLiliPayPalPaymentStatus(context.reservationId)
        : await getLiliPaymentStatus(context.reservationId)
      if (!payment || !isPaidStatus(payment.status)) {
        response = { reply: 'O pagamento ainda não foi confirmado. O slot continua reservado até o horário informado.', intent: match.intent, actions: [{ id: 'check-group-payment-again', label: 'Verificar novamente', message: 'Verificar pagamento novamente', intent: 'verificar_pagamento_convite_grupo', variant: 'primary', context }], context, source: 'system' }
        return response
      }
      const result = await confirmGroupInviteInChat(req, context)
      await confirmLiliReservation(context.reservationId)
      response = {
        reply: result?.mensagem || 'Pagamento e inscrição confirmados com sucesso.',
        enrollmentConfirmed: true,
        intent: match.intent,
        cards: [{ id: String(result?.campeonato_equipe_id || context.reservationId), kind: 'summary', title: 'Comprovante de inscrição', subtitle: 'Pagamento confirmado', details: [
          { label: 'Campeonato', value: String(result?.campeonato?.nome || 'Confirmado') },
          { label: 'Grupo', value: String(result?.grupo?.nome || context.inviteGroupId || 'Confirmado') },
          { label: 'Line', value: String(result?.line?.nome || context.selectedLineName || 'Confirmada') },
          { label: 'Slot', value: String(result?.slot?.slot_letra || result?.slot?.slot_numero || context.selectedSlotLabel || 'Confirmado') },
          { label: 'Pagamento', value: String(context.selectedPaymentMethod || 'Online').toUpperCase() },
          { label: 'Protocolo', value: String(context.reservationCode || result?.campeonato_equipe_id || 'Gerado') },
        ] }],
        actions: menuActions(locale), context: { locale }, source: 'system',
      }
      return response
    }

    case 'falar_atendente_convite_grupo': {
      const invite = await loadGroupInviteInChat(req, String(context.inviteToken), context.selectedTeamId ? String(context.selectedTeamId) : undefined)
      const { data: cfg } = await supabaseAdmin
        .from('campeonato_configuracoes')
        .select('contatos_whatsapp')
        .eq('campeonato_id', invite.campeonato.id)
        .maybeSingle()
      const contacts = Array.isArray(cfg?.contatos_whatsapp) ? cfg.contatos_whatsapp : []
      const text = [
        `Olá, quero negociar uma vaga no campeonato ${invite.campeonato.nome}.`,
        invite.grupo?.nome ? `Grupo: ${invite.grupo.nome}` : null,
        context.selectedSlotLabel ? `Slot desejado: ${context.selectedSlotLabel}` : null,
        invite.equipe?.nome ? `Equipe: ${invite.equipe.nome}` : null,
        context.selectedLineName ? `Line: ${context.selectedLineName}` : null,
        'A vaga ainda não foi reservada automaticamente. Gostaria de confirmar disponibilidade e pagamento.',
      ].filter(Boolean).join('\n')
      const actions = whatsappContactActions(contacts, text, `invite-whatsapp-${invite.campeonato.id}`)
      response = {
        reply: actions.length
          ? 'Escolha um vendedor abaixo para continuar pelo WhatsApp. A vaga não será reservada automaticamente; o organizador decide se deseja agendá-la durante o atendimento.'
          : 'A organização ainda não cadastrou vendedores com WhatsApp para este campeonato.',
        intent: match.intent,
        cards: actions.length ? [{
          id: `whatsapp-invite-${invite.campeonato.id}`,
          kind: 'summary',
          title: 'Atendimento pelo WhatsApp',
          subtitle: invite.campeonato.nome,
          details: [
            ...(invite.grupo?.nome ? [{ label: 'Grupo', value: String(invite.grupo.nome) }] : []),
            ...(context.selectedSlotLabel ? [{ label: 'Slot desejado', value: String(context.selectedSlotLabel) }] : []),
            { label: 'Reserva automática', value: 'Não. A organização decide manualmente.' },
          ],
          actions,
        }] : undefined,
        actions: [
          ...(!actions.length ? [{ id: 'no-whatsapp', label: 'Voltar', message: 'Voltar uma etapa', intent: 'voltar_etapa' as const, variant: 'secondary' as const, context }] : []),
        ],
        context,
        source: 'system',
      }
      return response
    }

    case 'falar_atendente_compra': {
      if (!context.selectedChampionshipId) throw new Error('Campeonato não selecionado.')
      const item = await getChampionshipDetails(context.selectedChampionshipId)
      const contacts = Array.isArray(item.contatos_whatsapp) ? item.contatos_whatsapp : []
      const value = item.valor_inscricao == null ? 'sob consulta' : `R$ ${Number(item.valor_inscricao).toFixed(2).replace('.', ',')}`
      const text = [
        `Olá, quero comprar uma vaga no campeonato ${item.nome}.`,
        `Valor informado: ${value}.`,
        'Estou falando pela Lili do DropZone.',
        'A vaga ainda não foi reservada automaticamente. Gostaria de confirmar disponibilidade e forma de pagamento.',
      ].join('\n')
      const actions = whatsappContactActions(contacts, text, `buy-whatsapp-${item.id}`)
      response = {
        reply: actions.length
          ? 'Escolha um vendedor abaixo. O WhatsApp abrirá diretamente, sem sair antes para a página de vagas. A vaga não fica presa automaticamente.'
          : 'A organização ainda não cadastrou vendedores com WhatsApp para este campeonato.',
        intent: match.intent,
        cards: actions.length ? [{
          id: `whatsapp-buy-${item.id}`,
          kind: 'summary',
          title: 'Comprar pelo WhatsApp',
          subtitle: item.nome,
          imageUrl: item.logo_url || item.banner_url || null,
          details: [
            { label: 'Valor', value },
            { label: 'Reserva automática', value: 'Não. A organização decide manualmente.' },
            { label: 'Vendedores disponíveis', value: String(actions.length) },
          ],
          actions,
        }] : undefined,
        actions: [
          { id: 'whatsapp-back-payment', label: 'Voltar aos meios de pagamento', message: `Comprar vaga em ${item.nome}`, intent: 'comprar_vaga', variant: 'secondary', context: { locale, selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase' } },
        ],
        context: { ...context, selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase' },
        source: 'system',
      }
      return response
    }

    case 'pagar_paypal_convite_grupo': {
      if (!user) {
        response = { reply: 'Entre na conta para reservar o slot e pagar com PayPal.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      if (!paypalConfigured()) throw new Error('PayPal ainda não foi configurado na Vercel.')
      if (!context.currency) {
        response = {
          reply: 'Escolha a moeda do pagamento PayPal. O valor ficará congelado durante esta reserva.',
          intent: match.intent,
          actions: [
            { id: 'paypal-brl', label: 'Real (BRL)', message: 'Pagar em reais pelo PayPal', intent: 'pagar_paypal_convite_grupo', variant: 'primary', context: { ...context, currency: 'BRL', selectedPaymentMethod: 'paypal' } },
            { id: 'paypal-usd', label: 'Dólar (USD)', message: 'Pagar em dólares pelo PayPal', intent: 'pagar_paypal_convite_grupo', variant: 'secondary', context: { ...context, currency: 'USD', selectedPaymentMethod: 'paypal' } },
            { id: 'paypal-eur', label: 'Euro (EUR)', message: 'Pagar em euros pelo PayPal', intent: 'pagar_paypal_convite_grupo', variant: 'secondary', context: { ...context, currency: 'EUR', selectedPaymentMethod: 'paypal' } },
          ],
          context: { ...context, selectedPaymentMethod: 'paypal' }, source: 'system',
        }
        return response
      }
      const invite = await loadGroupInviteInChat(req, String(context.inviteToken), String(context.selectedTeamId))
      const { data: cfg } = await supabaseAdmin.from('campeonato_configuracoes').select('valor_inscricao').eq('campeonato_id', invite.campeonato.id).maybeSingle()
      const baseCents = Math.round(Number(cfg?.valor_inscricao || 0) * 100)
      if (baseCents < 100) throw new Error('Este campeonato não possui valor online cobrável.')
      const quote = await createInternationalQuote(baseCents, context.currency)
      const reservation = await reserveSlotForLili({
        campeonatoId: invite.campeonato.id,
        grupoId: invite.grupo.id,
        slotId: String(context.selectedSlotId),
        authUserId: user.id,
        equipeId: String(context.selectedTeamId),
        lineId: context.selectedLineId || null,
        nomeLine: context.selectedLineId ? null : context.selectedLineName || null,
        conviteToken: context.inviteToken || null,
        metodo: 'paypal',
        minutes: 15,
        meta: { campeonato_nome: invite.campeonato.nome, grupo_nome: invite.grupo.nome, slot: context.selectedSlotLabel, quote },
      })
      const payment = await createLiliPayPalOrder({
        reservation,
        campeonatoNome: invite.campeonato.nome,
        amountMinor: quote.totalMinor,
        currency: quote.currency,
        returnOrigin: req.nextUrl.origin,
      })
      const nextContext = {
        ...context,
        reservationId: reservation.id,
        reservationCode: reservation.codigo,
        reservationExpiresAt: reservation.expira_em,
        paymentId: payment.id,
        paypalOrderId: payment.paypal_order_id,
        paypalApprovalUrl: payment.paypal_approval_url,
        currentStep: 'payment_wait',
      }
      response = {
        reply: `Slot reservado até ${new Date(reservation.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Abra o PayPal para aprovar ${formatMoney(quote.totalAmount, quote.currency, locale)}.`,
        intent: match.intent,
        cards: [{ id: payment.id, kind: 'payment', title: 'Pagamento PayPal', subtitle: invite.campeonato.nome, badges: ['Reserva temporária'], details: [
          { label: 'Valor-base', value: formatMoney(baseCents / 100, 'BRL', locale) },
          { label: 'Total PayPal', value: formatMoney(quote.totalAmount, quote.currency, locale) },
          { label: 'Moeda', value: quote.currency },
          { label: 'Reserva', value: reservation.codigo },
          { label: 'Validade', value: new Date(reservation.expira_em).toLocaleString('pt-BR') },
        ], actions: [{ id: 'open-paypal', label: 'Abrir PayPal', href: payment.paypal_approval_url, variant: 'primary' }] }],
        actions: [
          { id: 'check-paypal', label: 'Já paguei, verificar', message: 'Verificar pagamento PayPal', intent: 'verificar_pagamento_convite_grupo', variant: 'secondary', context: nextContext },
          { id: 'cancel-paypal', label: 'Voltar', message: 'Voltar uma etapa', intent: 'voltar_etapa', variant: 'secondary', context: nextContext },
        ],
        context: nextContext, source: 'system',
      }
      return response
    }

    case 'capturar_paypal_convite_grupo': {
      if (!user || !context.reservationId || !context.paypalOrderId) throw new Error('Retorno do PayPal incompleto.')
      const payment = await captureLiliPayPalOrder({ orderId: context.paypalOrderId, reservationId: context.reservationId, authUserId: user.id })
      if (!isPaidStatus(payment.status)) {
        response = { reply: 'O PayPal ainda não confirmou a captura. Tente verificar novamente em alguns segundos.', intent: match.intent, actions: [{ id: 'retry-paypal-capture', label: 'Verificar novamente', message: 'Verificar pagamento PayPal', intent: 'verificar_pagamento_convite_grupo', variant: 'primary', context }], context, source: 'system' }
        return response
      }
      const result = await confirmGroupInviteInChat(req, context)
      await confirmLiliReservation(context.reservationId)
      response = {
        reply: 'Pagamento PayPal e inscrição confirmados com sucesso.', intent: match.intent,
        enrollmentConfirmed: true,
        cards: [{ id: String(result?.campeonato_equipe_id || context.reservationId), kind: 'summary', title: 'Comprovante de inscrição', subtitle: 'Pagamento confirmado pelo PayPal', details: [
          { label: 'Campeonato', value: String(result?.campeonato?.nome || 'Confirmado') },
          { label: 'Grupo', value: String(result?.grupo?.nome || context.inviteGroupId || 'Confirmado') },
          { label: 'Line', value: String(result?.line?.nome || context.selectedLineName || 'Confirmada') },
          { label: 'Slot', value: String(result?.slot?.slot_letra || result?.slot?.slot_numero || context.selectedSlotLabel || 'Confirmado') },
          { label: 'Pagamento', value: `PAYPAL ${context.currency || 'BRL'}` },
          { label: 'Protocolo', value: String(context.reservationCode || result?.campeonato_equipe_id || 'Gerado') },
        ] }], actions: menuActions(locale), context: { locale }, source: 'system',
      }
      return response
    }

    case 'confirmar_convite_grupo': {
      if (!user) {
        response = { reply: 'Entre na conta para confirmar a inscrição.', intent: match.intent, requiresAuth: true, context, source: 'system' }
        return response
      }
      const result = await confirmGroupInviteInChat(req, context)
      response = {
        reply: result?.mensagem || 'Inscrição concluída com sucesso.',
        enrollmentConfirmed: true,
        intent: match.intent,
        cards: [{
          id: String(result?.campeonato_equipe_id || crypto.randomUUID()),
          kind: 'summary',
          title: 'Comprovante de inscrição',
          subtitle: 'Inscrição confirmada pela Lili',
          details: [
            { label: 'Campeonato', value: String(result?.campeonato?.nome || 'Confirmado') },
            { label: 'Grupo', value: String(result?.grupo?.nome || context.inviteGroupId || 'Confirmado') },
            { label: 'Line', value: String(result?.line?.nome || context.selectedLineName || 'Confirmada') },
            { label: 'Slot', value: String(result?.slot?.slot_letra || result?.slot?.slot_numero || context.selectedSlotLabel || 'Confirmado') },
            { label: 'Status', value: 'Ativa' },
            { label: 'Protocolo', value: String(result?.campeonato_equipe_id || 'Gerado pelo sistema') },
          ],
        }],
        actions: [
          { id: 'my-registrations-after-group', label: 'Ver minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes', variant: 'primary', context: { locale } },
          { id: 'view-rules-after-group', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: context.selectedChampionshipId } },
          { id: 'menu-after-group', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
        ],
        context: { locale },
        source: 'system',
      }
      return response
    }
  }
  return response
}
