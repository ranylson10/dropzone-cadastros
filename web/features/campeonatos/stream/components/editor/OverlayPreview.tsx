'use client'

import type { StreamBlock, StreamTableBlock, TableColumnKey } from '../../types/stream.types'
import { boxToCssSafe, fieldToCss, transitionClass, transitionStyle } from '../../utils/stream-style'
import { CardLayerCanvas } from '../CardLayerCanvas'
import type { LayerResolveContext } from '../../utils/resolve-layer'

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
  selectedLayerId?: string | null
  onSelectBlock: (id: string) => void
  onSelectLayer?: (layerId: string) => void
  standings: PreviewStanding[]
  mvp?: PreviewStanding[]
  maps: PreviewMap[]
  layout: 'map_cards' | 'standings' | 'mvp_combo' | 'custom'
  /** se true, só mostra o bloco selecionado em grande (modo pasta aberta) */
  focusSelected?: boolean
}) {
  const mvpList = props.mvp?.length ? props.mvp : props.standings
  const ctx: LayerResolveContext = {
    mapas: props.maps,
    classificacao: props.standings,
    mvp: mvpList,
  }

  const blocks = props.focusSelected && props.selectedBlockId
    ? props.blocks.filter((b) => b.id === props.selectedBlockId)
    : props.blocks

  return (
    <div className={`stream-preview-stage layout-${props.focusSelected ? 'focus' : props.layout}`}>
      {blocks.map((block, index) => {
        if (block.type === 'card') {
          return (
            <div
              key={block.id}
              className={`stream-prev-card-wrap ${props.selectedBlockId === block.id ? 'is-selected' : ''} ${transitionClass(block.transition)}`}
              style={transitionStyle(block.transition, index)}
              onClick={() => props.onSelectBlock(block.id)}
            >
              <CardLayerCanvas
                card={block}
                ctx={ctx}
                editable={props.selectedBlockId === block.id}
                selectedLayerId={props.selectedBlockId === block.id ? props.selectedLayerId : null}
                onSelectLayer={props.onSelectLayer}
              />
            </div>
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
      {!blocks.length ? (
        <div className="stream-prev-empty">Adicione uma pasta Card ou Tabela para começar.</div>
      ) : null}
    </div>
  )
}
