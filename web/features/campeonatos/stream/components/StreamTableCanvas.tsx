'use client'

import type { CSSProperties } from 'react'
import type {
  StreamSheetId,
  StreamSheetRow,
  StreamTableBlock,
  TableColumnDef,
  TableRowItem,
} from '../types/stream.types'
import { boxToCssSafe, fieldToCss } from '../utils/stream-style'
import {
  cellValue,
  ensureTableStructure,
  fieldLabel,
  gridTemplateFromColumns,
  sheetRowsToDataRows,
  splitTableRowItems,
  standingToDataRow,
  tableOuterWidth,
  tableSourceId,
  tableSplitPanels,
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

  if (sourceId === 'mvp') {
    return (props.mvpRows || []).map(standingToDataRow)
  }
  return (props.standings || []).map(standingToDataRow)
}

function TablePanel(props: {
  cols: TableColumnDef[]
  items: TableRowItem[]
  sourceRows: TableDataRow[]
  startRank: number
  showHeader: boolean
  headerHeight: number
  rowHeight: number
  rowGap: number
  panelW: number
  headerCss: ReturnType<typeof fieldToCss>
  rowCss: ReturnType<typeof fieldToCss>
  altRowFill?: string
  headerStyleUpper?: boolean
  editable?: boolean
}) {
  const {
    cols,
    items,
    sourceRows,
    startRank,
    showHeader,
    headerHeight,
    rowHeight,
    rowGap,
    panelW,
    headerCss,
    rowCss,
    altRowFill,
    editable,
  } = props

  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridTemplateFromColumns(cols),
    width: '100%',
    alignItems: 'center',
    gap: 0,
  }

  return (
    <div
      className="stream-table-panel"
      style={{
        width: panelW,
        flex: '0 0 auto',
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      {showHeader ? (
        <div
          className="stream-prev-table-head"
          style={{
            ...grid,
            ...headerCss.wrap,
            ...headerCss.text,
            minHeight: headerHeight,
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
                  fontSize: (headerCss.text.fontSize as number) || 11,
                  fontWeight: (headerCss.text.fontWeight as number) || 900,
                  fontFamily: (headerCss.text.fontFamily as string) || undefined,
                  color: (headerCss.text.color as string) || undefined,
                  textTransform: props.headerStyleUpper === false ? 'none' : 'uppercase',
                  letterSpacing: (headerCss.text.letterSpacing as number | string) || undefined,
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
        const byPos = sourceRows.find((r) => Number(r.pos) === startRank + item.dataIndex)
        const dataRow =
          byPos ||
          sourceRows[item.dataIndex] ||
          ({
            pos: startRank + item.dataIndex,
            nome: editable ? item.name : '—',
          } as TableDataRow)

        const d = Number(dataRow.delta || 0)
        const rankClass = d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''
        const bg =
          i % 2 === 1 && altRowFill
            ? altRowFill
            : (rowCss.wrap.backgroundColor as string | undefined)

        return (
          <div
            key={item.id}
            className={`stream-prev-table-row ${rankClass}`}
            style={{
              ...grid,
              ...rowCss.wrap,
              ...rowCss.text,
              minHeight: rowHeight,
              marginBottom: rowGap,
              backgroundColor: bg,
              color: rowCss.text.color as string | undefined,
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
              const colW = Math.max(1, Number(c.widthPx) || 48)
              const imgBox = Math.max(8, Math.min(colW - padX * 2, rowHeight - padY * 2))
              const colField = fieldToCss(
                c.style || {
                  box: c.fill
                    ? { fill: { mode: 'solid', color: c.fill, opacity: 1 } }
                    : undefined,
                  text: c.textColor
                    ? {
                        fontFamily: (rowCss.text.fontFamily as string) || 'Rajdhani',
                        fontWeight: (rowCss.text.fontWeight as number) || 700,
                        fontSize: (rowCss.text.fontSize as number) || 14,
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
                      textAlign === 'left'
                        ? 'flex-start'
                        : textAlign === 'right'
                          ? 'flex-end'
                          : 'center',
                    minWidth: 0,
                    height: '100%',
                    minHeight: rowHeight,
                    boxSizing: 'border-box',
                    padding: `${padY}px ${padX}px`,
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

      {!items.length ? (
        <div className="stream-prev-empty" style={{ padding: 12, fontSize: 11, opacity: 0.6 }}>
          Painel sem linhas
        </div>
      ) : null}
    </div>
  )
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
  const headerCss = fieldToCss(data.headerStyle)
  const rowCss = fieldToCss(data.rowStyle)
  const rh = data.rowHeight ?? 36
  const gap = data.rowGap ?? 0
  const hh = data.headerHeight ?? 32
  const colsW = cols.reduce((s, c) => s + (Number(c.widthPx) || 48), 0)
  const panelW = Math.max(table.tableW || 480, colsW || 0)
  const panels = tableSplitPanels(data)
  const splitGap = Math.max(0, data.splitGapPx || 0)
  const outerW = tableOuterWidth({ ...table, tableW: panelW })
  const chunks = splitTableRowItems(items, data)
  const showHeader = data.showHeader !== false
  const repeatHeader = data.splitRepeatHeader !== false

  return (
    <div
      className={`stream-table-canvas${panels > 1 ? ' is-split' : ''}`}
      style={{
        ...box,
        width: outerW,
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: panels > 1 ? 'flex' : 'block',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: panels > 1 ? splitGap : undefined,
      }}
    >
      {chunks.map((chunk, panelIndex) => (
        <TablePanel
          key={`panel-${panelIndex}`}
          cols={cols}
          items={chunk}
          sourceRows={sourceRows}
          startRank={start}
          showHeader={showHeader && (panelIndex === 0 || repeatHeader)}
          headerHeight={hh}
          rowHeight={rh}
          rowGap={gap}
          panelW={panelW}
          headerCss={headerCss}
          rowCss={rowCss}
          altRowFill={data.altRowFill}
          headerStyleUpper={data.headerStyle?.text?.uppercase !== false}
          editable={props.editable}
        />
      ))}

      {!items.length ? (
        <div className="stream-prev-empty">Tabela sem linhas — adicione itens.</div>
      ) : null}
    </div>
  )
}
