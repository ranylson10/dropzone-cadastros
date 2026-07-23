import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getActiveAccount, getBearerUser } from '@backend/auth/server-auth'
import { AsaasNotConfiguredError } from '@backend/billing/asaas'
import { claimVacancyPurchase, createVacancyPurchase, loadClaimContext } from '@backend/billing/vacancy-purchase'
import { detectLiliLocale, resolveLiliIntent } from '@/features/lili/intent-router'
import { localizeLiliResponse, normalizeLocale } from '@/features/lili/i18n'
import { createInternationalQuote, formatMoney } from '@/features/lili/currency'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import {
  buildRegistrationSummary,
  championshipCards,
  getChampionshipDetails,
  resolveExistingInvite,
  lineCards,
  listOpenChampionships,
  listUserRegistrations,
  listUserTeams,
  paymentCard,
  registrationCards,
  slotCards,
  teamCards,
} from '@/features/lili/tools'
import type { LiliChatResponse, LiliClientContext, LiliCurrency, LiliIntent, LiliLocale } from '@/features/lili/types'

async function optionalUser(req: NextRequest) {
  try { return await getBearerUser(req) } catch { return null }
}

function menuActions(locale: LiliLocale) {
  return [
    { id: 'open-championships', label: 'Campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos' as LiliIntent, variant: 'primary' as const, context: { locale } },
    { id: 'register', label: 'Fazer inscrição', message: 'Quero fazer uma inscrição', intent: 'iniciar_inscricao' as LiliIntent, variant: 'primary' as const, context: { locale } },
    { id: 'my-teams', label: 'Minhas equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes' as LiliIntent, variant: 'secondary' as const, context: { locale } },
    { id: 'my-registrations', label: 'Minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes' as LiliIntent, variant: 'secondary' as const, context: { locale } },
    { id: 'international-payment', label: 'Pagamento internacional', message: 'Simular pagamento internacional', intent: 'simular_pagamento_internacional' as LiliIntent, variant: 'secondary' as const, context: { locale } },
    { id: 'language', label: 'Idioma / Language', message: 'Mudar idioma', intent: 'alterar_idioma' as LiliIntent, variant: 'secondary' as const, context: { locale } },
  ]
}

function languageActions() {
  return [
    { id: 'lang-pt', label: 'Português', message: 'Português', intent: 'menu' as LiliIntent, variant: 'secondary' as const, context: { locale: 'pt-BR' as const } },
    { id: 'lang-es', label: 'Español', message: 'Español', intent: 'menu' as LiliIntent, variant: 'secondary' as const, context: { locale: 'es' as const } },
    { id: 'lang-en', label: 'English', message: 'English', intent: 'menu' as LiliIntent, variant: 'secondary' as const, context: { locale: 'en' as const } },
  ]
}


function registrationContext(context: LiliClientContext, patch: Partial<LiliClientContext> = {}): LiliClientContext {
  return { ...context, ...patch, currentFlow: 'registration' }
}

function flowControlActions(context: LiliClientContext) {
  return [
    { id: 'back-step', label: 'Voltar uma etapa', message: 'Voltar uma etapa', intent: 'voltar_etapa' as LiliIntent, variant: 'secondary' as const, context },
    { id: 'cancel-flow', label: 'Cancelar operação', message: 'Cancelar operação', intent: 'cancelar_fluxo' as LiliIntent, variant: 'secondary' as const, context },
  ]
}

function previousRegistrationContext(context: LiliClientContext): LiliClientContext {
  switch (context.currentStep) {
    case 'team':
      return registrationContext({ locale: context.locale }, { currentStep: 'championship' })
    case 'payment':
    case 'payment_wait':
      return registrationContext({ locale: context.locale, selectedChampionshipId: context.selectedChampionshipId }, { currentStep: 'team' })
    case 'line':
    case 'line_name':
      return registrationContext({ ...context, selectedLineId: null, selectedLineName: null, awaitingLineName: false }, { currentStep: 'payment_wait' })
    case 'slot':
      return registrationContext({ ...context, selectedSlotId: null, selectedSlotLabel: null }, { currentStep: 'line' })
    case 'confirm':
      return registrationContext({ ...context, selectedSlotId: null, selectedSlotLabel: null }, { currentStep: 'slot' })
    default:
      return { locale: context.locale }
  }
}

