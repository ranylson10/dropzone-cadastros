import { createHmac, timingSafeEqual } from 'node:crypto'
import type { LiliCurrency, LiliLocale } from './types'

const QUOTE_TTL_SECONDS = 10 * 60
const RATE_ENDPOINT = 'https://api.frankfurter.dev/v1/latest'

type FeeConfig = {
  percent: number
  fixed: number
  fxMarginPercent: number
}

export type InternationalQuote = {
  quoteId: string
  baseCurrency: 'BRL'
  baseAmountCents: number
  currency: LiliCurrency
  rate: number
  convertedAmount: number
  paypalPercent: number
  paypalFixed: number
  fxMarginPercent: number
  totalAmount: number
  totalMinor: number
  createdAt: string
  expiresAt: string
  source: 'frankfurter'
}

function numberEnv(name: string, fallback = 0) {
  const value = Number(process.env[name] ?? fallback)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function feeConfig(currency: LiliCurrency): FeeConfig {
  if (currency === 'USD') {
    return {
      percent: numberEnv('PAYPAL_FEE_PERCENT_USD'),
      fixed: numberEnv('PAYPAL_FEE_FIXED_USD'),
      fxMarginPercent: numberEnv('FX_SAFETY_MARGIN_PERCENT'),
    }
  }
  if (currency === 'EUR') {
    return {
      percent: numberEnv('PAYPAL_FEE_PERCENT_EUR'),
      fixed: numberEnv('PAYPAL_FEE_FIXED_EUR'),
      fxMarginPercent: numberEnv('FX_SAFETY_MARGIN_PERCENT'),
    }
  }
  return { percent: 0, fixed: 0, fxMarginPercent: 0 }
}

function quoteSecret() {
  const secret = String(process.env.CURRENCY_QUOTE_SECRET || process.env.PAYPAL_CLIENT_SECRET || '').trim()
  if (!secret) throw new Error('Defina CURRENCY_QUOTE_SECRET para assinar as cotações internacionais.')
  return secret
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(payload: string) {
  return createHmac('sha256', quoteSecret()).update(payload).digest('base64url')
}

export function createQuoteToken(payload: Omit<InternationalQuote, 'quoteId'>) {
  const encoded = encode(JSON.stringify(payload))
  return `${encoded}.${sign(encoded)}`
}

export function verifyQuoteToken(token: string): Omit<InternationalQuote, 'quoteId'> {
  const [encoded, signature] = String(token || '').split('.')
  if (!encoded || !signature) throw new Error('Cotação inválida.')
  const expected = sign(encoded)
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error('Cotação inválida.')
  const payload = JSON.parse(decode(encoded))
  if (!payload?.expiresAt || Date.parse(payload.expiresAt) <= Date.now()) throw new Error('Esta cotação expirou. Gere uma nova cotação.')
  return payload
}

export async function getBrlRate(currency: LiliCurrency) {
  if (currency === 'BRL') return 1
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${RATE_ENDPOINT}?base=BRL&symbols=${currency}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('Não foi possível consultar a cotação internacional.')
    const data = await response.json()
    const rate = Number(data?.rates?.[currency])
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Cotação internacional inválida.')
    return rate
  } finally {
    clearTimeout(timeout)
  }
}

export async function createInternationalQuote(baseAmountCents: number, currency: LiliCurrency): Promise<InternationalQuote> {
  if (!Number.isInteger(baseAmountCents) || baseAmountCents <= 0) throw new Error('Valor-base inválido para cotação.')
  if (!['BRL', 'USD', 'EUR'].includes(currency)) throw new Error('Moeda não suportada.')

  const rate = await getBrlRate(currency)
  const baseBrl = baseAmountCents / 100
  const converted = baseBrl * rate
  const fees = feeConfig(currency)
  const protectedConverted = converted * (1 + fees.fxMarginPercent / 100)
  const divisor = 1 - fees.percent / 100
  if (divisor <= 0) throw new Error('Percentual de tarifa inválido.')
  const total = currency === 'BRL' ? converted : (protectedConverted + fees.fixed) / divisor
  const totalMinor = Math.ceil(total * 100)
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + QUOTE_TTL_SECONDS * 1000)
  const unsigned = {
    baseCurrency: 'BRL' as const,
    baseAmountCents,
    currency,
    rate,
    convertedAmount: Number(converted.toFixed(6)),
    paypalPercent: fees.percent,
    paypalFixed: fees.fixed,
    fxMarginPercent: fees.fxMarginPercent,
    totalAmount: totalMinor / 100,
    totalMinor,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source: 'frankfurter' as const,
  }
  return { ...unsigned, quoteId: createQuoteToken(unsigned) }
}

export function formatMoney(amount: number, currency: LiliCurrency, locale: LiliLocale) {
  const localeCode = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-419' : 'pt-BR'
  return new Intl.NumberFormat(localeCode, { style: 'currency', currency }).format(amount)
}
