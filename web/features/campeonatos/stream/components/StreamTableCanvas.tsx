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
            boxSizing: 'border-box',
          }}
        >
          {cols.map((c) => {
            const hidden = Boolean(c.hideHeader)
            return (
              <span
                key={c.id}
                style={{
                  textAlign: c.align || 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: (header.text.fontSize as number) || 11,
                  fontWeight: (header.text.fontWeight as number) || 900,
                  fontFamily: (header.text.fontFamily as string) || undefined,
                  color: (header.text.color as string) || undefined,
                  textTransform:
                    data.headerStyle?.text?.uppercase === false ? 'none' : 'uppercase',
                  letterSpacing: (header.text.letterSpacing as number | string) || undefined,
                  opacity: hidden ? 0 : 1,
                  visibility: hidden ? 'hidden' : 'visible',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    c.align === 'left' ? 'flex-start' : c.align === 'right' ? 'flex-end' : 'center',
                  minWidth: 0,
                  padding: '0 4px',
                  boxSizing: 'border-box',
                }}
                aria-hidden={hidden}
              >
                {hidden ? '\u00a0' : c.label || fieldLabel(c.field)}
              </span>
            )
          })}
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
                  : cellValue(c.field, dataRow)
              const padBase = Number(c.paddingPx)
              const padX = Math.max(
                0,
                Number.isFinite(Number(c.paddingX))
                  ? Number(c.paddingX)
                  : Number.isFinite(padBase)
                    ? padBase
                    : 4,
              )
              const padY = Math.max(
                0,
                Number.isFinite(Number(c.paddingY))
                  ? Number(c.paddingY)
                  : Number.isFinite(padBase)
                    ? padBase
                    : 4,
              )
              // logo/imagem preenche o miolo da célula após a margem
              const colW = Math.max(1, Number(c.widthPx) || 48)
              const imgBox = Math.max(8, Math.min(colW - padX * 2, rh - padY * 2))
              // style completo (fundo degradê/imagem/borda) ou legado fill/textColor
              const colField = fieldToCss(
                c.style || {
                  box: c.fill
                    ? { fill: { mode: 'solid', color: c.fill, opacity: 1 } }
                    : undefined,
                  text: c.textColor
                    ? {
                        fontFamily: (rowBase.text.fontFamily as string) || 'Rajdhani',
                        fontWeight: (rowBase.text.fontWeight as number) || 700,
                        fontSize: (rowBase.text.fontSize as number) || 14,
                        color: c.textColor,
                        align: c.align || 'center',
                      }
                    : undefined,
                },
              )
              const textAlign = c.align || colField.text.textAlign || 'center'
              return (
                <span
                  key={c.id}
                  style={{
                    ...colField.wrap,
                    ...colField.text,
                    textAlign: textAlign as CSSProperties['textAlign'],
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                      textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center',
                    minWidth: 0,
                    height: '100%',
                    minHeight: rh,
                    boxSizing: 'border-box',
                    padding: `${padY}px ${padX}px`,
                    // legado se style.box não definir fundo
                    backgroundColor:
                      (colField.wrap.backgroundColor as string | undefined) ||
                      c.fill ||
                      undefined,
                    color:
                      (colField.text.color as string | undefined) ||
                      c.textColor ||
                      undefined,
                  }}
                >
                  {val.kind === 'image' ? (
                    val.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={val.src}
                        alt=""
                        style={{
                          width: imgBox,
                          height: imgBox,
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          borderRadius: 3,
                          flexShrink: 0,
                          display: 'block',
                        }}
                      />
                    ) : (
                      <i
                        style={{
                          width: imgBox,
                          height: imgBox,
                          display: 'block',
                          flexShrink: 0,
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
