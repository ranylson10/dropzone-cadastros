import type { PostArtworkTeamRow } from '../types/artwork.types'

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function loadPostArtworkTeamStandings(campeonatoId: string, rodadaId?: string): Promise<PostArtworkTeamRow[]> {
  const query = rodadaId ? `?rodada_id=${encodeURIComponent(rodadaId)}` : ''
  const response = await fetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/estatisticas/equipes${query}`, { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar a tabela de equipes.')
  const equipes = Array.isArray(payload?.equipes) ? payload.equipes : []
  return equipes.map((row: any, index: number) => ({
    rank: number(row.colocacao) || index + 1,
    logo: String(row.logo_url || ''),
    name: String(row.nome || row.tag || 'Equipe'),
    drops: number(row.quedas),
    booyah: number(row.booyahs),
    kills: number(row.abates),
    points: number(row.pontos_total),
  }))
}

export function loadPostArtworkGeneralStandings(campeonatoId: string) {
  return loadPostArtworkTeamStandings(campeonatoId)
}

export function loadPostArtworkDayStandings(campeonatoId: string, rodadaId: string) {
  return loadPostArtworkTeamStandings(campeonatoId, rodadaId)
}
