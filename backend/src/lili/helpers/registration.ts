import { NextRequest } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { loadClaimContext } from '@backend/billing/vacancy-purchase'
import type { LiliClientContext, LiliIntent } from '@backend/lili/types'

export function formatReceiptMoney(valueCents: number | string | null | undefined) {
  const cents = Number(valueCents || 0)
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

export function registrationReceiptCard(input: {
  id: string
  campeonato: string
  equipe: string
  line: string
  grupo: string
  slot: string
  pagamento: string
  valorCentavos?: number | string | null
  protocolo: string
  confirmadoEm?: string | null
}) {
  const confirmedAt = input.confirmadoEm ? new Date(input.confirmadoEm) : new Date()
  const dateLabel = confirmedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const paymentLabel = input.valorCentavos != null
    ? `${input.pagamento} • ${formatReceiptMoney(input.valorCentavos)}`
    : input.pagamento
  const receiptText = [
    'COMPROVANTE DE INSCRIÇÃO DROPZONE',
    `Campeonato: ${input.campeonato}`,
    `Equipe: ${input.equipe}`,
    `Line: ${input.line}`,
    `Grupo: ${input.grupo}`,
    `Slot: ${input.slot}`,
    `Pagamento: ${paymentLabel}`,
    `Status: Confirmada`,
    `Protocolo: ${input.protocolo}`,
    `Data: ${dateLabel}`,
  ].join('\n')

  return {
    id: input.id,
    kind: 'summary' as const,
    title: 'Comprovante de inscrição',
    subtitle: 'Inscrição confirmada pela Lili',
    details: [
      { label: 'Campeonato', value: input.campeonato },
      { label: 'Equipe', value: input.equipe },
      { label: 'Line', value: input.line },
      { label: 'Grupo', value: input.grupo },
      { label: 'Slot', value: input.slot },
      { label: 'Pagamento', value: paymentLabel },
      { label: 'Status', value: 'Confirmada' },
      { label: 'Protocolo', value: input.protocolo },
      { label: 'Data', value: dateLabel },
    ],
    actions: [{
      id: `copy-receipt-${input.id}`,
      label: 'Copiar comprovante',
      copyText: receiptText,
      variant: 'primary' as const,
    }],
  }
}

export function looksLikeInviteToken(value: string) {
  const token = value.trim()
  if (token.length < 8 || token.length > 240 || /\s/.test(token)) return false
  if (/^https?:\/\//i.test(token)) return true
  return /^[a-z0-9_-]+$/i.test(token) && /[0-9]/.test(token)
}

export function registrationContext(context: LiliClientContext, patch: Partial<LiliClientContext> = {}): LiliClientContext {
  return { ...context, ...patch, currentFlow: 'registration' }
}

export function flowControlActions(context: LiliClientContext) {
  return [
    { id: 'back-step', label: 'Voltar uma etapa', message: 'Voltar uma etapa', intent: 'voltar_etapa' as LiliIntent, variant: 'secondary' as const, context },
    { id: 'cancel-flow', label: 'Cancelar operação', message: 'Cancelar operação', intent: 'cancelar_fluxo' as LiliIntent, variant: 'secondary' as const, context },
  ]
}

export function previousRegistrationContext(context: LiliClientContext): LiliClientContext {
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

export async function claimContext(req: NextRequest, context: LiliClientContext) {
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