async function claimContext(req: NextRequest, context: LiliClientContext) {
  const user = await getBearerUser(req)
  const accounts = await getAccountsForUser(user)
  if (!context.purchaseToken) throw new Error('Pagamento não localizado nesta conversa.')
  return loadClaimContext({
    token: context.purchaseToken,
    authUserId: user.id,
    accounts,
    equipeId: context.selectedTeamId || null,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = String(body?.message || '').trim().slice(0, 1000)
    const forcedIntent = String(body?.intent || '').trim() as LiliIntent
    let context: LiliClientContext = body?.context && typeof body.context === 'object' ? body.context : {}
    if (!message && !forcedIntent) return NextResponse.json({ error: 'Mensagem ausente.' }, { status: 400 })

    const user = await optionalUser(req)
    let match: {
      intent: LiliIntent
      confidence: number
      source: 'rule' | 'pattern' | 'gemini' | 'system'
      searchTerm?: string
      locale?: LiliLocale
    } = forcedIntent
      ? { intent: forcedIntent, confidence: 1, source: 'system', searchTerm: undefined }
      : await resolveLiliIntent(message)

    const requestedLocale = body?.context?.locale || context.locale || match.locale || detectLiliLocale(message)
    const locale = normalizeLocale(requestedLocale)
    context = { ...context, locale }

    if (context.awaitingLineName && !forcedIntent && message) {
      context = registrationContext(context, { selectedLineId: null, selectedLineName: message, awaitingLineName: false, currentStep: 'slot' })
      match = { intent: 'selecionar_line_inscricao', confidence: 1, source: 'system' as const, searchTerm: undefined }
    }

    if (context.awaitingInviteToken && !forcedIntent && message) {
      context = { ...context, inviteToken: message, awaitingInviteToken: false, currentFlow: 'registration_token', currentStep: 'token' }
      match = { intent: 'validar_token_inscricao', confidence: 1, source: 'system' as const, searchTerm: undefined }
    }

    let response: LiliChatResponse

    switch (match.intent) {
      case 'menu':
        response = {
          reply: user ? 'Como posso ajudar agora?' : 'Olá! Sou a Lili, assistente do DropZone. Posso mostrar informações públicas agora e pedir seu login apenas quando os dados forem privados.',
          intent: 'menu', actions: menuActions(locale), context: { locale }, source: match.source,
        }
        break

      case 'listar_campeonatos_abertos': {
        const items = await listOpenChampionships()
        response = {
          reply: items.length ? `Encontrei ${items.length} campeonato${items.length === 1 ? '' : 's'} com vagas abertas.` : 'Não encontrei campeonatos com vagas abertas neste momento.',
          intent: match.intent,
          cards: championshipCards(items, false, locale),
          actions: [
            { id: 'buy-list', label: 'Comprar uma vaga', message: 'Quero comprar uma vaga', intent: 'comprar_vaga', variant: 'primary', context: { locale } },
            { id: 'register-token', label: 'Já tenho convite ou token', message: 'Já tenho um token de inscrição', intent: 'iniciar_inscricao', variant: 'secondary', context: { locale } },
            { id: 'menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' },
          ],
          context: { locale },
          source: match.source,
        }
        break
      }

      case 'abrir_campeonato': {
        if (!context.selectedChampionshipId) throw new Error('Campeonato não informado.')
        const item = await getChampionshipDetails(context.selectedChampionshipId)
        const details = [
          item.plataforma ? { label: 'Plataforma', value: String(item.plataforma) } : null,
          item.servidor ? { label: 'Servidor', value: String(item.servidor) } : null,
          item.valor_inscricao != null ? { label: 'Inscrição', value: `R$ ${Number(item.valor_inscricao).toFixed(2).replace('.', ',')}` } : null,
          { label: 'Vagas livres', value: String(item.vagas_livres || 0) },
          item.data_limite_inscricao ? { label: 'Prazo', value: new Date(item.data_limite_inscricao).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR') } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>
        const canBuy = Boolean(item.aceita_novas_inscricoes_equipes && Number(item.vagas_livres || 0) > 0)
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
            actions: [{ id: `public-${item.id}`, label: 'Abrir página do campeonato', href: `/campeonatos/${item.id}`, variant: 'secondary' }],
          }],
          actions: [
            ...(canBuy ? [{ id: `buy-${item.id}`, label: 'Comprar vaga', message: `Comprar vaga em ${item.nome}`, intent: 'comprar_vaga' as const, variant: 'primary' as const, context: { locale, selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase' } }] : []),
            { id: `token-${item.id}`, label: 'Usar convite ou token', message: 'Já tenho um token de inscrição', intent: 'iniciar_inscricao', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
            { id: 'back-open', label: 'Voltar aos campeonatos', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'secondary', context: { locale } },
          ],
          context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship' },
          source: 'system',
        }
        break
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
        break
      }

      case 'listar_minhas_equipes': {
        if (!user) {
          response = { reply: 'Para mostrar suas equipes, preciso confirmar sua identidade.', intent: match.intent, requiresAuth: true, source: match.source }
          break
        }
        const teams = await listUserTeams(user)
        response = {
          reply: teams.length ? `Encontrei ${teams.length} equipe${teams.length === 1 ? '' : 's'} que você pode acessar.` : 'Sua conta ainda não possui equipe vinculada.',
          intent: match.intent,
          cards: teamCards(teams),
          actions: menuActions(locale),
          source: match.source,
        }
        break
      }


      case 'listar_minhas_inscricoes': {
        if (!user) {
          response = { reply: 'Para consultar suas inscrições, preciso confirmar sua identidade.', intent: match.intent, requiresAuth: true, context: { currentFlow: 'registrations' }, source: match.source }
          break
        }
        const registrations = await listUserRegistrations(user)
        response = {
          reply: registrations.length
            ? `Encontrei ${registrations.length} inscrição${registrations.length === 1 ? '' : 'ões'} vinculada${registrations.length === 1 ? '' : 's'} às equipes que você administra.`
            : 'Não encontrei inscrições vinculadas às equipes que você administra.',
          intent: match.intent,
          cards: registrationCards(registrations),
          actions: [
            { id: 'register-new', label: 'Fazer nova inscrição', message: 'Quero fazer uma nova inscrição', intent: 'iniciar_inscricao', variant: 'primary' },
            { id: 'menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' },
          ],
          context: { locale },
          source: match.source,
        }
        break
      }

      case 'iniciar_inscricao': {
        const tokenContext: LiliClientContext = {
          locale,
          selectedChampionshipId: context.selectedChampionshipId || null,
          currentFlow: 'registration_token',
          currentStep: 'token',
          awaitingInviteToken: true,
        }
        response = {
          reply: context.selectedChampionshipId
            ? 'Para entrar neste campeonato, cole o link de convite ou digite o token recebido do organizador.'
            : 'Cole o link de convite ou digite o token recebido do organizador. Cada convite continua preso ao campeonato, grupo ou slot definido quando foi criado.',
          intent: match.intent,
          actions: [
            { id: 'no-token', label: 'Não tenho token', message: 'Não tenho token', intent: 'comprar_vaga', variant: 'primary', context: { locale, selectedChampionshipId: context.selectedChampionshipId || null, currentFlow: 'vacancy_purchase' } },
            { id: 'open-spots', label: 'Ver campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'secondary', context: { locale } },
            { id: 'cancel-token', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: tokenContext },
          ],
          context: tokenContext,
          source: 'system',
        }
        break
      }

      case 'validar_token_inscricao': {
        const invite = await resolveExistingInvite(context.inviteToken || message)
        response = {
          reply: context.autoOpenInvite
            ? 'Convite validado. Vou abrir agora a próxima etapa correta.'
            : 'Convite localizado. Continue pelo fluxo original do sistema, com todas as regras já existentes.',
          intent: match.intent,
          cards: [{
            id: invite.token,
            kind: 'summary',
            title: invite.title,
            details: [
              { label: 'Token', value: invite.token },
              { label: 'Destino', value: invite.href },
            ],
            actions: [{ id: 'open-existing-invite', label: 'Continuar inscrição', href: invite.href, variant: 'primary' }],
          }],
          actions: [
            { id: 'another-token', label: 'Usar outro token', message: 'Quero usar outro token', intent: 'iniciar_inscricao', variant: 'secondary', context: { locale } },
            { id: 'menu-token', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
          ],
          context: { locale, inviteToken: invite.token, inviteHref: invite.href, autoOpenInvite: Boolean(context.autoOpenInvite) },
          source: 'system',
        }
        break
      }

      case 'comprar_vaga': {
        if (!context.selectedChampionshipId) {
          const items = await listOpenChampionships()
          response = {
            reply: items.length ? 'Escolha o campeonato em que deseja comprar uma vaga.' : 'Não há campeonatos com vagas disponíveis para compra agora.',
            intent: match.intent,
            cards: championshipCards(items, true, locale),
            actions: [
              { id: 'have-token', label: 'Já tenho token', message: 'Já tenho um token de inscrição', intent: 'iniciar_inscricao', variant: 'secondary', context: { locale } },
              { id: 'menu-buy', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
            ],
            context: { locale, currentFlow: 'vacancy_purchase' },
            source: 'system',
          }
          break
        }
        const item = await getChampionshipDetails(context.selectedChampionshipId)
        if (!item.aceita_novas_inscricoes_equipes || Number(item.vagas_livres || 0) <= 0) {
          response = {
            reply: 'Este campeonato não possui vaga disponível para compra neste momento.',
            intent: match.intent,
            actions: [{ id: 'other-spots', label: 'Ver outros campeonatos', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'primary', context: { locale } }],
            context: { locale },
            source: 'system',
          }
          break
        }
        response = {
          reply: `A compra da vaga de ${item.nome} será feita na tela de vagas que já existe no sistema. Depois do pagamento, o próprio fluxo gera e controla a autorização para este campeonato.`,
          intent: match.intent,
          cards: [{
            id: item.id,
            kind: 'championship',
            title: item.nome,
            imageUrl: item.logo_url || item.banner_url || null,
            badges: [`${item.vagas_livres} vaga${Number(item.vagas_livres) === 1 ? '' : 's'} disponível${Number(item.vagas_livres) === 1 ? '' : 'is'}`],
            details: item.valor_inscricao != null ? [{ label: 'Valor', value: `R$ ${Number(item.valor_inscricao).toFixed(2).replace('.', ',')}` }] : undefined,
            actions: [{ id: 'open-buy-page', label: 'Comprar esta vaga', href: `/vagas?comprar=${encodeURIComponent(item.id)}`, variant: 'primary' }],
          }],
          actions: [
            { id: 'have-token-selected', label: 'Já tenho convite', message: 'Já tenho um token de inscrição', intent: 'iniciar_inscricao', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
            { id: 'other-buy', label: 'Escolher outro campeonato', message: 'Quero comprar uma vaga', intent: 'comprar_vaga', variant: 'secondary', context: { locale } },
          ],
          context: { locale, selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase' },
          source: 'system',
        }
        break
      }

      case 'iniciar_pagamento_inscricao': {
        if (!user) {
          response = { reply: 'Para gerar o pagamento, preciso que você entre na sua conta.', intent: match.intent, requiresAuth: true, context, source: 'system' }
          break
        }
        if (!context.selectedChampionshipId || !context.selectedTeamId) throw new Error('Escolha o campeonato e a equipe antes de gerar o pagamento.')
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
          })],
          actions: [
            { id: 'check-payment', label: 'Já paguei, verificar', message: 'Verificar pagamento', intent: 'verificar_pagamento_inscricao', variant: 'primary', context: nextContext },
            { id: 'menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' },
          ],
          context: nextContext,
          source: 'system',
        }
        break
      }

      case 'verificar_pagamento_inscricao': {
        if (!user) {
          response = { reply: 'Entre na conta para verificar este pagamento.', intent: match.intent, requiresAuth: true, context, source: 'system' }
          break
        }
        const data = await claimContext(req, context)
        if (!data.liberado && !data.consumido) {
          response = {
            reply: 'O pagamento ainda não foi confirmado. Aguarde alguns segundos e tente novamente.',
            intent: match.intent,
            cards: data.payment ? [paymentCard({
              token: data.compra.token,
              status: data.payment.status,
              valueCents: data.payment.valor_centavos,
              invoiceUrl: data.payment.invoice_url,
              pixPayload: data.payment.pix_payload,
            })] : undefined,
            actions: [{ id: 'check-again', label: 'Verificar novamente', message: 'Verificar pagamento novamente', intent: 'verificar_pagamento_inscricao', variant: 'primary', context }],
            context,
            source: 'system',
          }
          break
        }
        if (data.consumido) {
          response = { reply: 'Esta compra já foi usada e a inscrição já está concluída.', intent: match.intent, actions: menuActions(locale), context: { locale }, source: 'system' }
          break
        }
        const nextContext = registrationContext(context, { currentStep: 'line' })
        response = {
          reply: data.lines?.length ? 'Pagamento confirmado. Agora escolha a line que vai representar sua equipe.' : 'Pagamento confirmado. Sua equipe ainda não possui uma line disponível para este campeonato. Digite o nome da nova line.',
          intent: match.intent,
          cards: data.lines?.length ? lineCards(data.lines, nextContext) : undefined,
          actions: data.lines?.length
            ? [
                { id: 'new-line', label: 'Criar nova line', message: 'Quero criar uma nova line', intent: 'criar_line_inscricao', variant: 'secondary', context: nextContext },
                ...flowControlActions(nextContext),
              ]
            : flowControlActions(registrationContext(nextContext, { awaitingLineName: true, currentStep: 'line_name' })),
          context: data.lines?.length ? nextContext : registrationContext(nextContext, { awaitingLineName: true, currentStep: 'line_name' }),
          source: 'system',
        }
        break
      }

      case 'criar_line_inscricao':
        response = {
          reply: 'Digite o nome da nova line. Depois eu vou mostrar os slots livres.',
          intent: match.intent,
          actions: flowControlActions(registrationContext(context, { awaitingLineName: true, selectedLineId: null, selectedLineName: null, currentStep: 'line_name' })),
          context: registrationContext(context, { awaitingLineName: true, selectedLineId: null, selectedLineName: null, currentStep: 'line_name' }),
          source: 'system',
        }
        break

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
        break
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
        break
      }

      case 'confirmar_inscricao': {
        if (!user) {
          response = { reply: 'Entre na conta para confirmar a inscrição.', intent: match.intent, requiresAuth: true, context, source: 'system' }
          break
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
        response = {
          reply: result.mensagem || 'Inscrição concluída com sucesso.',
          intent: match.intent,
          cards: [{ id: result.campeonato_equipe_id, kind: 'summary', title: 'Inscrição confirmada', details: [
            { label: 'Line', value: result.line.nome },
            { label: 'Slot', value: result.slot.slot_letra || String(result.slot.slot_numero) },
            { label: 'Status', value: 'Ativa' },
          ] }],
          actions: menuActions(locale),
          context: { locale },
          source: 'system',
        }
        break
      }


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
          break
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
        break
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
          break
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
        break
      }

      case 'reiniciar_conversa':
        response = {
          reply: 'Conversa reiniciada. Apaguei apenas o contexto temporário deste atendimento; nenhum dado salvo no sistema foi removido.',
          intent: match.intent,
          actions: menuActions(locale),
          context: { locale },
          source: 'system',
        }
        break

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
        break

      case 'voltar_etapa': {
        if (context.currentFlow !== 'registration') {
          response = {
            reply: 'Você já está no início. Escolha o que deseja fazer.',
            intent: match.intent,
            actions: menuActions(locale),
            context: { locale },
            source: 'system',
          }
          break
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
          break
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
        break
      }

      case 'alterar_idioma':
        response = {
          reply: 'Escolha o idioma da conversa.',
          intent: match.intent,
          actions: languageActions(),
          context: { ...context, locale },
          source: 'system',
        }
        break

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

    const localized = await localizeLiliResponse({ ...response, context: { ...(response.context || {}), locale } }, locale)
    return NextResponse.json(localized)
  } catch (error: any) {
    if (error instanceof AsaasNotConfiguredError || error?.name === 'AsaasNotConfiguredError') {
      return NextResponse.json({ error: error.message || 'O pagamento online ainda não está configurado.' }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'A Lili não conseguiu concluir esta consulta.' }, { status: 400 })
  }
}
