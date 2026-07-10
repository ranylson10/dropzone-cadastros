export const CHAMPIONSHIP_TYPES = ['diario', 'copa', 'liga', 'xtreino', 'confronto'] as const

export type ChampionshipType = (typeof CHAMPIONSHIP_TYPES)[number]

export const CHAMPIONSHIP_TYPE_LABELS: Record<ChampionshipType, string> = {
  diario: 'Diario',
  copa: 'Copa',
  liga: 'Liga',
  xtreino: 'Xtreino',
  confronto: 'Confronto',
}

export const GROUP_LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
export const DAILY_HOURS = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}h`)
