import { verifyQuoteToken, type InternationalQuote, type LiliCurrency } from './currency'

export type PayPalQuote = { totalMinor: number; currency: LiliCurrency; quoteId?: string; baseAmountCents?: number; expiresAt?: string }

/** Only the server's persisted price or a server-signed quote can set a charge. */
export function resolvePayPalQuote(record: any, referenceType: string, currency?: string, quote?: Partial<InternationalQuote>): PayPalQuote {
  if (referenceType === 'lili_reservas_slot') {
    const stored = record?.meta?.quote
    if (!stored?.quoteId) throw new Error('Reserva sem cotação válida. Gere uma nova reserva.')
    return signedQuote(stored)
  }
  if (referenceType !== 'sistema_compras_vaga') throw new Error('Referência de pagamento inválida.')
  const base = Number(record?.valor_centavos)
  if (!Number.isSafeInteger(base) || base <= 0) throw new Error('Valor da compra inválido.')
  if (!currency || currency === 'BRL') return { currency: 'BRL', totalMinor: base, baseAmountCents: base }
  const signed = signedQuote(quote)
  if (signed.baseAmountCents !== base || signed.currency !== currency) throw new Error('Cotação não corresponde à compra.')
  return signed
}

function signedQuote(quote?: Partial<InternationalQuote>): PayPalQuote {
  const payload = verifyQuoteToken(String(quote?.quoteId || ''), { allowExpired: true })
  if (!['BRL', 'USD', 'EUR'].includes(payload.currency)
    || !Number.isSafeInteger(payload.totalMinor) || payload.totalMinor <= 0
    || !Number.isSafeInteger(payload.baseAmountCents) || payload.baseAmountCents <= 0
    || payload.baseCurrency !== 'BRL') throw new Error('Cotação inválida.')
  return { ...payload, quoteId: quote!.quoteId }
}

export function assertPayPalPrice(expected: PayPalQuote, amount: unknown, currency: unknown) {
  if (!Number.isSafeInteger(amount) || amount !== expected.totalMinor || currency !== expected.currency) {
    throw new Error('O valor ou a moeda não corresponde à cotação desta reserva.')
  }
}

export function assertPayPalReferenceOpen(record: any, referenceType: string) {
  const expected = referenceType === 'sistema_compras_vaga' ? 'pendente' : 'ativa'
  if (record?.status !== expected || !record.expira_em || !Number.isFinite(Date.parse(record.expira_em)) || Date.parse(record.expira_em) <= Date.now()) {
    throw new Error('Esta reserva expirou ou já foi concluída. Inicie uma nova compra.')
  }
}
