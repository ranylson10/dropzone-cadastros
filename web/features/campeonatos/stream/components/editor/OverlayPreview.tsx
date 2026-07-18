'use client'

import type { StreamBlock, StreamCardBlock, StreamTableBlock, TableColumnKey } from '../../types/stream.types'
import { boxToCssSafe, fieldToCss, transitionClass, transitionStyle } from '../../utils/stream-style'

export type PreviewStanding = {
  pos: number
  nome: string
  logo?: string
  booyah: string
  abates: string
  pts: string
  delta?: string
  quedas?: string
  kd?: string
}

export type PreviewMap = {
  title: string
  imageUrl?: string
  logo?: string
  pts: string
  abates: string
  nome?: string
}

function colLabel(key: TableColumnKey) {
  const map: Record<TableColumnKey, string> = {
    pos: '#',
    logo: '',
    nome: 'Nome',
    booyah: 'B!',
    abates: 'ABT',
    pts: 'PTS',
    delta: '±',
    quedas: 'QD',
    kd: 'K.D',
  }
  return map[key]
}

function CardPreview(props: {
  block: StreamCardBlock
  index: number
  selected: boolean
  map?: PreviewMap
  mvp?: PreviewStanding
  onSelect: () => void
}) {
  const { block, map, mvp } = props
  const box = boxToCssSafe(
    block.data.variant === 'map_result' && map?.imageUrl
      ? {
          ...block.box,
          fill: {
            ...(block.box.fill || { mode: 'image' as const }),
            mode: 'image',
            imageUrl: map.imageUrl,
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

  const title =
    block.data.variant === 'mvp_hero'
      ? mvp?.nome || 'MVP'
      : map?.title || block.data.titleFixed || block.name

  const logo = block.data.variant === 'mvp_hero' ? mvp?.logo : map?.logo

  return (
    <button
      type="button"
      className={`stream-prev-card ${props.selected ? 'is-selected' : ''} ${transitionClass(block.transition)}`}
      style={{ ...box, ...transitionStyle(block.transition, props.index) }}
      onClick={props.onSelect}
    >
      <div className="stream-prev-card-art">
        {logo ? <img src={logo} alt="" /> : <span className="stream-prev-logo-fallback">DZ</span>}
      </div>
      <div className="stream-prev-card-title" style={{ ...titleFs.wrap, ...titleFs.text }}>
        {title}
      </div>
      <div className="stream-prev-card-metrics">
        {block.data.metrics.includes('pts') || block.data.metrics.includes('abates') ? (
          <>
            <span style={{ ...m1.wrap, ...m1.text }}>
              {block.data.variant === 'mvp_hero' ? `${mvp?.abates || '0'} ABT` : `${map?.pts || '0'} PTS`}
            </span>
            <span style={{ ...m2.wrap, ...m2.text }}>
              {block.data.variant === 'mvp_hero' ? `${mvp?.kd || '0'} K.D` : `${map?.abates || '0'} ABT.`}
            </span>
            {block.data.variant === 'mvp_hero' && block.data.metrics.includes('quedas') ? (
              <span style={{ ...m3.wrap, ...m3.text }}>{mvp?.quedas || '0'} QD</span>
            ) : null}
          </>
        ) : null}
      </div>
    </button>
  )
}

function TablePreview(props: {
  block: StreamTableBlock
  index: number
  selected: boolean
  rows: PreviewStanding[]
  onSelect: () => void
}) {
  const { block, rows } = props
  const box = boxToCssSafe(block.box)
  const header = fieldToCss(block.data.headerStyle)
  const rowStyle = fieldToCss(block.data.rowStyle)
  const start = block.data.startRank || 1
  const slice = rows.filter((r) => r.pos >= start).slice(0, block.data.rows)

  return (
    <button
      type="button"
      className={`stream-prev-table ${props.selected ? 'is-selected' : ''} ${transitionClass(block.transition)}`}
      style={{ ...box, ...transitionStyle(block.transition, props.index) }}
      onClick={props.onSelect}
    >
      <div className="stream-prev-table-head" style={{ ...header.wrap, ...header.text }}>
        {block.data.columns.map((col) => (
          <span key={col} className={`col-${col}`}>{colLabel(col)}</span>
        ))}
      </div>
      {slice.map((row, i) => {
        const bg =
          i % 2 === 1 && block.data.altRowFill
            ? block.data.altRowFill
            : rowStyle.wrap.backgroundColor || rowStyle.wrap.backgroundImage
        return (
          <div
            key={`${row.pos}-${row.nome}`}
            className="stream-prev-table-row"
            style={{
              ...rowStyle.wrap,
              ...rowStyle.text,
              backgroundColor: typeof bg === 'string' ? bg : undefined,
            }}
          >
            {block.data.columns.map((col) => {
              if (col === 'pos') return <span key={col} className="col-pos">{String(row.pos).padStart(2, '0')}</span>
              if (col === 'logo') {
                return (
                  <span key={col} className="col-logo">
                    {row.logo ? <img src={row.logo} alt="" /> : <i />}
                  </span>
                )
              }
              if (col === 'nome') return <span key={col} className="col-nome">{row.nome}</span>
              if (col === 'booyah') return <span key={col}>{row.booyah}</span>
              if (col === 'abates') return <span key={col}>{row.abates}</span>
              if (col === 'pts') return <span key={col} className="col-pts">{row.pts}</span>
              if (col === 'delta') return <span key={col} className="col-delta">{row.delta || '0'}</span>
              if (col === 'quedas') return <span key={col}>{row.quedas || '0'}</span>
              if (col === 'kd') return <span key={col}>{row.kd || '0'}</span>
              return <span key={col} />
            })}
          </div>
        )
      })}
      {!slice.length ? <div className="stream-prev-empty">Sem dados — pontue o campeonato ou aguarde classificação.</div> : null}
    </button>
  )
}

export function OverlayPreview(props: {
  blocks: StreamBlock[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  standings: PreviewStanding[]
  mvp?: PreviewStanding[]
  maps: PreviewMap[]
  layout: 'map_cards' | 'standings' | 'mvp_combo' | 'custom'
}) {
  const mvpList = props.mvp?.length ? props.mvp : props.standings
  return (
    <div className={`stream-preview-stage layout-${props.layout}`}>
      {props.blocks.map((block, index) => {
        if (block.type === 'card') {
          const map = props.maps[(block.data.mapSlot || 1) - 1]
          const mvp = mvpList[0]
          return (
            <CardPreview
              key={block.id}
              block={block}
              index={index}
              selected={props.selectedBlockId === block.id}
              map={map}
              mvp={mvp}
              onSelect={() => props.onSelectBlock(block.id)}
            />
          )
        }
        const tableRows =
          block.data.source === 'mvp' || block.data.variant === 'mvp_list' ? mvpList : props.standings
        return (
          <TablePreview
            key={block.id}
            block={block}
            index={index}
            selected={props.selectedBlockId === block.id}
            rows={tableRows}
            onSelect={() => props.onSelectBlock(block.id)}
          />
        )
      })}
      {!props.blocks.length ? (
        <div className="stream-prev-empty">Adicione um card ou uma tabela para começar.</div>
      ) : null}
    </div>
  )
}
