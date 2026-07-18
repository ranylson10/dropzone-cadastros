'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw, Table2, X } from 'lucide-react'
import { loadStreamFilterOptions, loadStreamSheet } from '../services/stream-data.service'
import {
  STREAM_SHEETS,
  type StreamSheetFilters,
  type StreamSheetId,
  type StreamSheetRow,
} from '../types/stream.types'

type FilterOptions = Awaited<ReturnType<typeof loadStreamFilterOptions>>

function isImageCellValue(value: string) {
  const t = String(value || '').trim()
  if (!t) return false
  if (t.startsWith('/images/') || t.startsWith('data:image')) return true
  if (/^https?:\/\//i.test(t)) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(t) || /supabase|storage|\/images\//i.test(t)
  }
  return false
}

export function StreamSpreadsheetPanel(props: {
  campeonatoId: string
  /** modal flutuante (padrão) — não fica espremido na lateral */
  asModal?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** botão gatilho embutido */
  showTrigger?: boolean
  triggerLabel?: string
}) {
  const asModal = props.asModal !== false
  const [internalOpen, setInternalOpen] = useState(false)
  const open = props.open ?? internalOpen
  const setOpen = (v: boolean) => {
    props.onOpenChange?.(v)
    if (props.open === undefined) setInternalOpen(v)
  }

  const [sheetId, setSheetId] = useState<StreamSheetId>('equipes_geral')
  const [rows, setRows] = useState<StreamSheetRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadedAt, setLoadedAt] = useState<string | null>(null)
  const [filters, setFilters] = useState<StreamSheetFilters>({})
  const [filterOpts, setFilterOpts] = useState<FilterOptions | null>(null)

  const sheet = useMemo(() => STREAM_SHEETS.find((item) => item.id === sheetId) || STREAM_SHEETS[0], [sheetId])

  const reload = useCallback(async () => {
    if (!props.campeonatoId || (asModal && !open)) return
    setLoading(true)
    setError('')
    try {
      const data = await loadStreamSheet(props.campeonatoId, sheetId, filters)
      setRows(data)
      setLoadedAt(new Date().toLocaleTimeString('pt-BR'))
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Erro ao carregar planilha.')
    } finally {
      setLoading(false)
    }
  }, [props.campeonatoId, sheetId, filters, asModal, open])

  useEffect(() => {
    if (asModal && !open) return
    void reload()
  }, [reload, asModal, open])

  useEffect(() => {
    if (asModal && !open) return
    let cancelled = false
    ;(async () => {
      try {
        const opts = await loadStreamFilterOptions(props.campeonatoId)
        if (!cancelled) setFilterOpts(opts)
      } catch {
        if (!cancelled) setFilterOpts(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.campeonatoId, asModal, open])

  // fecha com Escape
  useEffect(() => {
    if (!asModal || !open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [asModal, open])

  function renderFilter() {
    const kind = sheet.filter || 'none'
    if (kind === 'none' || !filterOpts) return null
    const options =
      kind === 'mapa'
        ? filterOpts.mapas
        : kind === 'jogo'
          ? filterOpts.jogos
          : kind === 'fase'
            ? filterOpts.fases
            : kind === 'grupo'
              ? filterOpts.grupos
              : filterOpts.partidas
    const value =
      kind === 'mapa'
        ? filters.mapa_codigo || ''
        : kind === 'jogo'
          ? filters.jogo_id || ''
          : kind === 'fase'
            ? filters.fase_id || ''
            : kind === 'grupo'
              ? filters.grupo_id || ''
              : filters.partida_id || ''

    return (
      <label className="stream-field stream-sheet-filter">
        <span>Filtrar por {kind}</span>
        <select
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (kind === 'mapa') setFilters({ mapa_codigo: v || undefined })
            else if (kind === 'jogo') setFilters({ jogo_id: v || undefined })
            else if (kind === 'fase') setFilters({ fase_id: v || undefined })
            else if (kind === 'grupo') setFilters({ grupo_id: v || undefined })
            else setFilters({ partida_id: v || undefined })
          }}
        >
          <option value="">Selecione…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    )
  }

  const groups = useMemo(() => {
    const order = ['equipes', 'mvp', 'mapas', 'partida'] as const
    return order.map((g) => ({
      id: g,
      label: g === 'equipes' ? 'Equipes' : g === 'mvp' ? 'MVP' : g === 'mapas' ? 'Mapas' : 'Partida',
      items: STREAM_SHEETS.filter((s) => s.group === g),
    }))
  }, [])

  const body = (
    <div className="stream-sheet-modal-panel" role="dialog" aria-modal={asModal} aria-label="Planilha de dados do stream">
      <div className="stream-sheet-modal-head">
        <div>
          <p className="eyebrow">Stream · dados ao vivo</p>
          <h3>Planilha de dados</h3>
          <p className="stream-hint">
            Fontes para overlays. Endereço de célula: <code>{sheet.refName}!B2</code> (linha 1 = cabeçalho).
            Coluna <strong>Δ</strong> = subiu/desceu em relação à partida anterior (+2 ▲ / -3 ▼).
          </p>
        </div>
        <div className="stream-panel-actions">
          {sheet.live ? <span className="stream-badge">ao vivo</span> : null}
          <button type="button" className="stream-icon-btn" onClick={() => void reload()} disabled={loading} title="Atualizar">
            {loading ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />}
            Atualizar
          </button>
          {asModal ? (
            <button type="button" className="stream-icon-btn" onClick={() => setOpen(false)} title="Fechar">
              <X size={16} /> Fechar
            </button>
          ) : null}
        </div>
      </div>

      <div className="stream-sheet-groups">
        {groups.map((g) => (
          <div key={g.id} className="stream-sheet-group">
            <span className="stream-sheet-group-label">{g.label}</span>
            <div className="stream-sheet-tabs">
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={sheetId === item.id ? 'active' : ''}
                  onClick={() => {
                    setSheetId(item.id)
                    setFilters({})
                  }}
                >
                  {item.title.replace(/^Equipes · /, '').replace(/^Partida /, 'Partida ')}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {renderFilter()}

      {error ? <div className="stream-error">{error}</div> : null}
      {loadedAt && !error ? (
        <p className="stream-hint">Atualizado às {loadedAt} · {rows.length} linha(s) · aba {sheet.title}</p>
      ) : null}

      <div className="stream-sheet-wrap stream-sheet-wrap-modal">
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
                <td colSpan={sheet.columns.length + 1} className="stream-sheet-empty">Carregando dados…</td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={sheet.columns.length + 1} className="stream-sheet-empty">
                  {sheet.filter && sheet.filter !== 'none' && !Object.values(filters).some(Boolean)
                    ? 'Selecione um filtro acima para carregar os dados.'
                    : 'Nenhum dado nesta aba ainda.'}
                </td>
              </tr>
            ) : null}
            {rows.map((row, rowIndex) => {
              const excelRow = rowIndex + 2
              return (
                <tr key={row.id}>
                  <td className="stream-sheet-row-head" title={`Linha ${excelRow}`}>{excelRow}</td>
                  {sheet.columns.map((col) => {
                    const val = row.cells[col.key] || ''
                    const isDelta = col.key === 'delta'
                    const showImg = Boolean(val) && (col.image || isImageCellValue(val))
                    const deltaClass =
                      isDelta && val.includes('▲')
                        ? 'is-up'
                        : isDelta && val.includes('▼')
                          ? 'is-down'
                          : ''
                    return (
                      <td
                        key={col.key}
                        title={showImg ? `${sheet.refName}!${col.letter}${excelRow}` : `${sheet.refName}!${col.letter}${excelRow}${val ? ` · ${val}` : ''}`}
                        className={`${deltaClass}${showImg ? ' is-img-cell' : ''}`}
                      >
                        {showImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={val} alt="" className="stream-sheet-thumb" loading="lazy" />
                        ) : (
                          <input readOnly value={val} aria-label={`${col.label} linha ${excelRow}`} spellCheck={false} />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  if (!asModal) {
    return <section className="stream-panel stream-sheet-panel is-full">{body}</section>
  }

  return (
    <>
      {props.showTrigger !== false ? (
        <button type="button" className="stream-primary-btn" onClick={() => setOpen(true)}>
          <Table2 size={15} /> {props.triggerLabel || 'Planilha de dados'}
        </button>
      ) : null}
      {open ? (
        <div className="stream-sheet-modal-root" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="stream-sheet-modal-drop">
            {body}
          </div>
        </div>
      ) : null}
    </>
  )
}
