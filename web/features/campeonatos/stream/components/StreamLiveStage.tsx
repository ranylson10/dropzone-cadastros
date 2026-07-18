'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { FRAME_H, FRAME_W, type StreamBlock } from '../types/stream.types'
import { transitionClass, transitionStyle } from '../utils/stream-style'
import { ensureCardLayers } from '../utils/card-layers'
import { ensureTableStructure, tableOuterWidth } from '../utils/table-structure'
import { CardLayerCanvas } from './CardLayerCanvas'
import { StreamTableCanvas } from './StreamTableCanvas'
import type { PreviewStanding } from './editor/OverlayPreview'

function blockPlaceStyle(block: StreamBlock, frameW: number, frameH: number): CSSProperties {
  const fw = Math.max(1, frameW)
  const fh = Math.max(1, frameH)
  const x = block.x ?? 0
  const y = block.y ?? 0
  if (block.type === 'card') {
    const card = ensureCardLayers(block)
    return {
      position: 'absolute',
      left: `${(x / fw) * 100}%`,
      top: `${(y / fh) * 100}%`,
      width: `${(card.canvasW / fw) * 100}%`,
      height: `${(card.canvasH / fh) * 100}%`,
    }
  }
  const table = ensureTableStructure(block)
  const w = tableOuterWidth(table)
  return {
    position: 'absolute',
    left: `${(x / fw) * 100}%`,
    top: `${(y / fh) * 100}%`,
    width: `${(w / fw) * 100}%`,
  }
}

export type LiveStanding = {
  pos: number
  nome: string
  logo?: string | null
  booyah?: number | string
  abates?: number | string
  pts?: number | string
  quedas?: number | string
  kd?: string
  delta?: string | number
}

export type LiveMapCard = {
  title: string
  imageUrl?: string | null
  logo?: string | null
  pts?: string | number
  abates?: string | number
  nome?: string
  sumula?: LiveStanding[]
}

export type StreamLiveData = {
  classificacao: LiveStanding[]
  mvp: LiveStanding[]
  mapas?: LiveMapCard[]
}

function fingerprint(data: StreamLiveData) {
  try {
    return JSON.stringify({
      c: (data.classificacao || []).map((r) => [r.pos, r.nome, r.pts, r.abates]),
      m: (data.mvp || []).map((r) => [r.pos, r.nome, r.abates]),
      maps: (data.mapas || []).map((r) => [r.title, r.pts, r.abates, r.nome]),
    })
  } catch {
    return String(Date.now())
  }
}

function withRankDelta(current: LiveStanding[], previous: LiveStanding[] | null): LiveStanding[] {
  if (!previous?.length) return current.map((r) => ({ ...r, delta: r.delta ?? 0 }))
  const prevPos = new Map(previous.map((r) => [r.nome.toLowerCase(), r.pos]))
  return current.map((r) => {
    const before = prevPos.get(r.nome.toLowerCase())
    if (before == null) return { ...r, delta: 0 }
    return { ...r, delta: before - r.pos }
  })
}

function toPreviewStanding(row: LiveStanding): PreviewStanding {
  return {
    pos: row.pos,
    nome: row.nome,
    logo: row.logo || undefined,
    booyah: String(row.booyah ?? 0),
    abates: String(row.abates ?? 0),
    pts: String(row.pts ?? 0),
    delta: String(row.delta ?? 0),
    quedas: String(row.quedas ?? 0),
    kd: row.kd ?? '0',
  }
}

export function StreamLiveStage(props: {
  template: string
  blocks: StreamBlock[]
  data: StreamLiveData
  animateDataChange?: boolean
  /** Tamanho do produto final (px design). */
  frameW?: number
  frameH?: number
}) {
  const prevRef = useRef<LiveStanding[] | null>(null)
  const [pulse, setPulse] = useState(false)
  const [classif, setClassif] = useState<LiveStanding[]>(props.data.classificacao || [])
  const fp = useMemo(() => fingerprint(props.data), [props.data])

  useEffect(() => {
    const next = withRankDelta(props.data.classificacao || [], prevRef.current)
    setClassif(next)
    if (prevRef.current && props.animateDataChange !== false) {
      setPulse(true)
      const t = window.setTimeout(() => setPulse(false), 700)
      prevRef.current = props.data.classificacao || []
      return () => window.clearTimeout(t)
    }
    prevRef.current = props.data.classificacao || []
  }, [fp, props.animateDataChange])

  const mvp = props.data.mvp || []
  const mapas = props.data.mapas || []
  const template = props.template || 'custom'
  const ctx = { mapas, classificacao: classif, mvp }

  const standingsPreview = useMemo(() => classif.map(toPreviewStanding), [classif])
  const mvpPreview = useMemo(() => mvp.map(toPreviewStanding), [mvp])

  const freeLayout = template === 'custom' || (props.blocks || []).some((b) => b.x != null || b.y != null)
  const frameW = Math.max(64, props.frameW || FRAME_W)
  const frameH = Math.max(64, props.frameH || FRAME_H)

  return (
    <div
      className={`stream-preview-stage layout-${freeLayout ? 'custom' : template} stream-live-stage ${pulse ? 'is-data-pulse' : ''}`}
      style={
        freeLayout
          ? ({
              aspectRatio: `${frameW} / ${frameH}`,
              ['--stream-frame-w' as string]: `${frameW}`,
              ['--stream-frame-h' as string]: `${frameH}`,
            } as CSSProperties)
          : undefined
      }
    >
      {(props.blocks || []).map((block, index) => {
        const dataFx = block.transition?.onDataChange || 'none'
        const dataClass =
          pulse && dataFx !== 'none'
            ? dataFx === 'rank-move'
              ? 'stream-data-rank'
              : dataFx === 'tick'
                ? 'stream-data-tick'
                : dataFx === 'pulse'
                  ? 'stream-data-pulse'
                  : 'stream-data-fade'
            : ''
        const place = freeLayout ? blockPlaceStyle(block, frameW, frameH) : undefined

        if (block.type === 'card') {
          const card = ensureCardLayers(block)
          return (
            <div
              key={block.id}
              className={`stream-prev-card-wrap stream-live-placed ${transitionClass(block.transition)} ${dataClass}`}
              style={{
                ...(freeLayout
                  ? { ...place, maxWidth: 'none' }
                  : {}),
                ...transitionStyle(block.transition, index),
              }}
            >
              <CardLayerCanvas card={card} ctx={ctx} fillParent={freeLayout} />
            </div>
          )
        }

        const table = ensureTableStructure(block)
        return (
          <div
            key={block.id}
            className={`stream-prev-table stream-live-placed ${transitionClass(block.transition)} ${dataClass}`}
            style={{
              ...(freeLayout ? { ...place, maxWidth: 'none' } : {}),
              ...transitionStyle(block.transition, index),
            }}
          >
            <StreamTableCanvas
              table={table}
              standings={standingsPreview}
              mvpRows={mvpPreview}
            />
          </div>
        )
      })}
    </div>
  )
}
