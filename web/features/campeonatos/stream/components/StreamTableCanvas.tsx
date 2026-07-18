'use client'

import type { CSSProperties } from 'react'
import type { StreamSheetId, StreamSheetRow, StreamTableBlock } from '../types/stream.types'
import { boxToCssSafe, fieldToCss } from '../utils/stream-style'
import {
  cellValue,
  ensureTableStructure,
  fieldLabel,
  gridTemplateFromColumns,
  sheetRowsToDataRows,
  standingToDataRow,
  tableSourceId,
  type TableDataRow,
} from '../utils/table-structure'
import type { PreviewStanding } from './editor/OverlayPreview'

function deltaLabel(delta: unknown) {
  const n = Number(delta || 0)
  if (!n) return '0 ='
  if (n > 0) return `+${n} ▲`
  return `${n} ▼`
}

function resolveSourceRows(props: {
  table: StreamTableBlock
  standings: PreviewStanding[]
  mvpRows: PreviewStanding[]
  sheets?: Partial<Record<StreamSheetId, StreamSheetRow[]>>
}): TableDataRow[] {
  const sourceId = tableSourceId(props.table.data.source)
  const fromSheet = sheetRowsToDataRows(props.sheets?.[sourceId])
  if (fromSheet.length) return fromSheet

  // fallbacks de preview legados
  if (sourceId === 'mvp') {
    return (props.mvpRows || []).map(standingToDataRow)
  }
  return (props.standings || []).map(standingToDataRow)
}

export function StreamTableCanvas(props: {
  table: StreamTableBlock
  standings: PreviewStanding[]
  mvpRows: PreviewStanding[]
  sheets?: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  selectedRowId?: string | null
  onSelectRow?: (id: string) => void
  editable?: boolean
}) {
  const table = ensureTableStructure(props.table)
  const data = table.data
  const cols = data.columnDefs || []
  const items = data.rowItems || []
  const sourceRows = resolveSourceRows({
    table,
    standings: props.standings,
    mvpRows: props.mvpRows,
    sheets: props.sheets,
  })
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
  const colsW = cols.reduce((s, c) => s + (Number(c.widthPx) || 48), 0)
  const tableW = Math.max(table.tableW || 480, colsW || 0)

  return (
    <div
      className="stream-table-canvas"
      style={{
        ...box,
        width: tableW,
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
        const byPos = sourceRows.find((r) => Number(r.pos) === start + item.dataIndex)
        const dataRow =
          byPos ||
          sourceRows[item.dataIndex] ||
          ({
            pos: start + item.dataIndex,
            nome: props.editable ? item.name : '—',
          } as TableDataRow)

        const d = Number(dataRow.delta || 0)
        const rankClass = d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''
        // modelo único: altura e fundo da linha vêm de rowHeight / rowStyle / altRowFill
        const bg =
          i % 2 === 1 && data.altRowFill
            ? data.altRowFill
            : (rowBase.wrap.backgroundColor as string | undefined)

        return (
          <div
            key={item.id}
            className={`stream-prev-table-row ${rankClass}`}
            style={{
              ...grid,
              ...rowBase.wrap,
              ...rowBase.text,
              minHeight: rh,
              marginBottom: gap,
              backgroundColor: bg,
              color: rowBase.text.color as string | undefined,
              padding: '0 6px',
            }}
          >
            {cols.map((c) => {
              const val =
                c.field === 'delta'
                  ? { kind: 'text' as const, text: deltaLabel(dataRow.delta) }
                  : cellValue(c.field, dataRow, { asImage: c.asImage })
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
                    height: '100%',
                    minHeight: rh,
                    boxSizing: 'border-box',
                    padding: '0 4px',
                    backgroundColor: c.fill || undefined,
                    color: c.textColor || undefined,
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
