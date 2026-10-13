import { detectLiliLocale, resolveLiliIntent } from '@backend/lili/intent-router'
import { normalizeLocale } from '@backend/lili/locale'
import type { LiliClientContext, LiliIntent, LiliLocale } from '@backend/lili/types'
import type { NextRequest } from 'next/server'
import type { LiliChatResponse } from './types'
import { localizeLiliResponse } from './localize-response'
import { dispatchLiliIntent } from './dispatch'
import { optionalUser } from './helpers/navigation'
import { looksLikeInviteToken, registrationContext } from './helpers/registration'

export async function runLiliChat(req: NextRequest, body: any): Promise<LiliChatResponse> {
  const message = String(body?.message || '').trim().slice(0, 1000)
  const forcedIntent = String(body?.intent || '').trim() as LiliIntent
  let context: LiliClientContext = body?.context && typeof body.context === 'object' ? body.context : {}
  if (!message && !forcedIntent) throw new Error('Mensagem ausente.')

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

  const wasAwaitingPaymentDocument = Boolean(context.awaitingPaymentDocument)
  if (wasAwaitingPaymentDocument && !forcedIntent && message) {
    const paymentIntent: LiliIntent = context.currentFlow === 'vacancy_purchase'
      ? (context.selectedPaymentMethod === 'cartao' ? 'pagar_cartao_compra' : 'pagar_pix_compra')
      : (context.selectedPaymentMethod === 'cartao' ? 'pagar_cartao_convite_grupo' : 'pagar_pix_convite_grupo')
    context = { ...context, paymentDocument: message.replace(/\D/g, ''), awaitingPaymentDocument: false }
    match = { intent: paymentIntent, confidence: 1, source: 'system' as const, searchTerm: undefined }
  }

  if (!forcedIntent && !wasAwaitingPaymentDocument && !context.awaitingLineName && !context.awaitingInviteToken && looksLikeInviteToken(message)) {
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

  const response = await dispatchLiliIntent({ req, user, message, context, locale, match })
  return localizeLiliResponse({ ...response, context: { ...(response.context || {}), locale } }, locale)
}
