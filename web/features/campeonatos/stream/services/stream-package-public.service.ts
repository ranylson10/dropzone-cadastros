import 'server-only'

import { assertCampeonatoNoAr } from '@backend/admin/aprovacao'
import {
  carregarResumoCampeao,
  listarEstatisticasEquipes,
  listarEstatisticasMvp,
} from '@backend/campeonatos/estatisticas/estatisticas.service'
import {
  loadPartidasForStream,
  resolveStreamContext,
} from '@backend/campeonatos/stream/stream-context'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type {
  StreamPackageRenderData,
  StreamPackageRenderItem,
  StreamSystemOverlayType,
} from '../types/stream-package.types'

const MAP_IMAGES: Record<string, string> = {
  bermuda: '/images/maps/bermuda.png',
  purgatorio: '/images/maps/purgatorio.png',
  purgatório: '/images/maps/purgatorio.png',
  'nova terra': '/images/maps/nova-terra.png',
  'nova-terra': '/images/maps/nova-terra.png',
  kalahari: '/images/maps/kalahari.png',
  alpine: '/images/maps/alpine.png',
  solara: '/images/maps/solara.png',
  misterioso: '/images/maps/misterioso.png',
}

function text(value: unknown) {
  return value == null ? '' : String(value)
}

function mapImageFor(name: string, fallback?: string | null) {
  if (fallback) return String(fallback)
  const key = String(name || '').toLowerCase()
  const hit = Object.entries(MAP_IMAGES).find(([candidate]) => key.includes(candidate))
  return hit?.[1] || '/images/maps/bermuda.png'
}

function teamItem(row: any, index: number): StreamPackageRenderItem {
  return {
    rank: row.colocacao ?? index + 1,
    logo: row.logo_url || '',
    name: row.nome || row.line_nome || '—',
    group: row.grupo || row.grupo_nome || '',
    drops: row.quedas ?? 0,
    booyah: row.booyahs ?? row.booyah ?? 0,
    position: row.melhor_posicao ?? row.posicao ?? row.colocacao ?? index + 1,
    kills: row.abates ?? 0,
    points: row.pontos_total ?? row.pontos ?? 0,
  }
}

function playerItem(row: any, index: number, logoByTeam?: Map<string, string>): StreamPackageRenderItem {
  const kills = Number(row.abates || 0)
  const drops = Number(row.quedas || 0)
  return {
    rank: row.colocacao ?? index + 1,
    logo: logoByTeam?.get(String(row.campeonato_equipe_id || '')) || row.logo_url || '',
    nick: row.nick || '—',
    drops,
    kd: drops > 0 ? (kills / drops).toFixed(1).replace('.', ',') : '0,0',
    kills,
  }
}

function currentPartida(partidas: any[], activePartidaId?: string | null, allowFallback = true) {
  let currentIndex = activePartidaId
    ? partidas.findIndex((row) => String(row.id || '') === String(activePartidaId))
    : -1
  if (currentIndex < 0 && allowFallback) currentIndex = partidas.findIndex((row) => /em_andamento|andamento|live|ao.?vivo|em_jogo/i.test(String(row.status || '')))
  if (currentIndex < 0 && allowFallback) {
    let lastDone = -1
    for (let index = 0; index < partidas.length; index += 1) {
      if (/finaliz|conclu|encerr|done|finished/i.test(String(partidas[index].status || ''))) lastDone = index
    }
    currentIndex = lastDone >= 0 ? lastDone : (partidas.length ? 0 : -1)
  }
  return {
    index: currentIndex,
    current: currentIndex >= 0 ? partidas[currentIndex] : null,
    next: currentIndex >= 0 ? partidas[currentIndex + 1] || null : null,
  }
}

async function teamLogoMap(campeonatoId: string) {
  const rows = await listarEstatisticasEquipes(campeonatoId, {}).catch(() => [] as any[])
  return new Map(rows.map((row: any) => [String(row.campeonato_equipe_id || ''), String(row.logo_url || '')]))
}

