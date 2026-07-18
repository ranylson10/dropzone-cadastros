'use client'

import { useMemo, useState } from 'react'
import type { StreamSheetColumn } from '../types/stream.types'

const COLUMNS: StreamSheetColumn[] = [
  { key: 'slot', label: 'Slot' },
  { key: 'line', label: 'Line' },
  { key: 'tag', label: 'Tag' },
  { key: 'kills', label: 'Kills' },
  { key: 'points', label: 'Pontos' },
  { key: 'status', label: 'Status' },
]

const ROW_COUNT = 10

function emptyRow(): Record<string, string> {
  return Object.fromEntries(COLUMNS.map((col) => [col.key, '']))
}

export function StreamSpreadsheetPanel(props: { campeonatoId: string }) {
  const [rows, setRows] = useState(() => Array.from({ length: ROW_COUNT }, () => emptyRow()))

  const headers = useMemo(() => COLUMNS, [])

  function updateCell(rowIndex: number, key: string, value: string) {
    setRows((prev) => {
      const next = prev.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row))
      return next
    })
  }

  return (
    <section className="stream-panel" aria-label="Planilha de dados do stream">
      <div className="stream-panel-title">
        <h4>Planilha de dados</h4>
        <span className="stream-badge">local · sem salvar</span>
      </div>

      <p className="stream-hint">
        Modelo estilo vMix / planilha para alimentar overlays. Edição só na tela por enquanto — nada é gravado no
        banco ainda
        {props.campeonatoId ? ` (campeonato ${props.campeonatoId.slice(0, 8)}…)` : ''}.
      </p>

      <div className="stream-sheet-wrap">
        <table className="stream-sheet">
          <thead>
            <tr>
              <th className="stream-sheet-corner" scope="col" />
              {headers.map((col) => (
                <th key={col.key} scope="col">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`r-${rowIndex}`}>
                <td className="stream-sheet-row-head">{rowIndex + 1}</td>
                {headers.map((col) => (
                  <td key={col.key}>
                    <input
                      value={row[col.key] || ''}
                      onChange={(event) => updateCell(rowIndex, col.key, event.target.value)}
                      aria-label={`${col.label} linha ${rowIndex + 1}`}
                      spellCheck={false}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
