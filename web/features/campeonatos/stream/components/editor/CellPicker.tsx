'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link2, Table2, X } from 'lucide-react'
import { getSheetDef, STREAM_SHEETS, type StreamSheetId, type StreamSheetRow } from '../../types/stream.types'

const MIN_ROWS = 5
const MAX_ROWS = 60

function emptyRow(i: number): StreamSheetRow {
  return { id: `empty-${i}`, cells: {} }
}

export type CellPick = {
  sheetId: StreamSheetId
  colKey: string
  rowIndex: number
  display: string
}

/** Pick de coluna inteira (tabela) — linha só como amostra. */
export type ColumnPick = {
  sheetId: StreamSheetId
  colKey: string
  label: string
  image?: boolean
  display: string
  sample?: string
}

export function CellPicker(props: {
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  value?: { sheetId: StreamSheetId; colKey: string; rowIndex: number; display?: string }
  onPick: (pick: CellPick) => void
  /** rótulo do botão */
  triggerLabel?: string
}) {
  return (
    <SheetPickerModal
      sheets={props.sheets}
      mode="cell"
      value={
        props.value
          ? {
              sheetId: props.value.sheetId,
              colKey: props.value.colKey,
              rowIndex: props.value.rowIndex,
              display: props.value.display,
            }
          : undefined
      }
      triggerLabel={props.triggerLabel || 'Vincular célula'}
      onPickCell={props.onPick}
    />
  )
}

/** Abre a planilha para o usuário clicar na coluna (header ou qualquer célula da coluna). */
export function ColumnPicker(props: {
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  value?: { sheetId?: StreamSheetId; colKey?: string; display?: string }
  onPick: (pick: ColumnPick) => void
  triggerLabel?: string
}) {
  return (
    <SheetPickerModal
      sheets={props.sheets}
      mode="column"
      value={
        props.value?.colKey
          ? {
              sheetId: props.value.sheetId || 'equipes_geral',
              colKey: props.value.colKey,
              display: props.value.display,
            }
          : undefined
      }
      triggerLabel={props.triggerLabel || 'Vincular coluna da planilha'}
      onPickColumn={props.onPick}
    />
  )
}

