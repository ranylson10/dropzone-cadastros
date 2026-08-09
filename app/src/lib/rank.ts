export type RankedTeam = {
  key?: string
  rank?: number
  nome?: string
  tag?: string | null
  pontos?: number
  abates?: number
  booyahs?: number
  quedas?: number
}

export type RankedPlayer = {
  key?: string
  rank?: number
  nick?: string
  id_jogo?: string | null
  abates?: number
  dano?: number
  assistencias?: number
  revives?: number
  quedas?: number
  equipe_nome?: string | null
  equipe_tag?: string | null
  equipe_logo_url?: string | null
}

export const fallbackRank = {
  teams: [] as RankedTeam[],
  players: [] as RankedPlayer[],
}

export const kdLabel = (kills?: number, drops?: number) => {
  const safeDrops = Math.max(1, Number(drops || 0))
  return (Number(kills || 0) / safeDrops).toFixed(1).replace('.', ',')
}

