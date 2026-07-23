import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getActiveAccount, getBearerUser } from '@backend/auth/server-auth'
import { AsaasNotConfiguredError } from '@backend/billing/asaas'
import { claimVacancyPurchase, createVacancyPurchase, loadClaimContext } from '@backend/billing/vacancy-purchase'
import { detectLiliLocale, resolveLiliIntent } from '@/features/lili/intent-router'
import { localizeLiliResponse, normalizeLocale } from '@/features/lili/i18n'
import {
  buildRegistrationSummary,
  championshipCards,
  lineCards,
  listOpenChampionships,
  listUserRegistrations,
  listUserTeams,
  paymentCard,
  registrationCards,
  slotCards,
  teamCards,
} from '@/features/lili/tools'
import type { LiliChatResponse, LiliClientContext, LiliIntent, LiliLocale } from '@/features/lili/types'

async function optionalUser(req: NextRequest) {
  try { return await getBearerUser(req) } catch { return null }
}

function menuActions(locale: LiliLocale) {
  return [
    { id: 'open-championships', label: 'Campeonatos com vagas', message: 'Ver campeonatos com vagas abertas', intent: 'listar_campeonatos_abertos' as LiliIntent, variant: 'primary' as const, context: { locale } },
    { id: 'register', label: 'Fazer inscrição', message: 'Quero fazer uma inscrição', intent: 'iniciar_inscricao' as LiliIntent, variant: 'primary' as const, context: { locale } },
    { id: 'my-teams', label: 'Minhas equipes', message: 'Mostrar minhas equipes', intent: 'listar_minhas_equipes' as LiliIntent, variant: 'secondary' as const, context: { locale } },
    { id: 'my-registrations', label: 'Minhas inscrições', message: 'Mostrar minhas inscrições', intent: 'listar_minhas_inscricoes' as LiliIntent, variant: 'secondary' as const, context: { locale } },
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
            { id: 'register', label: 'Fazer inscrição', message: 'Quero fazer uma inscrição', intent: 'iniciar_inscricao', variant: 'primary' },
            { id: 'menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' },
          ],
          source: match.source,
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
        if (!context.selectedChampionshipId) {
          const items = await listOpenChampionships()
          response = {
            reply: items.length ? 'Primeiro, escolha o campeonato em que deseja inscrever uma equipe.' : 'Não há campeonatos com vagas abertas agora.',
            intent: match.intent,
            cards: championshipCards(items, true, locale),
            actions: [{ id: 'menu', label: 'Voltar', message: 'Voltar ao início', intent: 'menu', variant: 'secondary' }],
            context: registrationContext({}, { currentStep: 'championship' }),
            source: match.source,
          }
          break
        }
        if (!user) {
          response = {
            reply: 'Campeonato escolhido. Agora preciso que você entre na conta para localizar as equipes que pode inscrever.',
            intent: match.intent,
            requiresAuth: true,
            context: registrationContext(context, { currentStep: 'team' }),
            source: match.source,
          }
          break
        }
        if (!context.selectedTeamId) {
          const teams = await listUserTeams(user)
          response = {
            reply: teams.length ? 'Qual equipe você quer usar nesta inscrição?' : 'Não encontrei nenhuma equipe vinculada à sua conta.',
            intent: match.intent,
            cards: teamCards(teams, context.selectedChampionshipId),
            context: registrationContext(context, { currentStep: 'team' }),
            source: match.source,
          }
          break
        }

        const summary = await buildRegistrationSummary(context.selectedChampionshipId, context.selectedTeamId)
        if (summary.existing) {
          response = {
            reply: `A equipe ${summary.team.nome} já está inscrita em ${summary.championship.nome}${summary.existing.slot_numero ? ` no slot ${summary.existing.slot_numero}` : ''}.`,
            intent: match.intent,
            cards: [{ id: summary.existing.id, kind: 'summary', title: 'Inscrição encontrada', details: [
              { label: 'Campeonato', value: summary.championship.nome },
              { label: 'Equipe', value: summary.team.nome },
              { label: 'Status', value: 'Ativa' },
            ] }],
            actions: menuActions(locale),
            context: {},
            source: 'system',
          }
          break
        }

        response = {
          reply: `Encontrei ${summary.championship.nome} e a equipe ${summary.team.nome}. Posso gerar o pagamento da vaga agora e continuar toda a inscrição aqui no chat.`,
          intent: match.intent,
          cards: [{ id: `${summary.championship.id}-${summary.team.id}`, kind: 'summary', title: 'Resumo inicial', details: [
            { label: 'Campeonato', value: summary.championship.nome },
            { label: 'Equipe', value: summary.team.nome },
          ] }],
          actions: [
            { id: 'pay', label: 'Gerar pagamento PIX', message: 'Gerar pagamento da inscrição', intent: 'iniciar_pagamento_inscricao', variant: 'primary', context: registrationContext(context, { currentStep: 'payment' }) },
            { id: 'change-team', label: 'Trocar equipe', message: 'Quero escolher outra equipe', intent: 'iniciar_inscricao', variant: 'secondary', context: registrationContext({ selectedChampionshipId: context.selectedChampionshipId }, { currentStep: 'team' }) },
          ],
          context: registrationContext(context, { currentStep: 'payment' }),
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
          actions: data.lines?.length ? [{ id: 'new-line', label: 'Criar nova line', message: 'Quero criar uma nova line', intent: 'criar_line_inscricao', variant: 'secondary', context: nextContext }] : undefined,
          context: data.lines?.length ? nextContext : registrationContext(nextContext, { awaitingLineName: true, currentStep: 'line_name' }),
          source: 'system',
        }
        break
      }

      case 'criar_line_inscricao':
        response = {
          reply: 'Digite o nome da nova line. Depois eu vou mostrar os slots livres.',
          intent: match.intent,
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
        response = {
          reply: 'Ainda não reconheci esse pedido. Escolha uma opção abaixo ou escreva, por exemplo, “quero ver campeonatos com vagas”.',
          intent: 'desconhecido', actions: menuActions(locale), source: match.source,
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
