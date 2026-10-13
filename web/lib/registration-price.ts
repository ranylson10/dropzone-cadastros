export function registrationAmount(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (value == null || String(value).trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function registrationPriceLabel(value: unknown) {
  const amount = registrationAmount(value)
  if (amount == null) return 'Sob consulta'
  if (amount === 0) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}
