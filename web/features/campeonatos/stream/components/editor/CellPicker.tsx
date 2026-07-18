'use client'

import { useMemo, useState } from 'react'
import { getSheetDef, STREAM_SHEETS, type StreamSheetId, type StreamSheetRow } from '../../types/stream.types'

export function CellPicker(props: {
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  value?: { sheetId: StreamSheetId; colKey: string; rowIndex: number; display?: string }
  onPick: (pick: { sheetId: StreamSheetId; colKey: string; rowIndex: number; display: string }) => void
}) {
  const [sheetId, setSheetId] = useState<StreamSheetId>(props.value?.sheetId || 'equipes_geral')
  const def = useMemo(() => getSheetDef(sheetId), [sheetId])
  const rows = props.sheets[sheetId] || props.sheets[def.id] || []

  return (
    <div className="stream-cell-picker">
      <div className="stream-cell-picker-tabs">
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
      <div className="stream-cell-picker-scroll">
        <table className="stream-cell-picker-table">
          <thead>
            <tr>
              <th />
              {def.columns.map((c) => (
                <th key={c.key} title={c.letter}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={def.columns.length + 1} className="stream-prev-empty">Sem dados nesta aba</td>
              </tr>
            ) : (
              rows.slice(0, 40).map((row, ri) => {
                const excelRow = ri + 1
                return (
                  <tr key={row.id || ri}>
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
                            onClick={() =>
                              props.onPick({
                                sheetId,
                                colKey: col.key,
                                rowIndex: excelRow,
                                display: `${def.refName}!${col.letter}${excelRow + 1} = ${val || '∅'}`,
                              })
                            }
                          >
                            {val || '—'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="stream-hint">Clique numa célula para vincular o dado real do campeonato.</p>
    </div>
  )
}
