import type { PostArtworkPlayerRow, PostArtworkTeamRow } from '../types/artwork.types'

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


async function loadPostArtworkMvp(campeonatoId: string, rodadaId?: string): Promise<PostArtworkPlayerRow[]> {
  const query = rodadaId ? `?rodada_id=${encodeURIComponent(rodadaId)}` : ''
  const [mvpResponse, teamsResponse] = await Promise.all([
    fetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/estatisticas/mvp${query}`, { cache: 'no-store' }),
    fetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/estatisticas/equipes${query}`, { cache: 'no-store' }),
  ])
  const [payload, teamsPayload] = await Promise.all([mvpResponse.json().catch(() => ({})), teamsResponse.json().catch(() => ({}))])
  if (!mvpResponse.ok) throw new Error(payload?.error || 'Não foi possível carregar o ranking MVP.')
  const teamByChampionshipId = new Map((Array.isArray(teamsPayload?.equipes) ? teamsPayload.equipes : []).map((row: any) => [String(row.campeonato_equipe_id || ''), String(row.nome || row.tag || '')]))
  const jogadores = Array.isArray(payload?.jogadores) ? payload.jogadores : []
  return jogadores.map((row: any, index: number) => ({
    rank: number(row.colocacao) || index + 1,
    id: String(row.campeonato_jogador_id || row.jogador_id || index),
    nick: String(row.nick || 'Jogador'),
    gameId: String(row.id_jogo || ''),
    photo: String(row.foto_url || ''),
    team: teamByChampionshipId.get(String(row.campeonato_equipe_id || '')) || '',
    drops: number(row.quedas),
    kills: number(row.abates),
    damage: number(row.dano),
    assists: number(row.assistencias),
  }))
}

export function loadPostArtworkGeneralMvp(campeonatoId: string) {
  return loadPostArtworkMvp(campeonatoId)
}

export function loadPostArtworkDayMvp(campeonatoId: string, rodadaId: string) {
  return loadPostArtworkMvp(campeonatoId, rodadaId)
}


export async function loadPostArtworkDayBooyahs(campeonatoId: string, rodadaId: string) {
  const rows = await loadPostArtworkTeamStandings(campeonatoId, rodadaId)
  return [...rows].sort((a, b) => b.booyah - a.booyah || b.kills - a.kills || b.points - a.points || a.rank - b.rank)
}

export async function loadPostArtworkKillLeaders(campeonatoId: string) {
  const rows = await loadPostArtworkMvp(campeonatoId)
  return [...rows].sort((a, b) => b.kills - a.kills || b.damage - a.damage || a.rank - b.rank).map((row, index) => ({ ...row, rank: index + 1 }))
}
