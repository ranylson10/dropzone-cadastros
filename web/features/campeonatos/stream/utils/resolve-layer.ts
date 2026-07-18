import type { CSSProperties } from 'react'
import type { LayerDataSource, StreamLayer, StreamSheetId, StreamSheetRow } from '../types/stream.types'
import type { LiveMapCard, LiveStanding } from '../components/StreamLiveStage'

export type LayerResolveContext = {
  mapas: LiveMapCard[]
  classificacao: LiveStanding[]
  mvp: LiveStanding[]
  /** planilha real: sheetId → linhas de dados (sem header) */
  sheets?: Partial<Record<StreamSheetId, StreamSheetRow[]>>
}

export type ResolvedLayerContent = {
  kind: 'image' | 'text'
  src?: string
  text?: string
  empty?: boolean
}

function slotIndex(mapSlot: number) {
  return Math.max(0, (mapSlot || 1) - 1)
}

export function resolveLayerData(data: LayerDataSource, ctx: LayerResolveContext): ResolvedLayerContent {
  if (data.source === 'fixed') {
    return { kind: 'text', text: data.value || '' }
  }
  if (data.source === 'map_image') {
    const map = ctx.mapas[slotIndex(data.mapSlot)]
    return { kind: 'image', src: map?.imageUrl || undefined, empty: !map?.imageUrl }
  }
  if (data.source === 'map_name') {
    const map = ctx.mapas[slotIndex(data.mapSlot)]
    return { kind: 'text', text: map?.title || `MAPA ${data.mapSlot}` }
  }
  if (data.source === 'map_logo') {
    const map = ctx.mapas[slotIndex(data.mapSlot)]
    return { kind: 'image', src: map?.logo || undefined, empty: !map?.logo }
  }
  if (data.source === 'map_pts') {
    const map = ctx.mapas[slotIndex(data.mapSlot)]
    return { kind: 'text', text: `${map?.pts ?? 0} PTS` }
  }
  if (data.source === 'map_abates') {
    const map = ctx.mapas[slotIndex(data.mapSlot)]
    return { kind: 'text', text: `${map?.abates ?? 0} ABT.` }
  }
  if (data.source === 'standing') {
    const row = ctx.classificacao.find((r) => r.pos === data.rank) || ctx.classificacao[data.rank - 1]
    if (!row) return { kind: 'text', text: '—', empty: true }
    if (data.field === 'logo') return { kind: 'image', src: row.logo || undefined, empty: !row.logo }
    if (data.field === 'nome') return { kind: 'text', text: String(row.nome || '—') }
    if (data.field === 'pts') return { kind: 'text', text: String(row.pts ?? 0) }
    if (data.field === 'abates') return { kind: 'text', text: String(row.abates ?? 0) }
    if (data.field === 'booyah') return { kind: 'text', text: String(row.booyah ?? 0) }
    if (data.field === 'delta') return { kind: 'text', text: String(row.delta ?? 0) }
  }
  if (data.source === 'mvp') {
    const row = ctx.mvp.find((r) => r.pos === data.rank) || ctx.mvp[data.rank - 1]
    if (!row) return { kind: 'text', text: '—', empty: true }
    if (data.field === 'logo') return { kind: 'image', src: row.logo || undefined, empty: !row.logo }
    if (data.field === 'nome') return { kind: 'text', text: String(row.nome || '—') }
    if (data.field === 'abates') return { kind: 'text', text: String(row.abates ?? 0) }
    if (data.field === 'kd') return { kind: 'text', text: String(row.kd ?? '0') }
    if (data.field === 'quedas') return { kind: 'text', text: String(row.quedas ?? 0) }
  }
  if (data.source === 'cell') {
    const rows = ctx.sheets?.[data.sheetId] || []
    // rowIndex 1 = primeira linha de dados
    const row = rows[Math.max(0, data.rowIndex - 1)]
    const value = row?.cells?.[data.colKey]
    const text = value == null || value === '' ? '—' : String(value)
    const looksUrl = /^https?:\/\//i.test(text) || text.startsWith('/images/')
    if (looksUrl) return { kind: 'image', src: text, empty: false }
    return { kind: 'text', text, empty: !value }
  }
  return { kind: 'text', text: '' }
}

export function layerBoxStyle(layer: StreamLayer): CSSProperties {
  return {
    position: 'absolute',
    left: `${layer.x}%`,
    top: `${layer.y}%`,
    width: `${layer.w}%`,
    height: `${layer.h}%`,
    zIndex: layer.z || 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxSizing: 'border-box',
  }
}
