import { supabase } from '@/lib/supabase-browser'
import { loadStreamSheet } from './stream-data.service'
import type { StreamSheetRow } from '../types/stream.types'
import type { StreamPackageRenderData, StreamPackageRenderItem } from '../types/stream-package.types'
import type { StreamSystemOverlayType } from '../types/stream-package.types'

async function authFetch(url: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const response = await fetch(url, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Falha ao carregar dados da overlay.')
  return payload
}

function value(row: StreamSheetRow, key: string) {
  return row.cells?.[key] ?? ''
}

function teamItem(row: StreamSheetRow): StreamPackageRenderItem {
  return {
    rank: value(row, 'pos'),
    logo: value(row, 'logo'),
    name: value(row, 'nome'),
    group: value(row, 'grupo'),
    drops: value(row, 'quedas'),
    booyah: value(row, 'booyahs'),
    position: value(row, 'pos_morte') || value(row, 'pos'),
    kills: value(row, 'abates'),
    points: value(row, 'pontos'),
  }
}

function playerItem(row: StreamSheetRow): StreamPackageRenderItem {
  return {
    rank: value(row, 'pos'),
    logo: value(row, 'logo'),
    nick: value(row, 'nick'),
    drops: value(row, 'quedas'),
    kd: value(row, 'kd'),
    kills: value(row, 'abates'),
  }
}

function booyahItem(row: StreamSheetRow): StreamPackageRenderItem {
  return {
    map: value(row, 'imagem'),
    logo: value(row, 'booyah_logo'),
    name: value(row, 'booyah_nome'),
    points: value(row, 'pontos'),
    kills: value(row, 'abates'),
    round: value(row, 'queda'),
  }
}

function nextRoundItem(row: StreamSheetRow): StreamPackageRenderItem {
  const numero = String(value(row, 'queda_numero') || '').trim()
  return {
    map: value(row, 'mapa_img'),
    name: value(row, 'mapa_nome'),
    round: numero ? `QUEDA ${numero}` : value(row, 'jogo'),
  }
}

async function loadChampion(campeonatoId: string): Promise<StreamPackageRenderData> {
  const payload = await authFetch(`/api/campeonatos/${campeonatoId}/estatisticas/campeao`)
  const champion = payload?.final_concluida ? payload?.campeao : null
  if (!champion) {
    return {
      items: [],
      source: 'estatisticas/campeao',
      emptyMessage: 'O campeão aparece automaticamente quando a final estiver concluída.',
    }
  }
  return {
    items: [{
      logo: champion.logo_url || '',
      name: champion.nome || champion.line_nome || 'Campeão',
      points: champion.pontos_total ?? champion.pontos ?? '',
      kills: champion.abates ?? '',
    }],
    source: 'estatisticas/campeao',
  }
}

async function fromSheet(
  campeonatoId: string,
  sheet: Parameters<typeof loadStreamSheet>[1],
  mapper: (row: StreamSheetRow) => StreamPackageRenderItem,
  source: string,
): Promise<StreamPackageRenderData> {
  const rows = await loadStreamSheet(campeonatoId, sheet)
  return { items: rows.map(mapper), source }
}

export async function loadStreamPackageRenderData(
  campeonatoId: string,
  type: StreamSystemOverlayType,
): Promise<StreamPackageRenderData> {
  if (type === 'standings_general') {
    return fromSheet(campeonatoId, 'equipes_geral', teamItem, 'equipes_geral')
  }
  if (type === 'round_teams') {
    return fromSheet(campeonatoId, 'equipes_partida', teamItem, 'equipes_partida')
  }
  if (type === 'round_players') {
    return fromSheet(campeonatoId, 'mvp_partida', playerItem, 'mvp_partida')
  }
  if (type === 'mvp_general') {
    return fromSheet(campeonatoId, 'mvp_geral', playerItem, 'mvp_geral')
  }
  if (type === 'mvp_day') {
    return fromSheet(campeonatoId, 'mvp_dia', playerItem, 'mvp_dia')
  }
  if (type === 'mvp_round') {
    return fromSheet(campeonatoId, 'mvp_partida', playerItem, 'mvp_partida')
  }
  if (type === 'booyahs_day') {
    return fromSheet(campeonatoId, 'mapas', booyahItem, 'mapas')
  }
  if (type === 'next_round') {
    return fromSheet(campeonatoId, 'proxima_queda', nextRoundItem, 'proxima_queda')
  }
  if (type === 'champion') {
    return loadChampion(campeonatoId)
  }

  return {
    items: [],
    source: 'qualification-rule',
    emptyMessage: 'Defina a regra de classificação do campeonato antes de alimentar esta overlay automaticamente.',
  }
}
