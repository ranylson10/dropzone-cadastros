import { loadStreamSheet } from '../../stream/services/stream-data.service'
import type { PostArtworkPlayerRow, PostArtworkTeamRow } from '../types/artwork.types'

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function movementNumber(value: unknown) {
  const match = String(value ?? '').match(/[+-]?\d+/)
  return match ? Number(match[0]) || 0 : 0
}

function normalizeTeamName(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR')
}

async function loadMovementByTeam(campeonatoId: string, jogoId?: string) {
  try {
    const rows = await loadStreamSheet(campeonatoId, jogoId ? 'equipes_jogo' : 'equipes_geral', jogoId ? { jogo_id: jogoId } : undefined)
    return new Map(rows.map((row) => [normalizeTeamName(row.cells?.nome), movementNumber(row.cells?.delta)]))
  } catch {
    return new Map<string, number>()
  }
}

async function loadPostArtworkTeamStandings(campeonatoId: string, jogoId?: string): Promise<PostArtworkTeamRow[]> {
  const query = jogoId ? `?jogo_id=${encodeURIComponent(jogoId)}` : ''
  const response = await fetch(`/api/campeonatos/${encodeURIComponent(campeonatoId)}/estatisticas/equipes${query}`, { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar a tabela de equipes.')
  const equipes = Array.isArray(payload?.equipes) ? payload.equipes : []
  const movementByTeam = await loadMovementByTeam(campeonatoId, jogoId)
  return equipes.map((row: any, index: number) => ({
    rank: number(row.colocacao) || index + 1,
    movement: movementByTeam.get(normalizeTeamName(row.nome || row.tag)) ?? movementNumber(row.delta ?? row.variacao),
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

export function loadPostArtworkGameStandings(campeonatoId: string, jogoId: string) {
  return loadPostArtworkTeamStandings(campeonatoId, jogoId)
}

export const loadPostArtworkDayStandings = loadPostArtworkGameStandings


async function loadPostArtworkMvp(campeonatoId: string, jogoId?: string): Promise<PostArtworkPlayerRow[]> {
  const query = jogoId ? `?jogo_id=${encodeURIComponent(jogoId)}` : ''
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

export function loadPostArtworkGameMvp(campeonatoId: string, jogoId: string) {
  return loadPostArtworkMvp(campeonatoId, jogoId)
}

export const loadPostArtworkDayMvp = loadPostArtworkGameMvp


export async function loadPostArtworkGameBooyahs(campeonatoId: string, jogoId: string) {
  const rows = await loadPostArtworkTeamStandings(campeonatoId, jogoId)
  return [...rows].sort((a, b) => b.booyah - a.booyah || b.kills - a.kills || b.points - a.points || a.rank - b.rank)
}

export const loadPostArtworkDayBooyahs = loadPostArtworkGameBooyahs

export async function loadPostArtworkGameKillLeaders(campeonatoId: string, jogoId: string) {
  const rows = await loadPostArtworkMvp(campeonatoId, jogoId)
  return [...rows].sort((a, b) => b.kills - a.kills || b.damage - a.damage || a.rank - b.rank).map((row, index) => ({ ...row, rank: index + 1 }))
}
