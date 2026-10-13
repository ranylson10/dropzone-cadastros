import type { LiliLocale } from '@backend/lili/types'

export type AuthUser = { id: string; email?: string | null; email_confirmed_at?: string | null }

export function liliRegistrationDeadlineOpen(value: unknown) {
  if (!value) return true
  const raw = String(value)
  const deadline = raw.includes('T') ? new Date(raw) : new Date(`${raw.slice(0, 10)}T23:59:59.999`)
  return Number.isFinite(deadline.getTime()) && deadline.getTime() >= Date.now()
}

export function liliPriceMode(value: unknown): 'paid' | 'free' | 'consult' {
  if (value == null || value === '') return 'consult'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'consult'
  return amount <= 0 ? 'free' : 'paid'
}

export function liliMoney(cents: unknown, locale: LiliLocale = 'pt-BR') {
  const value = Number(cents || 0) / 100
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(value)
}
