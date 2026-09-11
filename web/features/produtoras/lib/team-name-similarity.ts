export type ExistingTeamCandidate = {
  id: string
  nome: string
  tag?: string | null
  logo_url?: string | null
  public_id?: number | string | null
  status?: string | null
}

export type TeamNameMatch = ExistingTeamCandidate & {
  kind: 'exact' | 'similar'
  score: number
}

const GENERIC_WORDS = new Set(['da', 'das', 'de', 'do', 'dos', 'e', 'equipe', 'esport', 'esports', 'gaming', 'team', 'the'])

export function normalizeTeamName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function meaningfulName(value: string) {
  const words = normalizeTeamName(value).split(' ').filter((word) => word && !GENERIC_WORDS.has(word))
  return words.join(' ') || normalizeTeamName(value)
}

function bigrams(value: string) {
  const compact = value.replace(/\s+/g, '')
  if (compact.length < 2) return [compact]
  return Array.from({ length: compact.length - 1 }, (_, index) => compact.slice(index, index + 2))
}

function diceCoefficient(left: string, right: string) {
  const a = bigrams(left)
  const b = bigrams(right)
  const remaining = new Map<string, number>()
  b.forEach((part) => remaining.set(part, (remaining.get(part) || 0) + 1))
  let intersection = 0
  a.forEach((part) => {
    const count = remaining.get(part) || 0
    if (!count) return
    intersection += 1
    remaining.set(part, count - 1)
  })
  return a.length + b.length ? (2 * intersection) / (a.length + b.length) : 0
}

export function compareTeamNames(input: string, existing: string) {
  const normalizedInput = normalizeTeamName(input)
  const normalizedExisting = normalizeTeamName(existing)
  if (!normalizedInput || !normalizedExisting) return { kind: null, score: 0 } as const
  if (normalizedInput === normalizedExisting) return { kind: 'exact', score: 1 } as const

  const compactInput = normalizedInput.replace(/\s+/g, '')
  const compactExisting = normalizedExisting.replace(/\s+/g, '')
  const score = Math.max(
    diceCoefficient(normalizedInput, normalizedExisting),
    diceCoefficient(meaningfulName(normalizedInput), meaningfulName(normalizedExisting)),
  )
  const shorter = Math.min(compactInput.length, compactExisting.length)
  const longer = Math.max(compactInput.length, compactExisting.length)
  const contained = shorter >= 4
    && (compactInput.includes(compactExisting) || compactExisting.includes(compactInput))
    && shorter / longer >= 0.6

  return score >= 0.72 || contained ? { kind: 'similar', score } as const : { kind: null, score } as const
}

export function findTeamNameMatches(input: string, teams: ExistingTeamCandidate[], limit = 3): TeamNameMatch[] {
  return teams
    .flatMap((team) => {
      const comparison = compareTeamNames(input, team.nome)
      return comparison.kind ? [{ ...team, kind: comparison.kind, score: comparison.score }] : []
    })
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'exact' ? -1 : 1
      return right.score - left.score || left.nome.localeCompare(right.nome, 'pt-BR')
    })
    .slice(0, limit)
}