async function loadBooyahs(campeonatoId: string, jogoId: string | null, partidas: any[]): Promise<StreamPackageRenderData> {
  if (!partidas.length) return { items: [], source: 'mapas', emptyMessage: 'Nenhuma queda disponível no jogo ativo.' }

  let query = supabaseAdmin
    .from('campeonato_estatisticas_equipes_detalhe')
    .select('partida_id,campeonato_equipe_id,nome_exibicao,line_nome,equipe_nome,line_logo_url,equipe_logo_url,abates,pontos_total,booyah')
    .eq('campeonato_id', campeonatoId)
  if (jogoId) query = query.eq('jogo_id', jogoId)
  const { data } = await query

  const winnerByPartida = new Map<string, any>()
  for (const row of data || []) {
    if (!row.booyah) continue
    winnerByPartida.set(String(row.partida_id || ''), row)
  }

  const items = partidas.map((partida, index) => {
    const winner = winnerByPartida.get(String(partida.id || ''))
    const mapName = text(partida.mapa_nome || partida.mapa_codigo || `Mapa ${index + 1}`)
    return {
      map: mapImageFor(mapName, partida.mapa_imagem_url || partida.imagem_url || null),
      logo: winner?.line_logo_url || winner?.equipe_logo_url || '',
      name: winner?.nome_exibicao || winner?.line_nome || winner?.equipe_nome || '',
      points: winner?.pontos_total ?? '',
      kills: winner?.abates ?? '',
      round: `QUEDA ${partida.numero_partida || index + 1}`,
    }
  })

  return { items, source: 'mapas' }
}

export async function loadPublicStreamPackageRenderData(
  campeonatoId: string,
  type: StreamSystemOverlayType,
): Promise<StreamPackageRenderData> {
  await assertCampeonatoNoAr(campeonatoId)

  const context = await resolveStreamContext(campeonatoId)
  const partidas = context.explicitState && !context.activeJogoId
    ? []
    : await loadPartidasForStream(campeonatoId, context.activeJogoId)
  const partidaState = currentPartida(partidas, context.activePartidaId, !context.explicitState)

  if (type === 'standings_general') {
    const rows = await listarEstatisticasEquipes(campeonatoId, {})
    return { items: rows.map(teamItem), source: 'equipes_geral' }
  }

  if (type === 'round_teams') {
    if (!partidaState.current?.id) return { items: [], source: 'equipes_partida', emptyMessage: 'Nenhuma queda atual disponível.' }
    const rows = await listarEstatisticasEquipes(campeonatoId, { partidaId: partidaState.current.id })
    return { items: rows.map(teamItem), source: 'equipes_partida' }
  }

  if (type === 'round_players' || type === 'mvp_round') {
    if (!partidaState.current?.id) return { items: [], source: 'mvp_partida', emptyMessage: 'Nenhuma queda atual disponível.' }
    const [rows, logos] = await Promise.all([
      listarEstatisticasMvp(campeonatoId, { partidaId: partidaState.current.id }),
      teamLogoMap(campeonatoId),
    ])
    return { items: rows.map((row, index) => playerItem(row, index, logos)), source: 'mvp_partida' }
  }

  if (type === 'mvp_general') {
    const [rows, logos] = await Promise.all([
      listarEstatisticasMvp(campeonatoId, {}),
      teamLogoMap(campeonatoId),
    ])
    return { items: rows.map((row, index) => playerItem(row, index, logos)), source: 'mvp_geral' }
  }

  if (type === 'mvp_day') {
    const [rows, logos] = await Promise.all([
      listarEstatisticasMvp(campeonatoId, context.activeJogoId ? { jogoId: context.activeJogoId } : {}),
      teamLogoMap(campeonatoId),
    ])
    return { items: rows.map((row, index) => playerItem(row, index, logos)), source: 'mvp_dia' }
  }

  if (type === 'booyahs_day') {
    return loadBooyahs(campeonatoId, context.activeJogoId, partidas)
  }

  if (type === 'next_round') {
    const next = partidaState.next
    if (!next) return { items: [], source: 'proxima_queda', emptyMessage: 'Não há próxima queda disponível.' }
    const mapName = text(next.mapa_nome || next.mapa_codigo || 'Mapa')
    return {
      items: [{
        map: mapImageFor(mapName, next.mapa_imagem_url || next.imagem_url || null),
        name: mapName.toUpperCase(),
        round: `QUEDA ${next.numero_partida || partidaState.index + 2}`,
      }],
      source: 'proxima_queda',
    }
  }

  if (type === 'champion') {
    const summary = await carregarResumoCampeao(campeonatoId)
    const champion = summary.final_concluida ? summary.campeao : null
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

  return {
    items: [],
    source: 'qualification-rule',
    emptyMessage: 'Defina a regra de classificação do campeonato antes de alimentar esta overlay automaticamente.',
  }
}
