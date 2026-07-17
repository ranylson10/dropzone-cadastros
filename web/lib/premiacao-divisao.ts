/** Divisão estruturada da premiação (campeonato + rulebook). */

export type PremiacaoDivisaoItem = {
  id: string
  nome: string
  /** Valor em reais (ex.: 500.5) */
  valor: number
}

export function newDivisaoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `div-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function parseMoneyNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  // "R$ 1.234,56" ou "1234.56" ou "1234,56"
  const cleaned = raw
    .replace(/r\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, (m, offset, str) => (String(str).includes(',') ? '' : m))
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function formatMoneyBRL(value: number | string | null | undefined): string {
  const n = typeof value === 'number' ? value : parseMoneyNumber(value)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(n || 0)
}

/** Converte input de moeda (digitando centavos) para string "1234.56" */
export function moneyInputToValue(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toFixed(2)
}

export function moneyValueToDisplay(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return ''
  return formatMoneyBRL(n)
}

export function parseDivisaoPremiacao(raw: unknown): PremiacaoDivisaoItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return normalizeItems(raw)
  }
  const text = String(raw).trim()
  if (!text) return []

  // JSON array
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return normalizeItems(parsed)
    } catch {
      // fall through
    }
  }

  // Legado: texto livre "1º R$ 500, 2º R$ 300" — uma linha por item se houver quebras
  const lines = text.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean)
  const items: PremiacaoDivisaoItem[] = []
  for (const line of lines) {
    const moneyMatch = line.match(/([\d.]+,\d{2}|[\d]+(?:[.,]\d+)?)/)
    const valor = moneyMatch ? parseMoneyNumber(moneyMatch[0]) : 0
    let nome = line
      .replace(/r\$\s*[\d.,]+/gi, '')
      .replace(/[\d.]+,\d{2}/g, '')
      .replace(/[-–—:|]+$/g, '')
      .trim()
    if (!nome) nome = `Posição ${items.length + 1}`
    if (valor > 0 || nome) {
      items.push({ id: newDivisaoId(), nome, valor })
    }
  }
  return items
}

function normalizeItems(raw: unknown[]): PremiacaoDivisaoItem[] {
  return raw
    .map((item, index) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const nome = String(row.nome || row.name || row.label || `Posição ${index + 1}`).trim()
      const valor = parseMoneyNumber(row.valor ?? row.value ?? row.amount ?? 0)
      return {
        id: String(row.id || newDivisaoId()),
        nome: nome || `Posição ${index + 1}`,
        valor,
      }
    })
    .filter((i) => i.nome)
}

export function serializeDivisaoPremiacao(items: PremiacaoDivisaoItem[]): string {
  const clean = items
    .map((i) => ({
      id: i.id || newDivisaoId(),
      nome: String(i.nome || '').trim(),
      valor: Math.round(parseMoneyNumber(i.valor) * 100) / 100,
    }))
    .filter((i) => i.nome)
  if (!clean.length) return ''
  return JSON.stringify(clean)
}

export function sumDivisaoPremiacao(items: PremiacaoDivisaoItem[]): number {
  return items.reduce((acc, i) => acc + parseMoneyNumber(i.valor), 0)
}

export function remainingPremiacao(total: number | string, items: PremiacaoDivisaoItem[]): number {
  const t = parseMoneyNumber(total)
  const used = sumDivisaoPremiacao(items)
  return Math.round((t - used) * 100) / 100
}

export function formatDivisaoPremiacaoText(items: PremiacaoDivisaoItem[]): string {
  if (!items.length) return ''
  return items
    .map((i) => `${i.nome}: ${formatMoneyBRL(i.valor)}`)
    .join('\n')
}

export function buildPremiacaoDescricao(input: {
  tipo_premiacao?: string | null
  premiacao?: string | number | null
  divisao_premiacao?: string | null
  descricao_premiacao?: string | null
  tem_trofeu?: boolean | null
}): string {
  const tipo = String(input.tipo_premiacao || '').toLowerCase()
  if (tipo === 'sem_premiacao') return 'Sem premiação em dinheiro ou brindes definidos.'
  if (tipo === 'brinde') {
    return String(input.descricao_premiacao || 'Brindes conforme definido pela organização.')
  }
  const parts: string[] = []
  const total = parseMoneyNumber(input.premiacao)
  if (total > 0) parts.push(`Premiação total: ${formatMoneyBRL(total)}.`)
  const items = parseDivisaoPremiacao(input.divisao_premiacao)
  if (items.length) {
    parts.push('Divisão:')
    parts.push(formatDivisaoPremiacaoText(items))
  }
  if (input.tem_trofeu) parts.push('Inclui troféu.')
  if (input.descricao_premiacao && tipo !== 'brinde') {
    parts.push(String(input.descricao_premiacao))
  }
  return parts.join('\n') || 'Premiação conforme definido pela organização.'
}
