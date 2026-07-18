'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { loadStreamSheet } from '../services/stream-data.service'
import { STREAM_SHEETS, type StreamSheetId, type StreamSheetRow } from '../types/stream.types'

export function StreamSpreadsheetPanel(props: {
  campeonatoId: string
  /** compacto no hub; full no workspace */
  compact?: boolean
}) {
  const [sheetId, setSheetId] = useState<StreamSheetId>('equipes')
  const [rows, setRows] = useState<StreamSheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadedAt, setLoadedAt] = useState<string | null>(null)

  const sheet = useMemo(() => STREAM_SHEETS.find((item) => item.id === sheetId) || STREAM_SHEETS[0], [sheetId])

  const reload = useCallback(async () => {
    if (!props.campeonatoId) return
    setLoading(true)
    setError('')
    try {
      const data = await loadStreamSheet(props.campeonatoId, sheetId)
      setRows(data)
      setLoadedAt(new Date().toLocaleTimeString('pt-BR'))
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Erro ao carregar planilha.')
    } finally {
      setLoading(false)
    }
  }, [props.campeonatoId, sheetId])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <section className={`stream-panel stream-sheet-panel ${props.compact ? 'is-compact' : 'is-full'}`} aria-label="Planilha de dados do stream">
      <div className="stream-panel-title">
        <div>
          <h4>Planilha de dados</h4>
          <p className="stream-hint">
            Fontes ao vivo do campeonato (read-only). Bindings futuros usam endereço{' '}
            <code>{sheet.refName}!B2</code> (aba + coluna + linha; linha 1 = cabeçalho).
          </p>
        </div>
        <div className="stream-panel-actions">
          {sheet.live ? <span className="stream-badge">ao vivo</span> : null}
          <button type="button" className="stream-icon-btn" onClick={() => void reload()} disabled={loading} title="Atualizar">
            {loading ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />}
            Atualizar
          </button>
        </div>
      </div>

      <nav className="stream-sheet-tabs" aria-label="Abas da planilha">
        {STREAM_SHEETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={sheetId === item.id ? 'active' : ''}
            onClick={() => setSheetId(item.id)}
          >
            {item.title}
          </button>
        ))}
      </nav>

      {error ? <div className="stream-error">{error}</div> : null}
      {loadedAt && !error ? <p className="stream-hint">Atualizado às {loadedAt} · {rows.length} linha(s)</p> : null}

      <div className="stream-sheet-wrap">
        <table className="stream-sheet">
          <thead>
            <tr>
              <th className="stream-sheet-corner" scope="col" />
              {sheet.columns.map((col) => (
                <th key={col.key} scope="col" title={`${sheet.refName}!${col.letter}`}>
                  <span className="stream-col-letter">{col.letter}</span>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr>
                <td colSpan={sheet.columns.length + 1} className="stream-sheet-empty">
                  Carregando dados…
                </td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={sheet.columns.length + 1} className="stream-sheet-empty">
                  Nenhum dado nesta aba ainda.
                </td>
              </tr>
            ) : null}
            {rows.map((row, rowIndex) => {
              const excelRow = rowIndex + 2
              return (
                <tr key={row.id}>
                  <td className="stream-sheet-row-head" title={`Linha de dados ${excelRow}`}>
                    {excelRow}
                  </td>
                  {sheet.columns.map((col) => (
                    <td key={col.key} title={`${sheet.refName}!${col.letter}${excelRow}`}>
                      <input
                        readOnly
                        value={row.cells[col.key] || ''}
                        aria-label={`${col.label} linha ${excelRow}`}
                        spellCheck={false}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
