import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getActiveAccount, getBearerUser } from '@backend/auth/server-auth'
import { AsaasNotConfiguredError, isPaidStatus } from '@backend/billing/asaas'
import { reserveSlotForLili, confirmLiliReservation } from '@backend/billing/lili-slot-reservation'
import { createLiliAsaasPayment, getLiliPaymentStatus } from '@backend/billing/lili-payment'
import { captureLiliPayPalOrder, captureVacancyPayPalOrder, createLiliPayPalOrder, getLiliPayPalPaymentStatus, getVacancyPayPalPaymentStatus, paypalConfigured } from '@backend/billing/paypal'
import { listAgenda } from '@backend/agenda/agenda.service'
import { claimVacancyPurchase, createVacancyPurchase, loadClaimContext } from '@backend/billing/vacancy-purchase'
import { detectLiliLocale, resolveLiliIntent } from '@/features/lili/intent-router'
import { localizeLiliResponse, normalizeLocale } from '@/features/lili/i18n'
import { createInternationalQuote, formatMoney } from '@/features/lili/currency'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import {
  agendaCards,
  buildRegistrationSummary,
  championshipCards,
  getChampionshipDetails,
  getPublishedChampionshipRulebook,
  findRulebookAnswers,
  resolveExistingInvite,
  lineCards,
  listOpenChampionships,
  listUserRegistrations,
  listUserTeams,
  paymentCard,
  registrationCards,
  rulebookTopicCards,
  rulebookTopicDetailCard,
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
    { id: 'use-invite', label: 'Usar convite ou token', message: 'Tenho um convite ou token', intent: 'usar_convite_token' as LiliIntent, variant: 'secondary' as const, context: { locale } },
    { id: 'my-teams', label: 'Minhas equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes' as LiliIntent, variant: 'secondary' as const, context: { locale } },
    { id: 'my-registrations', label: 'Minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes' as LiliIntent, variant: 'secondary' as const, context: { locale } },
    { id: 'account-summary', label: 'Minha central', message: 'Mostrar resumo da minha conta', intent: 'resumo_minha_conta' as LiliIntent, variant: 'secondary' as const, context: { locale } },
    { id: 'upcoming-games', label: 'Próximos jogos', message: 'Mostrar meus próximos jogos', intent: 'listar_proximos_jogos' as LiliIntent, variant: 'secondary' as const, context: { locale } },
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


function looksLikeInviteToken(value: string) {
  const token = value.trim()
  if (token.length < 8 || token.length > 240 || /\s/.test(token)) return false
  if (/^https?:\/\//i.test(token)) return true
  return /^[a-z0-9_-]+$/i.test(token) && /[0-9]/.test(token)
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

function forwardedAuthHeaders(req: NextRequest) {
  const headers = new Headers()
  const authorization = req.headers.get('authorization')
  const cookie = req.headers.get('cookie')
  if (authorization) headers.set('authorization', authorization)
  if (cookie) headers.set('cookie', cookie)
  headers.set('content-type', 'application/json')
  return headers
}

async function loadGroupInviteInChat(req: NextRequest, token: string, equipeId?: string | null) {
  const url = new URL(`/api/convites/grupo/${encodeURIComponent(token)}`, req.nextUrl.origin)
  if (equipeId) url.searchParams.set('equipe_id', equipeId)
  const response = await fetch(url, { method: 'GET', headers: forwardedAuthHeaders(req), cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar este convite.')
  return data
}

async function confirmGroupInviteInChat(req: NextRequest, context: LiliClientContext) {
  if (!context.inviteToken) throw new Error('Convite não localizado nesta conversa.')
  const url = new URL(`/api/convites/grupo/${encodeURIComponent(context.inviteToken)}`, req.nextUrl.origin)
  const response = await fetch(url, {
    method: 'POST',
    headers: forwardedAuthHeaders(req),
    body: JSON.stringify({
      equipe_id: context.selectedTeamId,
      line_id: context.selectedLineId || null,
      nome_line: context.selectedLineId ? null : context.selectedLineName || null,
      slot_id: context.selectedSlotId,
    }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'Não foi possível concluir a inscrição.')
  return data
}

function groupInviteSummaryCard(invite: any, token: string) {
  const expiresAt = invite?.link?.expira_em
  const expiration = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Sem data definida'
  const remaining = Number(invite?.resumo_link?.restantes ?? 0)
  const freeSlots = Number(invite?.resumo_grupo?.livres ?? 0)
  return {
    id: `group-invite-${token}`,
    kind: 'championship' as const,
    title: String(invite?.campeonato?.nome || 'Convite de campeonato'),
    subtitle: String(invite?.grupo?.nome || 'Grupo definido pelo convite'),
    imageUrl: invite?.campeonato?.logo_url || null,
    badges: [
      invite?.inscricao_aberta ? 'Convite ativo' : 'Inscrição indisponível',
      `${freeSlots} ${freeSlots === 1 ? 'slot livre' : 'slots livres'}`,
    ],
    details: [
      { label: 'Grupo', value: String(invite?.grupo?.nome || 'Definido pelo convite') },
      { label: 'Validade', value: expiration },
      { label: 'Vagas restantes neste convite', value: String(remaining) },
      { label: 'Status', value: invite?.status_mensagem || (invite?.inscricao_aberta ? 'Disponível para inscrição' : 'Indisponível') },
    ],
    actions: [] as Array<{ id: string; label: string; message?: string; intent?: LiliIntent; variant?: 'primary' | 'secondary'; context?: LiliClientContext }>,
  }
}

function groupTeamCards(items: any[], context: LiliClientContext) {
  return items.map((item) => ({
    id: String(item.id),
    kind: 'team' as const,
    title: String(item.nome || 'Equipe'),
    subtitle: item.tag ? String(item.tag) : null,
    imageUrl: item.logo_url || null,
    badges: item.inscrita_no_grupo ? ['Já inscrita neste grupo'] : [],
    actions: item.inscrita_no_grupo ? [] : [{
      id: `group-team-${item.id}`,
      label: 'Usar esta equipe',
      message: `Usar a equipe ${item.nome}`,
      intent: 'selecionar_equipe_convite_grupo' as LiliIntent,
      variant: 'primary' as const,
      context: { ...context, selectedTeamId: String(item.id), currentStep: 'team' },
    }],
  }))
}

function groupLineCards(availableItems: any[], registeredItems: any[], context: LiliClientContext) {
  const available = availableItems.map((item) => ({
    id: String(item.id),
    kind: 'line' as const,
    title: String(item.nome || 'Line'),
    subtitle: item.tag ? String(item.tag) : null,
    imageUrl: item.logo_url || null,
    badges: ['Disponível para inscrição'],
    actions: [{
      id: `group-line-${item.id}`,
      label: 'Usar esta line',
      message: `Usar a line ${item.nome}`,
      intent: 'selecionar_line_convite_grupo' as LiliIntent,
      variant: 'primary' as const,
      context: { ...context, selectedLineId: String(item.id), selectedLineName: String(item.nome || ''), currentStep: 'line' },
    }],
  }))

  const registered = registeredItems.map((item) => ({
    id: `registered-${item.id}`,
    kind: 'line' as const,
    title: String(item.nome || item.nome_exibicao || 'Line'),
    subtitle: item.tag ? String(item.tag) : null,
    imageUrl: item.logo_url || null,
    badges: ['Já inscrita neste campeonato'],
    details: [
      ...(item.grupo_id ? [{ label: 'Grupo', value: String(item.grupo_nome || 'Já definido') }] : []),
      ...(item.slot_numero ? [{ label: 'Slot', value: String(item.slot_numero) }] : []),
    ],
    actions: [],
  }))

  return [...available, ...registered]
}

function groupSlotCards(items: any[], context: LiliClientContext) {
  return items
    .filter((item) => item.slot_id)
    .map((item) => {
      const label = item.slot_letra || item.slot_numero || item.nome || 'Slot'
      const occupied = Boolean(item.ocupada)
      const occupant = [item.equipe_nome, item.line_nome].filter(Boolean).join(' • ')
      return {
        id: String(item.slot_id),
        kind: 'slot' as const,
        title: `Slot ${label}`,
        subtitle: occupied ? (occupant || 'Ocupado') : 'Disponível',
        imageUrl: item.logo_url || null,
        badges: [occupied ? 'Ocupado' : 'Livre'],
        details: occupied && occupant ? [{ label: 'Inscrição atual', value: occupant }] : [],
        actions: occupied ? [] : [{
          id: `group-slot-${item.slot_id}`,
          label: 'Escolher',
          message: `Escolher o slot ${label}`,
          intent: 'selecionar_slot_convite_grupo' as LiliIntent,
          variant: 'primary' as const,
          context: { ...context, selectedSlotId: String(item.slot_id), selectedSlotLabel: String(label), currentStep: 'slot' },
        }],
      }
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

    if (context.awaitingGroupLineName && !forcedIntent && message) {
      context = { ...context, selectedLineId: null, selectedLineName: message, awaitingGroupLineName: false, currentFlow: 'group_invite', currentStep: 'slot' }
      match = { intent: 'selecionar_line_convite_grupo', confidence: 1, source: 'system' as const, searchTerm: undefined }
    }

    if (context.awaitingPaymentDocument && !forcedIntent && message) {
      context = { ...context, paymentDocument: message.replace(/\D/g, ''), awaitingPaymentDocument: false }
      match = { intent: context.selectedPaymentMethod === 'cartao' ? 'pagar_cartao_convite_grupo' : 'pagar_pix_convite_grupo', confidence: 1, source: 'system' as const, searchTerm: undefined }
    }

    if (!forcedIntent && !context.awaitingLineName && !context.awaitingInviteToken && looksLikeInviteToken(message)) {
      context = { ...context, inviteToken: message, awaitingInviteToken: false, currentFlow: 'invite_token', currentStep: 'token' }
      match = { intent: 'validar_token_inscricao', confidence: 1, source: 'system' as const, searchTerm: undefined }
    }

    if (context.awaitingInviteToken && !forcedIntent && message) {
      context = { ...context, inviteToken: message, awaitingInviteToken: false, currentFlow: 'registration_token', currentStep: 'token' }
      match = { intent: 'validar_token_inscricao', confidence: 1, source: 'system' as const, searchTerm: undefined }
    }

    if (context.awaitingRuleQuestion && !forcedIntent && message) {
      context = { ...context, awaitingRuleQuestion: false, ruleQuestion: message, currentFlow: 'championship_rules', currentStep: 'answer_rule' }
      match = { intent: 'perguntar_regra_campeonato', confidence: 1, source: 'system' as const, searchTerm: undefined }
    }

    if (!forcedIntent && match.intent === 'desconhecido' && context.selectedChampionshipId && context.currentFlow === 'championship_rules' && message) {
      context = { ...context, awaitingRuleQuestion: false, ruleQuestion: message, currentStep: 'answer_rule' }
      match = { intent: 'perguntar_regra_campeonato', confidence: 1, source: 'system' as const, searchTerm: undefined }
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
            { id: 'register-token', label: 'Já tenho convite ou token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
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
            { id: `rules-${item.id}`, label: 'Ver regras por tópico', message: `Ver regulamento de ${item.nome}`, intent: 'ver_regulamento_campeonato', variant: 'secondary', context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship_rules' } },
            { id: `token-${item.id}`, label: 'Usar convite ou token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
            { id: 'back-open', label: 'Voltar aos campeonatos', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'secondary', context: { locale } },
          ],
          context: { locale, selectedChampionshipId: item.id, currentFlow: 'championship' },
          source: 'system',
        }
        break
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
          break
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
          break
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
        break
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
          break
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
          break
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
        break
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
          break
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
          break
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
          break
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
        const championshipCount = new Set(registrations.map((item: any) => item.campeonato?.id || item.campeonato_id).filter(Boolean)).size
        const registrationsReply = locale === 'en'
          ? `I found ${registrations.length} registration${registrations.length === 1 ? '' : 's'} across ${championshipCount} tournament${championshipCount === 1 ? '' : 's'}. Lines from the same tournament are grouped together.`
          : locale === 'es'
            ? `Encontré ${registrations.length} inscripción${registrations.length === 1 ? '' : 'es'} en ${championshipCount} campeonato${championshipCount === 1 ? '' : 's'}. Las lines del mismo campeonato aparecen agrupadas.`
            : `Encontrei ${registrations.length} inscrição${registrations.length === 1 ? '' : 'ões'} em ${championshipCount} campeonato${championshipCount === 1 ? '' : 's'}. As lines do mesmo campeonato aparecem agrupadas.`
        response = {
          reply: registrations.length
            ? registrationsReply
            : locale === 'en'
              ? 'I did not find registrations linked to teams you manage.'
              : locale === 'es'
                ? 'No encontré inscripciones vinculadas a los equipos que administras.'
                : 'Não encontrei inscrições vinculadas às equipes que você administra.',
          intent: match.intent,
          cards: registrationCards(registrations, locale),
          actions: [
            { id: 'register-new', label: 'Fazer nova inscrição', message: 'Quero fazer uma nova inscrição', intent: 'iniciar_inscricao', variant: 'primary' },
            { id: 'menu', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' },
          ],
          context: { locale },
          source: match.source,
        }
        break
      }


      case 'resumo_minha_conta': {
        if (!user) {
          response = {
            reply: locale === 'en'
              ? 'To open your account overview, I need to confirm your identity.'
              : locale === 'es'
                ? 'Para abrir el resumen de tu cuenta, necesito confirmar tu identidad.'
                : 'Para abrir o resumo da sua conta, preciso confirmar sua identidade.',
            intent: match.intent,
            requiresAuth: true,
            context: { locale, currentFlow: 'account_summary' },
            source: match.source,
          }
          break
        }

        const today = new Date()
        const end = new Date(today)
        end.setDate(end.getDate() + 90)
        const isoDate = (value: Date) => value.toISOString().slice(0, 10)
        const [teams, registrations, agenda] = await Promise.all([
          listUserTeams(user),
          listUserRegistrations(user),
          listAgenda({ scope: 'me', from: isoDate(today), to: isoDate(end), authUserId: user.id }),
        ])
        const championshipIds = new Set(registrations.map((item: any) => String(item.campeonato?.id || item.campeonato_id || '')).filter(Boolean))
        const pendingCount = registrations.filter((item: any) => String(item.status || '').toLowerCase() !== 'ativo').length
        const nextMatch = (agenda.items || []).find((item: any) => item.source === 'jogo')
        const labels = locale === 'en'
          ? { teams: 'Teams managed', championships: 'Tournaments', registrations: 'Registrations', pending: 'Pending review', next: 'Next match', none: 'No match scheduled', title: 'Your DropZone overview' }
          : locale === 'es'
            ? { teams: 'Equipos administrados', championships: 'Campeonatos', registrations: 'Inscripciones', pending: 'Pendientes', next: 'Próximo partido', none: 'Ningún partido programado', title: 'Resumen de tu cuenta DropZone' }
            : { teams: 'Equipes administradas', championships: 'Campeonatos', registrations: 'Inscrições', pending: 'Pendências', next: 'Próximo jogo', none: 'Nenhum jogo agendado', title: 'Resumo da sua conta DropZone' }
        const nextMatchValue = nextMatch
          ? [nextMatch.titulo || 'Jogo', nextMatch.data, nextMatch.horario_inicio].filter(Boolean).join(' • ')
          : labels.none

        response = {
          reply: labels.title,
          intent: match.intent,
          cards: [{
            id: 'account-overview',
            kind: 'summary',
            title: labels.title,
            details: [
              { label: labels.teams, value: String(teams.length) },
              { label: labels.championships, value: String(championshipIds.size) },
              { label: labels.registrations, value: String(registrations.length) },
              { label: labels.pending, value: String(pendingCount) },
              { label: labels.next, value: nextMatchValue },
            ],
          }],
          actions: [
            { id: 'summary-registrations', label: locale === 'en' ? 'My registrations' : locale === 'es' ? 'Mis inscripciones' : 'Minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes', variant: 'primary', context: { locale } },
            { id: 'summary-games', label: locale === 'en' ? 'Upcoming matches' : locale === 'es' ? 'Próximos partidos' : 'Próximos jogos', message: 'Mostrar meus próximos jogos', intent: 'listar_proximos_jogos', variant: 'secondary', context: { locale } },
            { id: 'summary-teams', label: locale === 'en' ? 'My teams' : locale === 'es' ? 'Mis equipos' : 'Minhas equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes', variant: 'secondary', context: { locale } },
            { id: 'summary-agenda', label: locale === 'en' ? 'Full schedule' : locale === 'es' ? 'Agenda completa' : 'Agenda completa', href: '/agenda', variant: 'secondary' },
          ],
          context: { locale },
          source: match.source,
        }
        break
      }

      case 'listar_proximos_jogos': {
        if (!user) {
          response = {
            reply: locale === 'en'
              ? 'To show your upcoming matches, I need to confirm your identity.'
              : locale === 'es'
                ? 'Para mostrar tus próximos partidos, necesito confirmar tu identidad.'
                : 'Para mostrar seus próximos jogos, preciso confirmar sua identidade.',
            intent: match.intent,
            requiresAuth: true,
            context: { locale, currentFlow: 'agenda' },
            source: match.source,
          }
          break
        }

        const today = new Date()
        const end = new Date(today)
        end.setDate(end.getDate() + 90)
        const isoDate = (value: Date) => value.toISOString().slice(0, 10)
        const agenda = await listAgenda({
          scope: 'me',
          from: isoDate(today),
          to: isoDate(end),
          authUserId: user.id,
        })
        const matches = (agenda.items || [])
          .filter((item: any) => item.source === 'jogo')
          .slice(0, 20)

        response = {
          reply: matches.length
            ? locale === 'en'
              ? `I found ${matches.length} upcoming match${matches.length === 1 ? '' : 'es'} in the next 90 days.`
              : locale === 'es'
                ? `Encontré ${matches.length} próximo${matches.length === 1 ? '' : 's'} partido${matches.length === 1 ? '' : 's'} en los próximos 90 días.`
                : `Encontrei ${matches.length} próximo${matches.length === 1 ? '' : 's'} jogo${matches.length === 1 ? '' : 's'} nos próximos 90 dias.`
            : locale === 'en'
              ? 'I did not find scheduled matches for your teams in the next 90 days.'
              : locale === 'es'
                ? 'No encontré partidos programados para tus equipos en los próximos 90 días.'
                : 'Não encontrei jogos agendados para suas equipes nos próximos 90 dias.',
          intent: match.intent,
          cards: agendaCards(matches, locale),
          actions: [
            { id: 'open-full-agenda', label: locale === 'en' ? 'Open full schedule' : locale === 'es' ? 'Abrir agenda completa' : 'Abrir agenda completa', href: '/agenda', variant: 'primary' },
            { id: 'menu-agenda', label: locale === 'en' ? 'Back to start' : locale === 'es' ? 'Volver al inicio' : 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
          ],
          context: { locale },
          source: match.source,
        }
        break
      }

      case 'usar_convite_token': {
        const tokenContext: LiliClientContext = {
          locale,
          currentFlow: 'invite_token',
          currentStep: 'token',
          awaitingInviteToken: true,
        }
        response = {
          reply: 'Digite somente o código do token recebido. A Lili identifica automaticamente se ele é de inscrição, grupo, escalação, convite individual de equipe ou compra de vaga.',
          intent: match.intent,
          actions: [
            { id: 'cancel-invite', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: tokenContext },
          ],
          context: tokenContext,
          source: 'system',
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

        if (invite.kind === 'inscricao_equipes_grupo' || invite.href.startsWith('/convite/grupo/')) {
          const groupInvite = await loadGroupInviteInChat(req, invite.token)
          const inviteContext: LiliClientContext = {
            locale,
            inviteToken: invite.token,
            inviteKind: 'inscricao_equipes_grupo',
            inviteHref: invite.href,
            inviteGroupId: groupInvite?.grupo?.id || null,
            selectedChampionshipId: groupInvite?.campeonato?.id || invite.campeonatoId || null,
            currentFlow: 'group_invite',
            currentStep: 'invite_summary',
          }
          const card = groupInviteSummaryCard(groupInvite, invite.token)
          card.actions = groupInvite?.inscricao_aberta ? [{
            id: 'continue-group-invite',
            label: 'Continuar inscrição pela Lili',
            message: 'Continuar inscrição',
            intent: 'continuar_convite_grupo',
            variant: 'primary',
            context: inviteContext,
          }] : []
          response = {
            reply: groupInvite?.inscricao_aberta
              ? 'Convite validado. Você pode concluir toda a inscrição aqui na conversa com a Lili.'
              : groupInvite?.status_mensagem || 'Este convite não está disponível para uma nova inscrição.',
            intent: match.intent,
            cards: [card],
            actions: [
              { id: 'view-invite-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: inviteContext },
              { id: 'another-token', label: 'Usar outro token', message: 'Quero usar outro token', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
            ],
            context: inviteContext,
            source: 'system',
          }
          break
        }

        response = {
          reply: 'Convite localizado. A próxima etapa será trazida para dentro da conversa da Lili.',
          intent: match.intent,
          cards: [{
            id: invite.token,
            kind: 'summary',
            title: invite.title,
            details: [{ label: 'Tipo de convite', value: invite.title }],
            actions: [{ id: 'continue-existing-invite', label: 'Continuar pela Lili', href: invite.href, variant: 'primary' }],
          }],
          actions: [
            { id: 'another-token', label: 'Usar outro token', message: 'Quero usar outro token', intent: 'usar_convite_token', variant: 'secondary', context: { locale } },
            { id: 'menu-token', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary', context: { locale } },
          ],
          context: { locale, inviteToken: invite.token, inviteKind: invite.kind, inviteHref: invite.href, autoOpenInvite: Boolean(context.autoOpenInvite) },
          source: 'system',
        }
        break
      }

      case 'continuar_convite_grupo': {
        if (!user) {
          response = {
            reply: 'Entre na sua conta para continuar a inscrição deste convite. Depois do login, a Lili retoma daqui.',
            intent: match.intent,
            requiresAuth: true,
            context,
            source: 'system',
          }
          break
        }
        if (!context.inviteToken) throw new Error('Convite não localizado nesta conversa.')
        const groupInvite = await loadGroupInviteInChat(req, context.inviteToken, context.selectedTeamId)
        if (!groupInvite?.inscricao_aberta) throw new Error(groupInvite?.status_mensagem || 'Este convite não aceita novas inscrições.')

        const baseContext: LiliClientContext = {
          ...context,
          inviteKind: 'inscricao_equipes_grupo',
          inviteGroupId: groupInvite?.grupo?.id || context.inviteGroupId || null,
          selectedChampionshipId: groupInvite?.campeonato?.id || context.selectedChampionshipId || null,
          currentFlow: 'group_invite',
        }

        if (!context.selectedTeamId && Array.isArray(groupInvite?.equipes_disponiveis) && groupInvite.equipes_disponiveis.length > 1) {
          response = {
            reply: 'Escolha qual equipe você administra e deseja inscrever neste campeonato.',
            intent: match.intent,
            cards: groupTeamCards(groupInvite.equipes_disponiveis, { ...baseContext, currentStep: 'team' }),
            actions: [{ id: 'cancel-group-invite', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: baseContext }],
            context: { ...baseContext, currentStep: 'team' },
            source: 'system',
          }
          break
        }

        const selectedTeamId = context.selectedTeamId || groupInvite?.equipe?.id || groupInvite?.equipes_disponiveis?.[0]?.id || null
        const selectedContext = { ...baseContext, selectedTeamId, currentStep: 'line' }
        const availableLines = Array.isArray(groupInvite?.lines_disponiveis) ? groupInvite.lines_disponiveis : []
        const registeredLines = Array.isArray(groupInvite?.lines_inscritas) ? groupInvite.lines_inscritas : []
        const cards = groupLineCards(availableLines, registeredLines, selectedContext)
        const availabilityText = availableLines.length
          ? `Você tem ${availableLines.length} ${availableLines.length === 1 ? 'line disponível' : 'lines disponíveis'} para esta vaga.`
          : 'Todas as lines existentes desta equipe já estão inscritas neste campeonato.'
        const registeredText = registeredLines.length
          ? ` ${registeredLines.length} ${registeredLines.length === 1 ? 'line já está inscrita' : 'lines já estão inscritas'} e aparece apenas para consulta.`
          : ''
        response = {
          reply: `Equipe confirmada. ${availabilityText}${registeredText}`,
          intent: match.intent,
          cards: cards.length ? cards : undefined,
          actions: [
            { id: 'create-group-line', label: 'Criar nova line', message: 'Criar uma nova line', intent: 'criar_line_convite_grupo', variant: availableLines.length ? 'secondary' : 'primary', context: selectedContext },
            { id: 'view-group-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: selectedContext },
            { id: 'cancel-group', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: selectedContext },
          ],
          context: selectedContext,
          source: 'system',
        }
        break
      }

      case 'selecionar_equipe_convite_grupo': {
        response = {
          reply: 'Equipe selecionada. Vou carregar as lines disponíveis.',
          intent: 'continuar_convite_grupo',
          actions: [{
            id: 'load-group-lines',
            label: 'Continuar',
            message: 'Continuar inscrição',
            intent: 'continuar_convite_grupo',
            variant: 'primary',
            context,
          }],
          context,
          source: 'system',
        }
        break
      }

      case 'criar_line_convite_grupo': {
        const nextContext = { ...context, selectedLineId: null, selectedLineName: null, awaitingGroupLineName: true, currentFlow: 'group_invite', currentStep: 'line_name' }
        response = {
          reply: 'Digite o nome da nova line. Ela será criada somente quando você confirmar a inscrição no final.',
          intent: match.intent,
          actions: [
            { id: 'back-group-lines', label: 'Voltar às lines', message: 'Voltar às lines', intent: 'continuar_convite_grupo', variant: 'secondary', context: { ...context, awaitingGroupLineName: false, currentStep: 'line' } },
            { id: 'cancel-new-line', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: nextContext },
          ],
          context: nextContext,
          source: 'system',
        }
        break
      }

      case 'selecionar_line_convite_grupo': {
        if (!context.inviteToken || !context.selectedTeamId) throw new Error('Faltam dados do convite ou da equipe.')
        const groupInvite = await loadGroupInviteInChat(req, context.inviteToken, context.selectedTeamId)
        const nextContext = { ...context, currentFlow: 'group_invite', currentStep: 'slot' }
        const allSlots = Array.isArray(groupInvite?.vagas) ? groupInvite.vagas : []
        const slots = groupSlotCards(allSlots, nextContext)
        const freeCount = allSlots.filter((item: any) => item.slot_id && !item.ocupada).length
        response = {
          reply: slots.length
            ? `Line ${context.selectedLineName || 'selecionada'}. Veja a grade completa do grupo ${groupInvite?.grupo?.nome || ''}: ${freeCount} ${freeCount === 1 ? 'slot livre' : 'slots livres'}. Os slots ocupados mostram a equipe e a line atuais.`
            : 'Este grupo ainda não possui slots configurados.',
          intent: match.intent,
          cards: slots,
          actions: [
            { id: 'view-slot-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: nextContext },
            { id: 'cancel-slot', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: nextContext },
          ],
          context: nextContext,
          source: 'system',
        }
        break
      }

      case 'selecionar_slot_convite_grupo': {
        if (!context.inviteToken || !context.selectedTeamId || !context.selectedSlotId || (!context.selectedLineId && !context.selectedLineName)) {
          throw new Error('Faltam dados para continuar esta inscrição.')
        }
        const groupInvite = await loadGroupInviteInChat(req, context.inviteToken, context.selectedTeamId)
        const nextContext = {
          ...context,
          selectedChampionshipId: String(groupInvite?.campeonato?.id || context.selectedChampionshipId || ''),
          inviteGroupId: String(groupInvite?.grupo?.id || context.inviteGroupId || ''),
          currentFlow: 'group_invite',
          currentStep: 'confirm',
        }
        response = {
          reply: 'Este token já representa uma vaga autorizada pelo administrador. Confira os dados e confirme a inscrição; não há cobrança neste fluxo.',
          intent: match.intent,
          cards: [{
            id: 'group-invite-confirm-summary', kind: 'summary',
            title: String(groupInvite?.campeonato?.nome || 'Confirmar inscrição'),
            subtitle: String(groupInvite?.grupo?.nome || ''),
            imageUrl: groupInvite?.campeonato?.logo_url || null,
            details: [
              { label: 'Equipe', value: String(groupInvite?.equipe?.nome || 'Equipe selecionada') },
              { label: 'Line', value: String(context.selectedLineName || 'Line selecionada') },
              { label: 'Grupo', value: String(groupInvite?.grupo?.nome || 'Grupo do convite') },
              { label: 'Slot', value: String(context.selectedSlotLabel || 'Selecionado') },
              { label: 'Autorização', value: 'Token liberado pelo administrador' },
            ],
          }],
          actions: [
            { id: 'confirm-group-invite', label: 'Confirmar inscrição', message: 'Confirmar inscrição agora', intent: 'confirmar_convite_grupo', variant: 'primary', context: nextContext },
            { id: 'view-confirm-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: nextContext },
            { id: 'cancel-token-entry', label: 'Cancelar', message: 'Cancelar operação', intent: 'cancelar_fluxo', variant: 'secondary', context: nextContext },
          ],
          context: nextContext,
          source: 'system',
        }
        break
      }

      case 'pagar_pix_convite_grupo':
      case 'pagar_cartao_convite_grupo': {
        if (!user) {
          response = { reply: 'Entre na conta para reservar o slot e gerar o pagamento.', intent: match.intent, requiresAuth: true, context, source: 'system' }
          break
        }
        const method: 'pix' | 'cartao' = match.intent === 'pagar_cartao_convite_grupo' ? 'cartao' : 'pix'
        const digits = String(context.paymentDocument || '').replace(/\D/g, '')
        if (![11, 14].includes(digits.length)) {
          const nextContext = { ...context, selectedPaymentMethod: method, awaitingPaymentDocument: true, currentStep: 'payment_document' }
          response = {
            reply: 'Digite o CPF ou CNPJ do pagador. O documento será enviado somente ao Asaas para gerar a cobrança segura.',
            intent: match.intent,
            actions: [{ id: 'cancel-payment-document', label: 'Voltar', message: 'Voltar uma etapa', intent: 'voltar_etapa', variant: 'secondary', context: nextContext }],
            context: nextContext,
            source: 'system',
          }
          break
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
            : `Slot reservado até ${new Date(reservation.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Abra o checkout seguro do Asaas para pagar com cartão.`,
          intent: match.intent,
          cards: [paymentCard({ token: reservation.codigo, status: payment.status, valueCents: payment.valor_centavos, invoiceUrl: payment.asaas_invoice_url, pixPayload: payment.asaas_pix_payload })],
          actions: [
            { id: 'check-group-payment', label: 'Já paguei, verificar', message: 'Verificar pagamento', intent: 'verificar_pagamento_convite_grupo', variant: 'primary', context: nextContext },
            { id: 'group-payment-rules', label: 'Ver regulamento', message: 'Ver regulamento do campeonato', intent: 'ver_regulamento_campeonato', variant: 'secondary', context: nextContext },
          ],
          context: nextContext,
          source: 'system',
        }
        break
      }

      case 'verificar_pagamento_convite_grupo': {
        if (!user || !context.reservationId) throw new Error('Reserva de pagamento não localizada.')
        const payment = context.selectedPaymentMethod === 'paypal'
          ? await getLiliPayPalPaymentStatus(context.reservationId)
          : await getLiliPaymentStatus(context.reservationId)
        if (!payment || !isPaidStatus(payment.status)) {
          response = { reply: 'O pagamento ainda não foi confirmado. O slot continua reservado até o horário informado.', intent: match.intent, actions: [{ id: 'check-group-payment-again', label: 'Verificar novamente', message: 'Verificar pagamento novamente', intent: 'verificar_pagamento_convite_grupo', variant: 'primary', context }], context, source: 'system' }
          break
        }
        const result = await confirmGroupInviteInChat(req, context)
        await confirmLiliReservation(context.reservationId)
        response = {
          reply: result?.mensagem || 'Pagamento e inscrição confirmados com sucesso.',
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
        break
      }

      case 'falar_atendente_convite_grupo': {
        if (!user) {
          response = { reply: 'Entre na conta para reservar o slot antes de abrir o WhatsApp.', intent: match.intent, requiresAuth: true, context, source: 'system' }
          break
        }
        const invite = await loadGroupInviteInChat(req, String(context.inviteToken), String(context.selectedTeamId))
        const reservation = await reserveSlotForLili({ campeonatoId: invite.campeonato.id, grupoId: invite.grupo.id, slotId: String(context.selectedSlotId), authUserId: user.id, equipeId: String(context.selectedTeamId), lineId: context.selectedLineId || null, nomeLine: context.selectedLineId ? null : context.selectedLineName || null, conviteToken: context.inviteToken || null, metodo: 'whatsapp', minutes: 30, meta: { campeonato_nome: invite.campeonato.nome, grupo_nome: invite.grupo.nome, slot: context.selectedSlotLabel } })
        const { data: cfg } = await supabaseAdmin.from('campeonato_configuracoes').select('contatos_whatsapp').eq('campeonato_id', invite.campeonato.id).maybeSingle()
        const contacts = Array.isArray(cfg?.contatos_whatsapp) ? cfg.contatos_whatsapp : []
        const text = `Olá, quero confirmar uma vaga no campeonato ${invite.campeonato.nome}.\nGrupo: ${invite.grupo.nome}\nSlot: ${context.selectedSlotLabel}\nEquipe: ${invite.equipe?.nome || 'Selecionada'}\nLine: ${context.selectedLineName || 'Selecionada'}\nReserva: ${reservation.codigo}\nValidade: ${new Date(reservation.expira_em).toLocaleString('pt-BR')}`
        const actions = contacts.filter((c: any) => c?.url).map((c: any, i: number) => ({ id: `whatsapp-${i}`, label: `Falar com ${c.nome || 'atendente'}`, href: `${String(c.url).split('?')[0]}?text=${encodeURIComponent(text)}`, variant: 'primary' as const }))
        response = {
          reply: `Slot reservado por 30 minutos. Escolha um atendente para continuar pelo WhatsApp. Informe o código ${reservation.codigo}.`,
          intent: match.intent,
          cards: [{ id: reservation.id, kind: 'summary', title: 'Reserva temporária', subtitle: invite.campeonato.nome, details: [
            { label: 'Grupo', value: invite.grupo.nome }, { label: 'Slot', value: String(context.selectedSlotLabel) }, { label: 'Equipe', value: String(invite.equipe?.nome || 'Selecionada') }, { label: 'Line', value: String(context.selectedLineName || 'Selecionada') }, { label: 'Reserva', value: reservation.codigo }, { label: 'Expira em', value: new Date(reservation.expira_em).toLocaleString('pt-BR') },
          ], actions }],
          actions: actions.length ? [] : [{ id: 'no-whatsapp', label: 'Voltar', message: 'Voltar uma etapa', intent: 'voltar_etapa', variant: 'secondary', context }],
          context: { ...context, reservationId: reservation.id, reservationCode: reservation.codigo, reservationExpiresAt: reservation.expira_em }, source: 'system',
        }
        break
      }

      case 'pagar_paypal_convite_grupo': {
        if (!user) {
          response = { reply: 'Entre na conta para reservar o slot e pagar com PayPal.', intent: match.intent, requiresAuth: true, context, source: 'system' }
          break
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
          break
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
        break
      }

      case 'capturar_paypal_convite_grupo': {
        if (!user || !context.reservationId || !context.paypalOrderId) throw new Error('Retorno do PayPal incompleto.')
        const payment = await captureLiliPayPalOrder({ orderId: context.paypalOrderId, reservationId: context.reservationId, authUserId: user.id })
        if (!isPaidStatus(payment.status)) {
          response = { reply: 'O PayPal ainda não confirmou a captura. Tente verificar novamente em alguns segundos.', intent: match.intent, actions: [{ id: 'retry-paypal-capture', label: 'Verificar novamente', message: 'Verificar pagamento PayPal', intent: 'verificar_pagamento_convite_grupo', variant: 'primary', context }], context, source: 'system' }
          break
        }
        const result = await confirmGroupInviteInChat(req, context)
        await confirmLiliReservation(context.reservationId)
        response = {
          reply: 'Pagamento PayPal e inscrição confirmados com sucesso.', intent: match.intent,
          cards: [{ id: String(result?.campeonato_equipe_id || context.reservationId), kind: 'summary', title: 'Comprovante de inscrição', subtitle: 'Pagamento confirmado pelo PayPal', details: [
            { label: 'Campeonato', value: String(result?.campeonato?.nome || 'Confirmado') },
            { label: 'Grupo', value: String(result?.grupo?.nome || context.inviteGroupId || 'Confirmado') },
            { label: 'Line', value: String(result?.line?.nome || context.selectedLineName || 'Confirmada') },
            { label: 'Slot', value: String(result?.slot?.slot_letra || result?.slot?.slot_numero || context.selectedSlotLabel || 'Confirmado') },
            { label: 'Pagamento', value: `PAYPAL ${context.currency || 'BRL'}` },
            { label: 'Protocolo', value: String(context.reservationCode || result?.campeonato_equipe_id || 'Gerado') },
          ] }], actions: menuActions(locale), context: { locale }, source: 'system',
        }
        break
      }

      case 'confirmar_convite_grupo': {
        if (!user) {
          response = { reply: 'Entre na conta para confirmar a inscrição.', intent: match.intent, requiresAuth: true, context, source: 'system' }
          break
        }
        const result = await confirmGroupInviteInChat(req, context)
        response = {
          reply: result?.mensagem || 'Inscrição concluída com sucesso.',
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
        break
      }

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
          break
        }
        const item = await getChampionshipDetails(context.selectedChampionshipId)
        if (!item.aceita_novas_inscricoes_equipes || Number(item.vagas_livres || 0) <= 0) {
          response = { reply: 'Este campeonato não possui vaga disponível para compra neste momento.', intent: match.intent, actions: [{ id: 'other-spots', label: 'Ver outros campeonatos', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos', variant: 'primary', context: { locale } }], context: { locale }, source: 'system' }
          break
        }
        const nextContext = { locale, selectedChampionshipId: item.id, currentFlow: 'vacancy_purchase', currentStep: 'payment_method' }
        response = {
          reply: 'Escolha como deseja comprar a vaga. Depois que o pagamento for confirmado, a Lili libera a escolha da equipe, line e slot.',
          intent: match.intent,
          cards: [{ id: item.id, kind: 'championship', title: item.nome, imageUrl: item.logo_url || item.banner_url || null, badges: [`${item.vagas_livres} vaga${Number(item.vagas_livres) === 1 ? '' : 's'} disponível${Number(item.vagas_livres) === 1 ? '' : 'is'}`], details: item.valor_inscricao != null ? [{ label: 'Valor', value: `R$ ${Number(item.valor_inscricao).toFixed(2).replace('.', ',')}` }] : undefined }],
          actions: [
            { id: 'buy-pix', label: 'PIX', message: 'Comprar vaga por PIX', intent: 'pagar_pix_compra', variant: 'primary', context: { ...nextContext, selectedPaymentMethod: 'pix' } },
            { id: 'buy-card', label: 'Cartão de crédito', message: 'Comprar vaga com cartão', intent: 'pagar_cartao_compra', variant: 'primary', context: { ...nextContext, selectedPaymentMethod: 'cartao' } },
            { id: 'buy-paypal', label: 'PayPal', message: 'Comprar vaga com PayPal', intent: 'pagar_paypal_compra', variant: 'secondary', context: { ...nextContext, selectedPaymentMethod: 'paypal' } },
            { id: 'buy-whatsapp', label: 'Falar com atendente no WhatsApp', href: `/vagas?comprar=${encodeURIComponent(item.id)}`, variant: 'secondary' },
            { id: 'have-token-selected', label: 'Já tenho token', message: 'Já tenho um token de inscrição', intent: 'usar_convite_token', variant: 'secondary', context: { locale, selectedChampionshipId: item.id } },
          ],
          context: nextContext,
          source: 'system',
        }
        break
      }

      case 'pagar_pix_compra':
      case 'pagar_cartao_compra': {
        if (!user) { response = { reply: 'Entre na conta para gerar o pagamento.', intent: match.intent, requiresAuth: true, context, source: 'system' }; break }
        if (!context.selectedChampionshipId) throw new Error('Campeonato não selecionado.')
        const method: 'pix' | 'cartao' = match.intent === 'pagar_cartao_compra' ? 'cartao' : 'pix'
        const digits = String(context.paymentDocument || '').replace(/\D/g, '')
        if (![11, 14].includes(digits.length)) {
          const nextContext = { ...context, selectedPaymentMethod: method, awaitingPaymentDocument: true, currentStep: 'payment_document' }
          response = { reply: 'Digite o CPF ou CNPJ do pagador para gerar a cobrança segura.', intent: match.intent, actions: [{ id: 'back-buy-method', label: 'Voltar', message: 'Voltar uma etapa', intent: 'voltar_etapa', variant: 'secondary', context: nextContext }], context: nextContext, source: 'system' }
          break
        }
        const account = await getActiveAccount(req, user)
        const email = String(user.email || account?.data?.email_contato || '').trim()
        const name = String(account?.name || user.user_metadata?.full_name || email).trim()
        const { compra, payment } = await createVacancyPurchase({ campeonatoId: context.selectedChampionshipId, authUserId: user.id, payerName: name || 'Comprador', payerEmail: email, cpfCnpj: digits, method })
        const nextContext = registrationContext(context, { purchaseToken: compra.token, purchaseId: compra.id, awaitingPaymentDocument: false, currentStep: 'payment_wait' })
        response = {
          reply: method === 'pix' ? 'Cobrança PIX criada. Pague e depois toque em “Já paguei, verificar”.' : 'Checkout de cartão criado. Abra a página segura do Asaas e depois volte para verificar.',
          intent: match.intent,
          cards: [paymentCard({ token: compra.token, status: payment?.status || compra.status, valueCents: payment?.valor_centavos || compra.valor_centavos, invoiceUrl: payment?.asaas_invoice_url, pixPayload: payment?.asaas_pix_payload })],
          actions: [{ id: 'check-direct-payment', label: 'Já paguei, verificar', message: 'Verificar pagamento', intent: 'verificar_pagamento_inscricao', variant: 'primary', context: nextContext }, { id: 'menu-after-payment', label: 'Voltar ao início', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }],
          context: nextContext, source: 'system',
        }
        break
      }

      case 'pagar_paypal_compra': {
        if (!user) { response = { reply: 'Entre na conta para pagar com PayPal.', intent: match.intent, requiresAuth: true, context, source: 'system' }; break }
        if (!context.selectedChampionshipId) throw new Error('Campeonato não selecionado.')
        if (!paypalConfigured()) throw new Error('PayPal ainda não foi configurado na Vercel.')
        if (!context.currency) {
          response = { reply: 'Escolha a moeda do pagamento PayPal.', intent: match.intent, actions: [
            { id: 'buy-paypal-brl', label: 'Real (BRL)', message: 'Pagar em reais pelo PayPal', intent: 'pagar_paypal_compra', variant: 'primary', context: { ...context, currency: 'BRL', selectedPaymentMethod: 'paypal' } },
            { id: 'buy-paypal-usd', label: 'Dólar (USD)', message: 'Pagar em dólares pelo PayPal', intent: 'pagar_paypal_compra', variant: 'secondary', context: { ...context, currency: 'USD', selectedPaymentMethod: 'paypal' } },
            { id: 'buy-paypal-eur', label: 'Euro (EUR)', message: 'Pagar em euros pelo PayPal', intent: 'pagar_paypal_compra', variant: 'secondary', context: { ...context, currency: 'EUR', selectedPaymentMethod: 'paypal' } },
          ], context: { ...context, selectedPaymentMethod: 'paypal' }, source: 'system' }
          break
        }
        const item = await getChampionshipDetails(context.selectedChampionshipId)
        const base = Number(item.valor_inscricao || 0)
        if (base <= 0) throw new Error('Este campeonato não possui valor online cobrável.')
        const quote = context.currency === 'BRL' ? { currency: 'BRL' as const, totalMinor: Math.round(base * 100) } : await createInternationalQuote(Math.round(base * 100), context.currency)
        const account = await getActiveAccount(req, user)
        const email = String(user.email || account?.data?.email_contato || '').trim()
        const name = String(account?.name || user.user_metadata?.full_name || email).trim()
        const { compra } = await createVacancyPurchase({ campeonatoId: context.selectedChampionshipId, authUserId: user.id, payerName: name || 'Comprador', payerEmail: email, method: 'paypal' })
        const payment = await createLiliPayPalOrder({ reservation: compra, campeonatoNome: item.nome, amountMinor: quote.totalMinor, currency: quote.currency, returnOrigin: req.nextUrl.origin, referenceType: 'sistema_compras_vaga' })
        const nextContext = registrationContext(context, { purchaseToken: compra.token, purchaseId: compra.id, paypalOrderId: payment.paypal_order_id, paypalApprovalUrl: payment.paypal_approval_url, currentStep: 'payment_wait' })
        response = { reply: 'Ordem PayPal criada. Abra o PayPal, aprove o pagamento e volte para a Lili.', intent: match.intent, cards: [{ id: payment.id, kind: 'payment', title: 'Pagamento PayPal', subtitle: item.nome, details: [{ label: 'Valor', value: formatMoney(quote.totalMinor / 100, quote.currency, locale) }, { label: 'Moeda', value: quote.currency }], actions: [{ id: 'open-paypal-buy', label: 'Abrir PayPal', href: payment.paypal_approval_url, variant: 'primary' }] }], actions: [{ id: 'check-paypal-buy', label: 'Já paguei, verificar', message: 'Verificar pagamento PayPal da vaga', intent: 'capturar_paypal_compra', variant: 'secondary', context: nextContext }], context: nextContext, source: 'system' }
        break
      }

      case 'capturar_paypal_compra': {
        if (!user || !context.purchaseId || !context.paypalOrderId || !context.purchaseToken) throw new Error('Retorno do PayPal incompleto.')
        const payment = await captureVacancyPayPalOrder({ orderId: context.paypalOrderId, purchaseId: context.purchaseId, authUserId: user.id })
        if (!isPaidStatus(payment.status)) {
          response = { reply: 'O PayPal ainda não confirmou o pagamento. Tente novamente em alguns segundos.', intent: match.intent, actions: [{ id: 'retry-paypal-buy', label: 'Verificar novamente', message: 'Verificar pagamento PayPal da vaga', intent: 'capturar_paypal_compra', variant: 'primary', context }], context, source: 'system' }
          break
        }
        const data = await claimContext(req, context)
        const nextContext = registrationContext(context, { currentStep: 'team', selectedTeamId: null, selectedLineId: null, selectedLineName: null, selectedSlotId: null, selectedSlotLabel: null })
        response = { reply: 'Pagamento confirmado. Agora escolha a equipe que usará esta vaga.', intent: match.intent, cards: teamCards(data.equipes || []).map((card: any) => ({ ...card, actions: [{ id: `purchase-team-${card.id}`, label: 'Usar esta equipe', message: `Usar equipe ${card.title}`, intent: 'selecionar_equipe_compra', variant: 'primary', context: { ...nextContext, selectedTeamId: card.id } }] })), actions: flowControlActions(nextContext), context: nextContext, source: 'system' }
        break
      }

      case 'selecionar_equipe_compra': {
        const data = await claimContext(req, context)
        const nextContext = registrationContext(context, { currentStep: 'line' })
        response = { reply: data.lines?.length ? 'Equipe selecionada. Agora escolha uma line disponível.' : 'Equipe selecionada. Digite o nome da nova line.', intent: match.intent, cards: data.lines?.length ? lineCards(data.lines, nextContext) : undefined, actions: data.lines?.length ? [{ id: 'new-line-after-buy', label: 'Criar nova line', message: 'Quero criar uma nova line', intent: 'criar_line_inscricao', variant: 'secondary', context: nextContext }, ...flowControlActions(nextContext)] : flowControlActions(registrationContext(nextContext, { awaitingLineName: true, currentStep: 'line_name' })), context: data.lines?.length ? nextContext : registrationContext(nextContext, { awaitingLineName: true, currentStep: 'line_name' }), source: 'system' }
        break
      }

      case 'iniciar_pagamento_inscricao': {
        if (!user) {
          response = { reply: 'Para gerar o pagamento, preciso que você entre na sua conta.', intent: match.intent, requiresAuth: true, context, source: 'system' }
          break
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
        const nextContext = registrationContext(context, { currentStep: 'team', selectedTeamId: null, selectedLineId: null, selectedLineName: null })
        response = {
          reply: 'Pagamento confirmado. Agora escolha a equipe que usará esta vaga.',
          intent: match.intent,
          cards: teamCards(data.equipes || []).map((card: any) => ({ ...card, actions: [{ id: `purchase-team-${card.id}`, label: 'Usar esta equipe', message: `Usar equipe ${card.title}`, intent: 'selecionar_equipe_compra', variant: 'primary', context: { ...nextContext, selectedTeamId: card.id } }] })),
          actions: flowControlActions(nextContext),
          context: nextContext,
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
