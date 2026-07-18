'use client'

import type { CSSProperties } from 'react'
import type { StreamTableBlock } from '../types/stream.types'
import { boxToCssSafe, fieldToCss } from '../utils/stream-style'
import {
  cellValue,
  ensureTableStructure,
  fieldLabel,
  gridTemplateFromColumns,
} from '../utils/table-structure'
import type { PreviewStanding } from './editor/OverlayPreview'

function deltaLabel(delta: unknown) {
  const n = Number(delta || 0)
  if (!n) return '0 ='
  if (n > 0) return `+${n} ▲`
  return `${n} ▼`
}

export function StreamTableCanvas(props: {
  table: StreamTableBlock
  standings: PreviewStanding[]
  mvpRows: PreviewStanding[]
  selectedRowId?: string | null
  onSelectRow?: (id: string) => void
  editable?: boolean
}) {
  const table = ensureTableStructure(props.table)
  const data = table.data
  const cols = data.columnDefs || []
  const items = data.rowItems || []
  const source =
    data.source === 'mvp' || data.variant === 'mvp_list' ? props.mvpRows : props.standings
  const start = data.startRank || 1
  const box = boxToCssSafe(table.box)
  const header = fieldToCss(data.headerStyle)
  const rowBase = fieldToCss(data.rowStyle)
  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridTemplateFromColumns(cols),
    width: '100%',
    alignItems: 'center',
    gap: 0,
  }
  const rh = data.rowHeight ?? 36
  const gap = data.rowGap ?? 0
  const hh = data.headerHeight ?? 32

  return (
    <div
      className="stream-table-canvas"
      style={{
        ...box,
        width: table.tableW || 480,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {data.showHeader !== false ? (
        <div
          className="stream-prev-table-head"
          style={{
            ...grid,
            ...header.wrap,
            ...header.text,
            minHeight: hh,
            padding: '0 6px',
          }}
        >
          {cols.map((c) => (
            <span
              key={c.id}
              style={{
                textAlign: c.align || 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 11,
                fontWeight: 900,
                textTransform: 'uppercase',
              }}
            >
              {c.label || fieldLabel(c.field)}
            </span>
          ))}
        </div>
      ) : null}

      {items.map((item, i) => {
        const dataRow = source.find((r) => r.pos === start + item.dataIndex) || source[item.dataIndex]
        const rowData = dataRow || {
          pos: start + item.dataIndex,
          nome: props.editable ? item.name : '—',
          booyah: 0,
          abates: 0,
          pts: 0,
          delta: '0',
        }
        const d = Number(rowData.delta || 0)
        const rankClass = d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''
        const selected = props.selectedRowId === item.id
        const bg =
          item.fill
          || (i % 2 === 1 && data.altRowFill
            ? data.altRowFill
            : (rowBase.wrap.backgroundColor as string | undefined))

        return (
          <div
            key={item.id}
            role={props.editable ? 'button' : undefined}
            className={`stream-prev-table-row ${rankClass}${selected ? ' is-row-selected' : ''}`}
            style={{
              ...grid,
              ...rowBase.wrap,
              ...rowBase.text,
              minHeight: item.height ?? rh,
              marginBottom: gap,
              backgroundColor: bg,
              color: item.textColor || (rowBase.text.color as string | undefined),
              padding: '0 6px',
              outline: selected ? '2px solid #dfbf4a' : undefined,
              outlineOffset: -2,
              cursor: props.editable ? 'pointer' : 'default',
            }}
            onClick={(e) => {
              e.stopPropagation()
              props.onSelectRow?.(item.id)
            }}
            onPointerDown={(e) => {
              if (props.editable) e.stopPropagation()
            }}
          >
            {cols.map((c) => {
              const val =
                c.field === 'delta'
                  ? { kind: 'text' as const, text: deltaLabel(rowData.delta) }
                  : cellValue(c.field, rowData)
              return (
                <span
                  key={c.id}
                  style={{
                    textAlign: c.align || 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                      c.align === 'left' ? 'flex-start' : c.align === 'right' ? 'flex-end' : 'center',
                    minWidth: 0,
                  }}
                >
                  {val.kind === 'image' ? (
                    val.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={val.src}
                        alt=""
                        style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 3 }}
                      />
                    ) : (
                      <i
                        style={{
                          width: 22,
                          height: 22,
                          display: 'block',
                          background: 'rgba(255,255,255,.12)',
                          borderRadius: 3,
                        }}
                      />
                    )
                  ) : (
                    val.text
                  )}
                </span>
              )
            })}
          </div>
        )
      })}

      {!items.length ? <div className="stream-prev-empty">Tabela sem linhas — adicione itens.</div> : null}
    </div>
  )
}
