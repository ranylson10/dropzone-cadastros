'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  STREAM_SHEETS,
  type StreamSheetId,
  type StreamSheetRow,
  type StreamTableBlock,
  type TableBlockData,
  type TableColumnDef,
  type TableRowItem,
} from '../../types/stream.types'
import {
  addTableColumn,
  fieldLabel,
  removeTableColumn,
  setTableSheetSource,
  tableSourceId,
  updateTableColumn,
  updateTableRow,
} from '../../utils/table-structure'
import { FieldStyleEditor } from './StylePanels'

type TabId = 'dados' | 'colunas' | 'visual'

const TABS: Array<{ id: TabId; label: string; hint: string }> = [
  { id: 'dados', label: '1 · Dados', hint: 'Qual planilha alimenta a tabela' },
  { id: 'colunas', label: '2 · Colunas', hint: 'Partes da linha e vínculo' },
  { id: 'visual', label: '3 · Visual', hint: 'Altura, cores e estilos' },
]

const SHEET_GROUPS: Array<{ id: string; label: string }> = [
  { id: 'equipes', label: 'Equipes' },
  { id: 'mvp', label: 'MVP' },
  { id: 'mapas', label: 'Mapas' },
  { id: 'partida', label: 'Partida' },
]

export function TableToolsPanel(props: {
  table: StreamTableBlock
  selectedRow: TableRowItem | null
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  onPatchData: (patch: (data: TableBlockData) => TableBlockData, history?: 'soft' | 'force') => void
}) {
  const [tab, setTab] = useState<TabId>('dados')
  const [openColId, setOpenColId] = useState<string | null>(null)

  const data = props.table.data
  const sourceId = tableSourceId(data.source)
  const sheetDef = useMemo(
    () => STREAM_SHEETS.find((s) => s.id === sourceId) || STREAM_SHEETS[0],
    [sourceId],
  )
  const sheetRows = props.sheets[sourceId] || []
  const cols = data.columnDefs || []

  function patch(fn: (d: TableBlockData) => TableBlockData, history: 'soft' | 'force' = 'soft') {
    props.onPatchData(fn, history)
  }

  return (
    <div className="stream-table-tools">
      <div className="stream-table-tabs" role="tablist" aria-label="Configuração da tabela">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dados' ? (
        <div className="stream-table-tab-body" role="tabpanel">
          <p className="stream-hint">
            <strong>Planilha de dados</strong> — escolha a aba que alimenta as linhas.
            Depois, em <em>Colunas</em>, vincule cada parte da linha a um campo.
          </p>

          {SHEET_GROUPS.map((g) => {
            const items = STREAM_SHEETS.filter((s) => s.group === g.id)
            if (!items.length) return null
            return (
              <div key={g.id} className="stream-table-sheet-group">
                <span className="stream-table-sheet-group-label">{g.label}</span>
                <div className="stream-table-sheet-list">
                  {items.map((s) => {
                    const count = props.sheets[s.id]?.length
                    const active = sourceId === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`stream-table-sheet-card ${active ? 'is-active' : ''}`}
                        onClick={() => {
                          if (active) return
                          patch((d) => setTableSheetSource(d, s.id), 'force')
                          setOpenColId(null)
                        }}
                      >
                        <strong>{s.title}</strong>
                        <em>
                          {s.live ? 'ao vivo' : 'estático'}
                          {count != null ? ` · ${count} linhas` : ''}
                        </em>
                        <small>{s.columns.map((c) => c.label).slice(0, 5).join(' · ')}{s.columns.length > 5 ? '…' : ''}</small>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="stream-style-grid" style={{ marginTop: 8 }}>
            <label className="stream-style-field">
              <span>Rank inicial</span>
              <input
                type="number"
                min={1}
                value={data.startRank || 1}
                onChange={(e) =>
                  patch((d) => ({ ...d, startRank: Math.max(1, Number(e.target.value) || 1) }))
                }
              />
            </label>
          </div>

          <div className="stream-table-data-preview">
            <p className="stream-hint">
              <strong>Aba ativa:</strong> {sheetDef.title}
              {sheetRows.length ? ` · ${sheetRows.length} registro(s)` : ' · sem dados ainda'}
            </p>
            {sheetRows[0] ? (
              <div className="stream-table-sample-row">
                {sheetDef.columns.slice(0, 6).map((c) => (
                  <span key={c.key} title={c.key}>
                    <small>{c.label}</small>
                    {c.image && sheetRows[0].cells[c.key] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sheetRows[0].cells[c.key]} alt="" />
                    ) : (
                      String(sheetRows[0].cells[c.key] || '—').slice(0, 18)
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="stream-hint">Abra a planilha do stream ou pontue o campeonato para ver dados.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'colunas' ? (
        <div className="stream-table-tab-body" role="tabpanel">
          <p className="stream-hint">
            <strong>Colunas = partes da linha</strong> — cada uma vincula a um campo da planilha{' '}
            <em>{sheetDef.title}</em>.
          </p>

          <div className="stream-add-layer-row stream-table-add-cols">
            {sheetDef.columns.map((c) => {
              const already = cols.some((col) => col.field === c.key)
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={already}
                  title={already ? 'Já na linha' : `Adicionar ${c.label}`}
                  onClick={() => {
                    patch((d) => addTableColumn(d, c.key), 'force')
                  }}
                >
                  <Plus size={12} /> {c.label}
                </button>
              )
            })}
          </div>

          <ul className="stream-table-col-list">
            {cols.map((col, index) => (
              <ColumnEditor
                key={col.id}
                col={col}
                index={index}
                open={openColId === col.id}
                sheetColumns={sheetDef.columns}
                onToggle={() => setOpenColId(openColId === col.id ? null : col.id)}
                onChange={(patchCol) => patch((d) => updateTableColumn(d, col.id, patchCol))}
                onRemove={() => {
                  patch((d) => removeTableColumn(d, col.id), 'force')
                  if (openColId === col.id) setOpenColId(null)
                }}
              />
            ))}
          </ul>

          {!cols.length ? (
            <p className="stream-hint">Nenhuma coluna. Use os botões + acima (campos da planilha).</p>
          ) : null}

          <p className="stream-hint">
            Larguras em % somam ~100. Ajuste uma por uma; o sistema reescala se precisar.
          </p>
        </div>
      ) : null}

      {tab === 'visual' ? (
        <div className="stream-table-tab-body" role="tabpanel">
          <p className="stream-hint"><strong>Aparência da tabela</strong> (header e linhas)</p>
          <div className="stream-style-grid">
            <label className="stream-style-field">
              <span>Altura linha</span>
              <input
                type="number"
                min={18}
                max={80}
                value={data.rowHeight ?? 36}
                onChange={(e) => patch((d) => ({ ...d, rowHeight: Number(e.target.value) || 36 }))}
              />
            </label>
            <label className="stream-style-field">
              <span>Espaço</span>
              <input
                type="number"
                min={0}
                max={24}
                value={data.rowGap ?? 0}
                onChange={(e) => patch((d) => ({ ...d, rowGap: Number(e.target.value) || 0 }))}
              />
            </label>
            <label className="stream-style-field">
              <span>Altura header</span>
              <input
                type="number"
                min={0}
                max={64}
                value={data.headerHeight ?? 32}
                onChange={(e) => patch((d) => ({ ...d, headerHeight: Number(e.target.value) || 0 }))}
              />
            </label>
            <label className="stream-style-field">
              <span>Linha alternada</span>
              <input
                type="color"
                value={(data.altRowFill || '#1a1d24').slice(0, 7)}
                onChange={(e) => patch((d) => ({ ...d, altRowFill: e.target.value }))}
              />
            </label>
          </div>
          <label className="stream-field stream-check-inline">
            <input
              type="checkbox"
              checked={data.showHeader !== false}
              onChange={(e) => patch((d) => ({ ...d, showHeader: e.target.checked }))}
            />
            <span>Mostrar cabeçalho</span>
          </label>

          <p className="stream-hint"><strong>Estilo do cabeçalho</strong></p>
          <FieldStyleEditor
            value={data.headerStyle}
            onChange={(headerStyle) => patch((d) => ({ ...d, headerStyle }))}
          />
          <p className="stream-hint"><strong>Estilo da linha padrão</strong></p>
          <FieldStyleEditor
            value={data.rowStyle}
            onChange={(rowStyle) => patch((d) => ({ ...d, rowStyle }))}
          />

          {props.selectedRow ? (
            <>
              <p className="stream-hint">
                <strong>Linha selecionada</strong> — {props.selectedRow.name} (também na lista de camadas)
              </p>
              <div className="stream-style-grid">
                <label className="stream-style-field">
                  <span>Nome</span>
                  <input
                    value={props.selectedRow.name}
                    onChange={(e) =>
                      patch((d) => updateTableRow(d, props.selectedRow!.id, { name: e.target.value }))
                    }
                  />
                </label>
                <label className="stream-style-field">
                  <span>Altura</span>
                  <input
                    type="number"
                    min={18}
                    max={120}
                    value={props.selectedRow.height ?? data.rowHeight ?? 36}
                    onChange={(e) =>
                      patch((d) =>
                        updateTableRow(d, props.selectedRow!.id, {
                          height: Number(e.target.value) || 36,
                        }),
                      )
                    }
                  />
                </label>
                <label className="stream-style-field">
                  <span>Fundo</span>
                  <input
                    type="color"
                    value={(props.selectedRow.fill || '#1a1d24').slice(0, 7)}
                    onChange={(e) =>
                      patch((d) => updateTableRow(d, props.selectedRow!.id, { fill: e.target.value }))
                    }
                  />
                </label>
                <label className="stream-style-field">
                  <span>Texto</span>
                  <input
                    type="color"
                    value={(props.selectedRow.textColor || '#ffffff').slice(0, 7)}
                    onChange={(e) =>
                      patch((d) =>
                        updateTableRow(d, props.selectedRow!.id, { textColor: e.target.value }),
                      )
                    }
                  />
                </label>
              </div>
            </>
          ) : (
            <p className="stream-hint">Selecione a linha no canvas ou em Camadas para cor/altura individual.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function ColumnEditor(props: {
  col: TableColumnDef
  index: number
  open: boolean
  sheetColumns: Array<{ key: string; label: string; image?: boolean }>
  onToggle: () => void
  onChange: (patch: Partial<TableColumnDef>) => void
  onRemove: () => void
}) {
  const { col } = props
  const bound = props.sheetColumns.find((c) => c.key === col.field)
  return (
    <li className={props.open ? 'is-open' : ''}>
      <button type="button" className="stream-table-col-row" onClick={props.onToggle}>
        <span className="stream-table-col-index">{props.index + 1}</span>
        <span>
          <strong>{col.label || fieldLabel(col.field)}</strong>
          <small>
            → {bound?.label || col.field} · {col.widthPct}%
            {col.asImage || bound?.image ? ' · img' : ''}
          </small>
        </span>
        <em>{props.open ? '▲' : '▼'}</em>
      </button>
      {props.open ? (
        <div className="stream-table-col-drawer">
          <label className="stream-field">
            <span>Vincular à coluna da planilha</span>
            <select
              value={col.field}
              onChange={(e) => {
                const key = e.target.value
                const sc = props.sheetColumns.find((c) => c.key === key)
                props.onChange({
                  field: key,
                  label: sc?.label || fieldLabel(key),
                  asImage: Boolean(sc?.image),
                })
              }}
            >
              {/* se field legado não está na planilha, mantém opção */}
              {!props.sheetColumns.some((c) => c.key === col.field) ? (
                <option value={col.field}>{fieldLabel(col.field)} (legado)</option>
              ) : null}
              {props.sheetColumns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({c.key}){c.image ? ' · imagem' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="stream-style-grid">
            <label className="stream-style-field">
              <span>Rótulo header</span>
              <input value={col.label} onChange={(e) => props.onChange({ label: e.target.value })} />
            </label>
            <label className="stream-style-field">
              <span>Largura %</span>
              <input
                type="number"
                min={1}
                max={100}
                value={col.widthPct}
                onChange={(e) => props.onChange({ widthPct: Number(e.target.value) || 1 })}
              />
            </label>
            <label className="stream-style-field">
              <span>Alinhar</span>
              <select
                value={col.align || 'center'}
                onChange={(e) =>
                  props.onChange({ align: e.target.value as 'left' | 'center' | 'right' })
                }
              >
                <option value="left">Esq.</option>
                <option value="center">Centro</option>
                <option value="right">Dir.</option>
              </select>
            </label>
            <label className="stream-style-field stream-check-inline">
              <span>Imagem</span>
              <input
                type="checkbox"
                checked={Boolean(col.asImage)}
                onChange={(e) => props.onChange({ asImage: e.target.checked })}
              />
            </label>
          </div>
          <button type="button" className="stream-secondary-btn" onClick={props.onRemove}>
            <Trash2 size={14} /> Remover coluna
          </button>
        </div>
      ) : null}
    </li>
  )
}
