'use client'

import type { StreamBlock } from '../types/stream.types'
import { boxToCssSafe, fieldToCss, transitionClass, transitionStyle } from '../utils/stream-style'

export type LiveStanding = {
  pos: number
  nome: string
  logo?: string | null
  booyah?: number | string
  abates?: number | string
  pts?: number | string
  quedas?: number | string
  kd?: string
  delta?: string
}

export type LiveMapCard = {
  title: string
  imageUrl?: string | null
  logo?: string | null
  pts?: string | number
  abates?: string | number
  nome?: string
}

export type StreamLiveData = {
  classificacao: LiveStanding[]
  mvp: LiveStanding[]
  mapas?: LiveMapCard[]
}

export function StreamLiveStage(props: {
  template: string
  blocks: StreamBlock[]
  data: StreamLiveData
}) {
  const classif = props.data.classificacao || []
  const mvp = props.data.mvp || []
  const mapas = props.data.mapas || []
  const template = props.template || 'custom'

  return (
    <div className={`stream-preview-stage layout-${template} stream-live-stage`}>
      {(props.blocks || []).map((block, index) => {
        if (block.type === 'card') {
          const isMvp = block.data.variant === 'mvp_hero'
          const mapSlot = (block.data.mapSlot || 1) - 1
          const map = mapas[mapSlot]
          const row = isMvp ? mvp[0] : classif[mapSlot] || classif[0]
          const box = boxToCssSafe(
            !isMvp && map?.imageUrl
              ? {
                  ...block.box,
                  fill: {
                    ...(block.box.fill || { mode: 'image' as const }),
                    mode: 'image',
                    imageUrl: map.imageUrl || block.box.fill?.imageUrl,
                    fit: 'cover',
                    overlayColor: block.box.fill?.overlayColor || '#000',
                    overlayOpacity: block.box.fill?.overlayOpacity ?? 0.4,
                    color: block.box.fill?.color || '#111',
                  },
                }
              : block.box,
          )
          const titleFs = fieldToCss(block.data.fieldStyles?.title)
          const m1 = fieldToCss(block.data.fieldStyles?.metric_primary)
          const m2 = fieldToCss(block.data.fieldStyles?.metric_secondary)
          const m3 = fieldToCss(block.data.fieldStyles?.metric_tertiary)
          const title = isMvp
            ? row?.nome || block.data.titleFixed || 'MVP'
            : block.data.titleFixed || map?.title || row?.nome || block.name
          const logo = isMvp ? row?.logo : map?.logo || row?.logo

          return (
            <div
              key={block.id}
              className={`stream-prev-card ${transitionClass(block.transition)}`}
              style={{ ...box, ...transitionStyle(block.transition, index) }}
            >
              <div className="stream-prev-card-art">
                {logo ? <img src={String(logo)} alt="" /> : <span className="stream-prev-logo-fallback">DZ</span>}
              </div>
              <div className="stream-prev-card-title" style={{ ...titleFs.wrap, ...titleFs.text }}>{title}</div>
              <div className="stream-prev-card-metrics">
                <span style={{ ...m1.wrap, ...m1.text }}>
                  {isMvp ? `${row?.abates ?? 0} ABT` : `${map?.pts ?? row?.pts ?? 0} PTS`}
                </span>
                <span style={{ ...m2.wrap, ...m2.text }}>
                  {isMvp ? `${row?.kd ?? '0'} K.D` : `${map?.abates ?? row?.abates ?? 0} ABT.`}
                </span>
                {isMvp && block.data.metrics.includes('quedas') ? (
                  <span style={{ ...m3.wrap, ...m3.text }}>{row?.quedas ?? 0} QD</span>
                ) : null}
              </div>
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
            className={`stream-prev-table ${transitionClass(block.transition)}`}
            style={{ ...box, ...transitionStyle(block.transition, index) }}
          >
            <div className="stream-prev-table-head" style={{ ...header.wrap, ...header.text }}>
              {block.data.columns.map((col) => (
                <span key={col}>
                  {col === 'pos' ? '#' : col === 'nome' ? 'Nome' : col === 'logo' ? '' : col.toUpperCase()}
                </span>
              ))}
            </div>
            {rows.map((row, i) => (
              <div
                key={`${row.pos}-${row.nome}`}
                className="stream-prev-table-row"
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
                  if (col === 'delta') return <span key={col}>{row.delta ?? '0'}</span>
                  return <span key={col} />
                })}
              </div>
            ))}
            {!rows.length ? <div className="stream-prev-empty">Aguardando dados…</div> : null}
          </div>
        )
      })}
    </div>
  )
}