function SheetPickerModal(props: {
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  mode: 'cell' | 'column'
  value?: { sheetId: StreamSheetId; colKey: string; rowIndex?: number; display?: string }
  triggerLabel: string
  onPickCell?: (pick: CellPick) => void
  onPickColumn?: (pick: ColumnPick) => void
}) {
  const [open, setOpen] = useState(false)
  const [sheetId, setSheetId] = useState<StreamSheetId>(props.value?.sheetId || 'equipes_geral')
  const def = useMemo(() => getSheetDef(sheetId), [sheetId])
  const rawRows = props.sheets[sheetId] || props.sheets[def.id] || []

  const rows = useMemo(() => {
    const list = rawRows.slice(0, MAX_ROWS)
    if (list.length >= MIN_ROWS) return list
    const pad = Array.from({ length: MIN_ROWS - list.length }, (_, i) => emptyRow(list.length + i))
    return [...list, ...pad]
  }, [rawRows])

  useEffect(() => {
    if (props.value?.sheetId) setSheetId(props.value.sheetId)
  }, [props.value?.sheetId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    document.documentElement.classList.add('stream-editor-scroll-lock')
    document.body.classList.add('stream-editor-scroll-lock')
    return () => {
      if (!document.querySelector('.stream-editor.stream-gt')) {
        document.documentElement.classList.remove('stream-editor-scroll-lock')
        document.body.classList.remove('stream-editor-scroll-lock')
      }
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = ''
    }
  }, [open])

  function pickCell(colKey: string, letter: string, excelRow: number, val: string) {
    if (props.mode === 'column') {
      const col = def.columns.find((c) => c.key === colKey)
      props.onPickColumn?.({
        sheetId,
        colKey,
        label: col?.label || colKey,
        image: Boolean(col?.image),
        display: `${def.refName}!${letter} (coluna ${col?.label || colKey})`,
        sample: val,
      })
      setOpen(false)
      return
    }
    props.onPickCell?.({
      sheetId,
      colKey,
      rowIndex: excelRow,
      display: `${def.refName}!${letter}${excelRow + 1} = ${val || '∅'}`,
    })
    setOpen(false)
  }

  function pickColumnHeader(colKey: string, letter: string) {
    if (props.mode !== 'column') return
    const col = def.columns.find((c) => c.key === colKey)
    const sample = rawRows[0]?.cells[colKey] || ''
    props.onPickColumn?.({
      sheetId,
      colKey,
      label: col?.label || colKey,
      image: Boolean(col?.image),
      display: `${def.refName}!${letter} (coluna ${col?.label || colKey})`,
      sample,
    })
    setOpen(false)
  }

  const boundLabel =
    props.value?.display
    || (props.value
      ? props.mode === 'column'
        ? `${props.value.sheetId}.${props.value.colKey}`
        : `${props.value.sheetId}.${props.value.colKey} L${props.value.rowIndex}`
      : props.mode === 'column'
        ? 'Nenhuma coluna vinculada'
        : 'Nenhuma célula vinculada')

  return (
    <div className="stream-cell-picker-wrap">
      <button
        type="button"
        className="stream-cell-picker-trigger"
        onClick={() => setOpen(true)}
        title={props.mode === 'column' ? 'Abrir planilha e escolher coluna' : 'Abrir planilha para vincular célula'}
      >
        <Table2 size={15} />
        <span>
          <small>{props.triggerLabel}</small>
          <em>{boundLabel}</em>
        </span>
        <Link2 size={14} />
      </button>

      {open ? (
        <div
          className="stream-cell-picker-modal-root"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            className="stream-cell-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-label={props.mode === 'column' ? 'Vincular coluna da planilha' : 'Vincular célula da planilha'}
          >
            <div className="stream-cell-picker-modal-head">
              <div>
                <p className="eyebrow">Vínculo de dados</p>
                <h3>
                  {props.mode === 'column'
                    ? 'Clique na coluna da planilha'
                    : 'Clique na célula da planilha'}
                </h3>
                <p className="stream-hint">
                  {props.mode === 'column'
                    ? 'Clique no cabeçalho ou em qualquer célula da coluna que a tabela deve usar.'
                    : `Abas de equipes, MVP, mapas e partidas. Linhas vazias como placeholder (mín. ${MIN_ROWS}).`}
                </p>
              </div>
              <button type="button" className="stream-icon-btn" onClick={() => setOpen(false)} title="Fechar">
                <X size={16} /> Fechar
              </button>
            </div>

            <div className="stream-cell-picker-tabs stream-cell-picker-tabs-modal">
              {STREAM_SHEETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={sheetId === s.id ? 'active' : ''}
                  onClick={() => setSheetId(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {props.value ? (
              <p className="stream-hint stream-cell-picker-current">
                Atual: <code>{props.value.display || `${props.value.sheetId}.${props.value.colKey}`}</code>
              </p>
            ) : null}

            <div className="stream-cell-picker-scroll stream-cell-picker-scroll-modal">
              <table className="stream-cell-picker-table">
                <thead>
                  <tr>
                    <th className="stream-sheet-corner" />
                    {def.columns.map((c) => {
                      const selected =
                        props.mode === 'column'
                        && props.value?.sheetId === sheetId
                        && props.value?.colKey === c.key
                      return (
                        <th
                          key={c.key}
                          title={
                            props.mode === 'column'
                              ? `Usar coluna ${c.label}`
                              : c.letter
                          }
                          className={selected ? 'is-col-picked' : props.mode === 'column' ? 'is-col-pickable' : ''}
                        >
                          {props.mode === 'column' ? (
                            <button
                              type="button"
                              className={selected ? 'is-picked' : ''}
                              onClick={() => pickColumnHeader(c.key, c.letter)}
                            >
                              <span className="stream-col-letter">{c.letter}</span>
                              {c.label}
                            </button>
                          ) : (
                            <>
                              <span className="stream-col-letter">{c.letter}</span>
                              {c.label}
                            </>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => {
                    const excelRow = ri + 1
                    const isPlaceholder = String(row.id || '').startsWith('empty-')
                    return (
                      <tr key={row.id || ri} className={isPlaceholder ? 'is-placeholder' : ''}>
                        <td className="stream-sheet-row-head">{excelRow}</td>
                        {def.columns.map((col) => {
                          const val = row.cells[col.key] || ''
                          const selected =
                            props.value?.sheetId === sheetId
                            && props.value?.colKey === col.key
                            && (props.mode === 'column' || props.value?.rowIndex === excelRow)
                          const colHighlight =
                            props.mode === 'column'
                            && props.value?.sheetId === sheetId
                            && props.value?.colKey === col.key
                          const showImg =
                            Boolean(val)
                            && (col.image
                              || /^https?:\/\//i.test(val)
                              || val.startsWith('/images/')
                              || val.startsWith('data:image'))
                          return (
                            <td
                              key={col.key}
                              className={`${showImg ? 'is-img-cell' : ''}${colHighlight ? ' is-col-highlight' : ''}`}
                            >
                              <button
                                type="button"
                                className={selected ? 'is-picked' : ''}
                                title={
                                  props.mode === 'column'
                                    ? `Usar coluna ${col.label}`
                                    : `${def.refName}!${col.letter}${excelRow + 1}`
                                }
                                onClick={() => pickCell(col.key, col.letter, excelRow, val)}
                              >
                                {showImg ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={val} alt="" className="stream-sheet-thumb" loading="lazy" />
                                ) : (
                                  val || (isPlaceholder ? '·' : '—')
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="stream-hint">
              {props.mode === 'column'
                ? 'Clique no cabeçalho ou numa célula da coluna · Esc fecha'
                : 'Clique numa célula para vincular · Esc fecha'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
