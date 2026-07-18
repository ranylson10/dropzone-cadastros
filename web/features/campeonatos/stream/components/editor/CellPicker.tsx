'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link2, Table2, X } from 'lucide-react'
import { getSheetDef, STREAM_SHEETS, type StreamSheetId, type StreamSheetRow } from '../../types/stream.types'

const MIN_ROWS = 5
const MAX_ROWS = 60

function emptyRow(i: number): StreamSheetRow {
  return { id: `empty-${i}`, cells: {} }
}

export function CellPicker(props: {
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  value?: { sheetId: StreamSheetId; colKey: string; rowIndex: number; display?: string }
  onPick: (pick: { sheetId: StreamSheetId; colKey: string; rowIndex: number; display: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [sheetId, setSheetId] = useState<StreamSheetId>(props.value?.sheetId || 'equipes_geral')
  const def = useMemo(() => getSheetDef(sheetId), [sheetId])
  const rawRows = props.sheets[sheetId] || props.sheets[def.id] || []

  // sempre no mínimo 5 linhas (placeholders se vazio)
  const rows = useMemo(() => {
    const list = rawRows.slice(0, MAX_ROWS)
    if (list.length >= MIN_ROWS) return list
    const pad = Array.from({ length: MIN_ROWS - list.length }, (_, i) => emptyRow(list.length + i))
    return [...list, ...pad]
  }, [rawRows])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // trava scroll de fundo enquanto o picker está aberto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  function pickCell(colKey: string, letter: string, excelRow: number, val: string) {
    props.onPick({
      sheetId,
      colKey,
      rowIndex: excelRow,
      display: `${def.refName}!${letter}${excelRow + 1} = ${val || '∅'}`,
    })
    setOpen(false)
  }

  const boundLabel = props.value?.display || (props.value
    ? `${props.value.sheetId}.${props.value.colKey} L${props.value.rowIndex}`
    : 'Nenhuma célula vinculada')

  return (
    <div className="stream-cell-picker-wrap">
      <button
        type="button"
        className="stream-cell-picker-trigger"
        onClick={() => setOpen(true)}
        title="Abrir planilha para vincular célula"
      >
        <Table2 size={15} />
        <span>
          <small>Vincular célula</small>
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
          <div className="stream-cell-picker-modal" role="dialog" aria-modal="true" aria-label="Vincular célula da planilha">
            <div className="stream-cell-picker-modal-head">
              <div>
                <p className="eyebrow">Vínculo de dados</p>
                <h3>Clique na célula da planilha</h3>
                <p className="stream-hint">
                  Abas de equipes, MVP, mapas e partidas. Linhas vazias aparecem como placeholder (mín. {MIN_ROWS}).
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
                    {def.columns.map((c) => (
                      <th key={c.key} title={c.letter}>
                        <span className="stream-col-letter">{c.letter}</span>
                        {c.label}
                      </th>
                    ))}
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
                            && props.value?.rowIndex === excelRow
                          return (
                            <td key={col.key}>
                              <button
                                type="button"
                                className={selected ? 'is-picked' : ''}
                                title={`${def.refName}!${col.letter}${excelRow + 1}`}
                                onClick={() => pickCell(col.key, col.letter, excelRow, val)}
                              >
                                {val || (isPlaceholder ? '·' : '—')}
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

            <p className="stream-hint">Clique numa célula para vincular · Esc fecha</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
