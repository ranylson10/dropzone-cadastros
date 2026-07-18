import { supabase } from '@/lib/supabase-browser'
import type { StreamOverlay, StreamSheetId, StreamSheetRow } from '../types/stream.types'
import { migrateOverlay } from '../utils/migrate-overlay'

async function authFetch(url: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const response = await fetch(url, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Falha ao carregar dados do stream.')
  return payload
}

function text(value: unknown) {
  if (value == null) return ''
  return String(value)
}

/** Converte payload de APIs existentes em linhas da planilha Stream. */
export async function loadStreamSheet(campeonatoId: string, sheetId: StreamSheetId): Promise<StreamSheetRow[]> {
  if (sheetId === 'equipes') {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/equipes`)
    const vagas = Array.isArray(payload.vagas) ? payload.vagas : []
    return vagas
      .filter((v: any) => v?.status === 'ocupada' || v?.campeonato_equipe)
      .map((v: any, index: number) => {
        const ce = v.campeonato_equipe || {}
        return {
          id: text(ce.id || v.slot_id || `eq-${index}`),
          cells: {
            slot: text(v.slot_letra || v.numero_vaga || v.slot_numero || ''),
            line: text(v.line_nome || ce.line_nome || ce.nome_exibicao || ''),
            tag: text(v.line_tag || ce.line_tag || ''),
            grupo: text(v.grupo?.nome || ''),
            status: text(v.status || ''),
            origem: text(ce.origem_entrada || ''),
          },
        }
      })
  }

  if (sheetId === 'jogadores') {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/jogadores`)
    const lines = Array.isArray(payload.participacoes)
      ? payload.participacoes
      : Array.isArray(payload.lines)
        ? payload.lines
        : []
    const rows: StreamSheetRow[] = []
    for (const line of lines) {
      const players = Array.isArray(line.jogadores) ? line.jogadores : []
      const lineName = text(line.line?.nome || line.nome_exibicao || line.line_nome || '')
      const slotLabel = text(line.vaga?.slot_letra || line.vaga?.numero_vaga || line.slot_letra || '')
      if (!players.length) {
        rows.push({
          id: text(line.id || `line-${rows.length}`),
          cells: {
            nick: '',
            id_jogo: '',
            line: lineName,
            funcao: '',
            slot: slotLabel,
            status: text(line.status_escalacao || 'sem jogadores'),
          },
        })
        continue
      }
      for (const p of players) {
        rows.push({
          id: text(p.id || `${line.id}-${p.nick}-${rows.length}`),
          cells: {
            nick: text(p.nick || ''),
            id_jogo: text(p.id_jogo || ''),
            line: lineName,
            funcao: text(p.funcao || ''),
            slot: slotLabel,
            status: text(p.status || line.status_escalacao || ''),
          },
        })
      }
    }
    return rows
  }

  if (sheetId === 'classificacao') {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/estatisticas/equipes`)
    const equipes = Array.isArray(payload.equipes) ? payload.equipes : []
    return equipes.map((row: any, index: number) => ({
      id: text(row.campeonato_equipe_id || row.id || `cl-${index}`),
      cells: {
        colocacao: text(row.colocacao ?? index + 1),
        line: text(row.nome || row.line_nome || row.nome_exibicao || ''),
        tag: text(row.tag || ''),
        booyahs: text(row.booyahs ?? row.booyah ?? 0),
        abates: text(row.abates ?? row.kills ?? 0),
        pontos: text(row.pontos_total ?? row.pontos ?? 0),
      },
    }))
  }

  if (sheetId === 'mvp') {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/estatisticas/mvp`)
    const jogadores = Array.isArray(payload.jogadores) ? payload.jogadores : []
    return jogadores.map((row: any, index: number) => {
      const abates = Number(row.abates || 0)
      const quedas = Math.max(1, Number(row.quedas || 1))
      const kd = (abates / quedas).toFixed(1).replace('.', ',')
      return {
        id: text(row.campeonato_jogador_id || row.id || `mvp-${index}`),
        cells: {
          colocacao: text(row.colocacao ?? index + 1),
          nick: text(row.nick || '—'),
          abates: text(abates),
          quedas: text(row.quedas ?? 0),
          kd,
          dano: text(row.dano ?? 0),
        },
      }
    })
  }

  if (sheetId === 'jogos' || sheetId === 'quedas') {
    const payload = await authFetch(`/api/campeonatos/${campeonatoId}/jogos`)
    const jogos = Array.isArray(payload.jogos) ? payload.jogos : []
    if (sheetId === 'jogos') {
      return jogos.map((jogo: any, index: number) => {
        const quedas = Array.isArray(jogo.quedas) ? jogo.quedas : []
        const mapas = quedas
          .map((q: any) => q.mapa_nome || q.mapa_codigo || q.nome_mapa || '')
          .filter(Boolean)
          .join(', ')
        return {
          id: text(jogo.id || `jogo-${index}`),
          cells: {
            nome: text(jogo.nome || `Jogo ${index + 1}`),
            data: text(jogo.data_jogo || ''),
            horario: text(jogo.horario || ''),
            status: text(jogo.status || ''),
            quedas: text(quedas.length),
            mapas: text(mapas),
          },
        }
      })
    }
    const rows: StreamSheetRow[] = []
    for (const jogo of jogos) {
      const quedas = Array.isArray(jogo.quedas) ? jogo.quedas : []
      for (const q of quedas) {
        rows.push({
          id: text(q.id || `${jogo.id}-${q.numero_partida}`),
          cells: {
            jogo: text(jogo.nome || ''),
            numero: text(q.numero_partida ?? q.numero ?? ''),
            mapa: text(q.mapa_nome || q.mapa_codigo || q.nome_mapa || '—'),
            status: text(q.status || ''),
            horario: text(q.horario || jogo.horario || ''),
            id: text(q.id || ''),
          },
        })
      }
    }
    return rows
  }

  return []
}

const OVERLAY_KEY = (campeonatoId: string) => `dropzone_stream_overlays_${campeonatoId}`

export function listLocalOverlays(campeonatoId: string): StreamOverlay[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OVERLAY_KEY(campeonatoId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(migrateOverlay).filter(Boolean) as StreamOverlay[]
  } catch {
    return []
  }
}

export function saveLocalOverlays(campeonatoId: string, overlays: StreamOverlay[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(OVERLAY_KEY(campeonatoId), JSON.stringify(overlays))
}

export function getLocalOverlay(campeonatoId: string, overlayId: string) {
  return listLocalOverlays(campeonatoId).find((item) => item.id === overlayId) || null
}

export function upsertLocalOverlay(campeonatoId: string, overlay: StreamOverlay) {
  const list = listLocalOverlays(campeonatoId)
  const index = list.findIndex((item) => item.id === overlay.id)
  if (index >= 0) list[index] = overlay
  else list.unshift(overlay)
  saveLocalOverlays(campeonatoId, list)
  return overlay
}

export function removeLocalOverlay(campeonatoId: string, overlayId: string) {
  const list = listLocalOverlays(campeonatoId).filter((item) => item.id !== overlayId)
  saveLocalOverlays(campeonatoId, list)
}
