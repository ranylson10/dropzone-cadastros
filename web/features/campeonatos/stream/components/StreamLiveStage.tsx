'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { FRAME_H, FRAME_W, type StreamBlock } from '../types/stream.types'
import { boxToCssSafe, fieldToCss, transitionClass, transitionStyle } from '../utils/stream-style'
import { ensureCardLayers } from '../utils/card-layers'
import { CardLayerCanvas } from './CardLayerCanvas'

function blockPlaceStyle(block: StreamBlock): CSSProperties {
  const x = block.x ?? 0
  const y = block.y ?? 0
  if (block.type === 'card') {
    const card = ensureCardLayers(block)
    return {
      position: 'absolute',
      left: `${(x / FRAME_W) * 100}%`,
      top: `${(y / FRAME_H) * 100}%`,
      width: `${(card.canvasW / FRAME_W) * 100}%`,
      height: `${(card.canvasH / FRAME_H) * 100}%`,
    }
  }
  const w = block.tableW || 420
  return {
    position: 'absolute',
    left: `${(x / FRAME_W) * 100}%`,
    top: `${(y / FRAME_H) * 100}%`,
    width: `${(w / FRAME_W) * 100}%`,
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

function deltaLabel(delta: unknown) {
  const n = Number(delta || 0)
  if (!n) return '0 ='
  if (n > 0) return `+${n} ▲`
  return `${n} ▼`
}

export function StreamLiveStage(props: {
  template: string
  blocks: StreamBlock[]
  data: StreamLiveData
  animateDataChange?: boolean
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

  const freeLayout = template === 'custom' || (props.blocks || []).some((b) => b.x != null || b.y != null)

  return (
    <div
      className={`stream-preview-stage layout-${freeLayout ? 'custom' : template} stream-live-stage ${pulse ? 'is-data-pulse' : ''}`}
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
        const place = freeLayout ? blockPlaceStyle(block) : undefined

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

        const source = block.data.source === 'mvp' || block.data.variant === 'mvp_list' ? mvp : classif
        const start = block.data.startRank || 1
        const rows = source.filter((r) => r.pos >= start).slice(0, block.data.rows)
        const box = boxToCssSafe(block.box)
        const header = fieldToCss(block.data.headerStyle)
        const rowStyle = fieldToCss(block.data.rowStyle)

        return (
          <div
            key={block.id}
            className={`stream-prev-table stream-live-placed ${transitionClass(block.transition)} ${dataClass}`}
            style={{ ...box, ...place, ...transitionStyle(block.transition, index) }}
          >
            <div className="stream-prev-table-head" style={{ ...header.wrap, ...header.text }}>
              {block.data.columns.map((col) => (
                <span key={col}>
                  {col === 'pos' ? '#' : col === 'nome' ? 'Nome' : col === 'logo' ? '' : col === 'delta' ? '±' : col.toUpperCase()}
                </span>
              ))}
            </div>
            {rows.map((row, i) => {
              const d = Number(row.delta || 0)
              const rankClass = d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''
              return (
                <div
                  key={`${row.pos}-${row.nome}`}
                  className={`stream-prev-table-row ${rankClass}`}
                  style={{
                    ...rowStyle.wrap,
                    ...rowStyle.text,
                    backgroundColor:
                      i % 2 === 1 && block.data.altRowFill
                        ? block.data.altRowFill
                        : (rowStyle.wrap.backgroundColor as string | undefined),
                  }}
                >
                  {block.data.columns.map((col) => {
                    if (col === 'pos') return <span key={col}>{String(row.pos).padStart(2, '0')}</span>
                    if (col === 'logo') {
                      return (
                        <span key={col} className="col-logo">
                          {row.logo ? <img src={String(row.logo)} alt="" /> : <i />}
                        </span>
                      )
                    }
                    if (col === 'nome') return <span key={col} className="col-nome">{row.nome}</span>
                    if (col === 'booyah') return <span key={col}>{row.booyah ?? 0}</span>
                    if (col === 'abates') return <span key={col}>{row.abates ?? 0}</span>
                    if (col === 'pts') return <span key={col} className="col-pts">{row.pts ?? 0}</span>
                    if (col === 'quedas') return <span key={col}>{row.quedas ?? 0}</span>
                    if (col === 'kd') return <span key={col}>{row.kd ?? '0'}</span>
                    if (col === 'delta') {
                      return (
                        <span key={col} className={`col-delta ${rankClass}`}>
                          {deltaLabel(row.delta)}
                        </span>
                      )
                    }
                    return <span key={col} />
                  })}
                </div>
              )
            })}
            {!rows.length ? <div className="stream-prev-empty">Aguardando dados…</div> : null}
          </div>
        )
      })}
    </div>
  )
}
