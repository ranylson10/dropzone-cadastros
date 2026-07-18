import { supabase } from '@/lib/supabase-browser'
import type { StreamSheetId, StreamSheetRow } from '../types/stream.types'

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

  // classificacao
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

const OVERLAY_KEY = (campeonatoId: string) => `dropzone_stream_overlays_${campeonatoId}`

export function listLocalOverlays(campeonatoId: string) {
  if (typeof window === 'undefined') return [] as import('../types/stream.types').StreamOverlay[]
  try {
    const raw = localStorage.getItem(OVERLAY_KEY(campeonatoId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLocalOverlays(campeonatoId: string, overlays: import('../types/stream.types').StreamOverlay[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(OVERLAY_KEY(campeonatoId), JSON.stringify(overlays))
}

export function getLocalOverlay(campeonatoId: string, overlayId: string) {
  return listLocalOverlays(campeonatoId).find((item) => item.id === overlayId) || null
}

export function upsertLocalOverlay(
  campeonatoId: string,
  overlay: import('../types/stream.types').StreamOverlay,
) {
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
