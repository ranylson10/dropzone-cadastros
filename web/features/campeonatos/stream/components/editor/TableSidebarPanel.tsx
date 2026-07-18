'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { DEFAULT_TEXT, STREAM_FONTS, getSheetDef } from '../../types/stream.types'
import type {
  StreamSheetId,
  StreamSheetRow,
  StreamTableBlock,
  TableBlockData,
  TableColumnDef,
  TextStyle,
} from '../../types/stream.types'
import {
  addTableColumn,
  fieldLabel,
  removeTableColumn,
  setTableRowCount,
  tableSourceId,
  updateTableColumn,
} from '../../utils/table-structure'
import { ColumnPicker } from './CellPicker'

/**
 * Painel direito — configuração da TABELA (linha modelo).
 * Número de linhas, colunas, vínculo planilha, cores por coluna.
 * Estilo de 1 linha modelo se aplica a todas.
 */
export function TableSidebarPanel(props: {
  table: StreamTableBlock
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  onPatchData: (patch: (data: TableBlockData) => TableBlockData, history?: 'soft' | 'force') => void
}) {
  const [openColId, setOpenColId] = useState<string | null>(null)
  const data = props.table.data
  const sourceId = tableSourceId(data.source)
  const sheetDef = getSheetDef(sourceId)
  const cols = data.columnDefs || []
  const tableW = props.table.tableW || 520

  function patch(fn: (d: TableBlockData) => TableBlockData, history: 'soft' | 'force' = 'soft') {
    props.onPatchData(fn, history)
  }

  function bindColumn(
    colId: string,
    pick: { sheetId: StreamSheetId; colKey: string; label: string; image?: boolean; display: string },
  ) {
    patch((d) => {
      const next = updateTableColumn(
        d,
        colId,
        {
          field: pick.colKey,
          label: pick.label,
          asImage: Boolean(pick.image),
        },
        tableW,
      )
      return {
        ...next,
        source: pick.sheetId,
        variant: pick.sheetId === 'mvp' ? 'mvp_list' : 'standings',
      }
    }, 'force')
  }

  function addBlankColumn() {
    let createdId: string | null = null
    patch((d) => {
      const next = addTableColumn(d, '', tableW)
      createdId = next.columnDefs?.[next.columnDefs.length - 1]?.id || null
      if (createdId) {
        return updateTableColumn(
          next,
          createdId,
          { field: '', label: `Coluna ${next.columnDefs?.length || 1}`, asImage: false },
          tableW,
        )
      }
      return next
    }, 'force')
    if (createdId) setOpenColId(createdId)
  }

  return (
    <div className="stream-table-sidebar">
      <div className="stream-gt-layer-head" style={{ borderBottom: '1px solid var(--line)', marginBottom: 8 }}>
        <strong>Tabela</strong>
        <em style={{ fontSize: 11, color: 'var(--muted)' }}>{data.rows} linhas · {cols.length} cols</em>
      </div>

      <p className="stream-hint">
        Edite a <strong>linha modelo</strong> (colunas, cores, altura).
        O número de linhas multiplica o mesmo layout com dados da planilha.
      </p>

      <label className="stream-field">
        <span>Número de linhas</span>
        <input
          type="number"
          min={1}
          max={40}
          value={data.rows || 1}
          onChange={(e) => {
            const n = Math.max(1, Math.min(40, Number(e.target.value) || 1))
            patch((d) => setTableRowCount(d, n), 'soft')
          }}
        />
      </label>

      <div className="stream-style-grid">
        <label className="stream-style-field">
          <span>Altura linha (px)</span>
          <input
            type="number"
            min={18}
            max={200}
            value={data.rowHeight ?? 36}
            onChange={(e) => patch((d) => ({ ...d, rowHeight: Number(e.target.value) || 36 }))}
          />
        </label>
        <label className="stream-style-field">
          <span>Espaço (px)</span>
          <input
            type="number"
            min={0}
            max={48}
            value={data.rowGap ?? 0}
            onChange={(e) => patch((d) => ({ ...d, rowGap: Number(e.target.value) || 0 }))}
          />
        </label>
        <label className="stream-style-field">
          <span>Rank inicial</span>
          <input
            type="number"
            min={1}
            value={data.startRank || 1}
            onChange={(e) => patch((d) => ({ ...d, startRank: Math.max(1, Number(e.target.value) || 1) }))}
          />
        </label>
      </div>

      <div className="stream-style-grid">
        <label className="stream-style-field">
          <span>Fundo linha</span>
          <input
            type="color"
            value={(data.rowStyle?.box?.fill?.color || '#1a1d24').slice(0, 7)}
            onChange={(e) =>
              patch((d) => ({
                ...d,
                rowStyle: {
                  ...d.rowStyle,
                  box: {
                    ...d.rowStyle?.box,
                    fill: { mode: 'solid', color: e.target.value, opacity: 1 },
                  },
                },
              }))
            }
          />
        </label>
        <label className="stream-style-field">
          <span>Texto linha</span>
          <input
            type="color"
            value={(data.rowStyle?.text?.color || '#ffffff').slice(0, 7)}
            onChange={(e) =>
              patch((d) => ({
                ...d,
                rowStyle: {
                  ...d.rowStyle,
                  text: {
                    fontFamily: d.rowStyle?.text?.fontFamily || 'Rajdhani',
                    fontWeight: d.rowStyle?.text?.fontWeight || 700,
                    fontSize: d.rowStyle?.text?.fontSize || 14,
                    color: e.target.value,
                    align: d.rowStyle?.text?.align || 'left',
                  },
                },
              }))
            }
          />
        </label>
        <label className="stream-style-field">
          <span>Linha alternada</span>
          <input
            type="color"
            value={(data.altRowFill || '#141820').slice(0, 7)}
            onChange={(e) => patch((d) => ({ ...d, altRowFill: e.target.value }))}
          />
        </label>
      </div>

      {/* —— Legenda / Header —— */}
      <HeaderLegendEditor
        showHeader={data.showHeader !== false}
        headerHeight={data.headerHeight ?? 32}
        headerStyle={data.headerStyle}
        onShowHeader={(show) => patch((d) => ({ ...d, showHeader: show }))}
        onHeaderHeight={(h) => patch((d) => ({ ...d, headerHeight: h }))}
        onHeaderStyle={(headerStyle) => patch((d) => ({ ...d, headerStyle }))}
      />

      {sourceId ? (
        <p className="stream-hint">
          Planilha: <code>{sheetDef.title}</code> (pelo vínculo das colunas)
        </p>
      ) : null}

      <p className="stream-hint" style={{ marginTop: 8 }}>
        <strong>Colunas da linha modelo</strong>
      </p>
      <button type="button" className="stream-primary-btn stream-table-add-col-btn" onClick={addBlankColumn}>
        <Plus size={14} /> Coluna
      </button>

      <ul className="stream-table-col-list">
        {cols.map((col, index) => (
          <ColumnEditor
            key={col.id}
            col={col}
            index={index}
            open={openColId === col.id}
            sourceId={sourceId}
            sheets={props.sheets}
            onToggle={() => setOpenColId(openColId === col.id ? null : col.id)}
            onChange={(p) => patch((d) => updateTableColumn(d, col.id, p, tableW))}
            onBind={(pick) => bindColumn(col.id, pick)}
            onRemove={() => {
              patch((d) => removeTableColumn(d, col.id, tableW), 'force')
              if (openColId === col.id) setOpenColId(null)
            }}
          />
        ))}
      </ul>
      {!cols.length ? (
        <p className="stream-hint">Nenhuma coluna. Clique + Coluna e vincule na planilha.</p>
      ) : null}
    </div>
  )
}

function HeaderLegendEditor(props: {
  showHeader: boolean
  headerHeight: number
  headerStyle?: TableBlockData['headerStyle']
  onShowHeader: (show: boolean) => void
  onHeaderHeight: (h: number) => void
  onHeaderStyle: (style: TableBlockData['headerStyle']) => void
}) {
  const text: TextStyle = {
    ...DEFAULT_TEXT,
    fontSize: 11,
    fontWeight: 900,
    color: '#1a1208',
    align: 'center',
    uppercase: true,
    ...props.headerStyle?.text,
  }
  const bg = props.headerStyle?.box?.fill?.color || '#e8c547'

  function setText(patch: Partial<TextStyle>) {
    props.onHeaderStyle({
      ...props.headerStyle,
      text: { ...text, ...patch },
      box: props.headerStyle?.box || {
        fill: { mode: 'solid', color: bg, opacity: 1 },
        padding: 0,
      },
    })
  }

  return (
    <div className="stream-table-header-editor">
      <p className="stream-hint" style={{ marginTop: 8 }}>
        <strong>Legenda (header)</strong>
      </p>
      <label className="stream-field stream-check-inline">
        <input
          type="checkbox"
          checked={props.showHeader}
          onChange={(e) => props.onShowHeader(e.target.checked)}
        />
        <span>Mostrar legenda da tabela</span>
      </label>

      {props.showHeader ? (
        <>
          <div className="stream-style-grid">
            <label className="stream-style-field">
              <span>Altura (px)</span>
              <input
                type="number"
                min={14}
                max={120}
                value={props.headerHeight}
                onChange={(e) => props.onHeaderHeight(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
            <label className="stream-style-field">
              <span>Tam. fonte (px)</span>
              <input
                type="number"
                min={8}
                max={72}
                value={text.fontSize}
                onChange={(e) => setText({ fontSize: Number(e.target.value) || 11 })}
              />
            </label>
            <label className="stream-style-field">
              <span>Cor texto</span>
              <input
                type="color"
                value={(text.color || '#1a1208').slice(0, 7)}
                onChange={(e) => setText({ color: e.target.value })}
              />
            </label>
            <label className="stream-style-field">
              <span>Fundo</span>
              <input
                type="color"
                value={bg.slice(0, 7)}
                onChange={(e) =>
                  props.onHeaderStyle({
                    ...props.headerStyle,
                    text,
                    box: {
                      ...props.headerStyle?.box,
                      fill: { mode: 'solid', color: e.target.value, opacity: 1 },
                      padding: props.headerStyle?.box?.padding ?? 0,
                    },
                  })
                }
              />
            </label>
          </div>
          <label className="stream-field">
            <span>Fonte</span>
            <select
              value={text.fontFamily || 'Rajdhani'}
              onChange={(e) => setText({ fontFamily: e.target.value })}
            >
              {STREAM_FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <div className="stream-style-grid">
            <label className="stream-style-field">
              <span>Peso</span>
              <select
                value={text.fontWeight || 900}
                onChange={(e) => setText({ fontWeight: Number(e.target.value) || 900 })}
              >
                {[500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </label>
            <label className="stream-style-field stream-check-inline">
              <span>MAIÚSCULAS</span>
              <input
                type="checkbox"
                checked={text.uppercase !== false}
                onChange={(e) => setText({ uppercase: e.target.checked })}
              />
            </label>
          </div>
          <p className="stream-hint">
            Por coluna: use <em>Ocultar legenda</em> para esconder só aquele título (ex.: coluna de logo).
          </p>
        </>
      ) : (
        <p className="stream-hint">Legenda oculta. Ative para editar texto, cor e fonte.</p>
      )}
    </div>
  )
}

function ColumnEditor(props: {
  col: TableColumnDef
  index: number
  open: boolean
  sourceId: StreamSheetId
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  onToggle: () => void
  onChange: (patch: Partial<TableColumnDef>) => void
  onBind: (pick: {
    sheetId: StreamSheetId
    colKey: string
    label: string
    image?: boolean
    display: string
  }) => void
  onRemove: () => void
}) {
  const { col } = props
  const bound = Boolean(col.field)
  const sheetTitle = bound ? getSheetDef(props.sourceId).title : null
  const display = bound ? `${sheetTitle || props.sourceId}.${col.field}` : undefined

  return (
    <li className={props.open ? 'is-open' : ''}>
      <button type="button" className="stream-table-col-row" onClick={props.onToggle}>
        <span className="stream-table-col-index">{props.index + 1}</span>
        <span>
          <strong>{col.label || fieldLabel(col.field) || `Coluna ${props.index + 1}`}</strong>
          <small>
            {bound
              ? `→ ${col.field} · ${col.widthPx || 0}px${col.hideHeader ? ' · sem legenda' : ''}`
              : 'sem vínculo — abra a planilha'}
          </small>
        </span>
        <em>{props.open ? '▲' : '▼'}</em>
      </button>
      {props.open ? (
        <div className="stream-table-col-drawer">
          <ColumnPicker
            sheets={props.sheets}
            value={bound ? { sheetId: props.sourceId, colKey: col.field, display } : undefined}
            triggerLabel="Abrir planilha e escolher coluna"
            onPick={(pick) => {
              props.onBind({
                sheetId: pick.sheetId,
                colKey: pick.colKey,
                label: pick.label,
                image: pick.image,
                display: pick.display,
              })
            }}
          />
          <div className="stream-style-grid">
            <label className="stream-style-field">
              <span>Rótulo (legenda)</span>
              <input
                value={col.label}
                disabled={Boolean(col.hideHeader)}
                onChange={(e) => props.onChange({ label: e.target.value })}
              />
            </label>
            <label className="stream-style-field stream-check-inline">
              <span>Ocultar legenda</span>
              <input
                type="checkbox"
                checked={Boolean(col.hideHeader)}
                title="Esconde só o texto da legenda nesta coluna"
                onChange={(e) => props.onChange({ hideHeader: e.target.checked })}
              />
            </label>
            <label className="stream-style-field">
              <span>Largura (px)</span>
              <input
                type="number"
                min={8}
                max={2000}
                value={col.widthPx || 80}
                onChange={(e) => props.onChange({ widthPx: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="stream-style-field">
              <span>Margem (px)</span>
              <input
                type="number"
                min={0}
                max={80}
                title="Espaço interno da célula (todas as bordas)"
                value={col.paddingPx ?? 4}
                onChange={(e) => {
                  const n = Math.max(0, Number(e.target.value) || 0)
                  props.onChange({ paddingPx: n, paddingX: n, paddingY: n })
                }}
              />
            </label>
            <label className="stream-style-field">
              <span>Margem H (px)</span>
              <input
                type="number"
                min={0}
                max={80}
                title="Espaço esq./dir. da célula"
                value={col.paddingX ?? col.paddingPx ?? 4}
                onChange={(e) => props.onChange({ paddingX: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
            <label className="stream-style-field">
              <span>Margem V (px)</span>
              <input
                type="number"
                min={0}
                max={80}
                title="Espaço cima/baixo da célula"
                value={col.paddingY ?? col.paddingPx ?? 4}
                onChange={(e) => props.onChange({ paddingY: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
            <label className="stream-style-field">
              <span>Fundo col.</span>
              <input
                type="color"
                value={(col.fill || '#1a1d24').slice(0, 7)}
                onChange={(e) => props.onChange({ fill: e.target.value })}
              />
            </label>
            <label className="stream-style-field">
              <span>Texto col.</span>
              <input
                type="color"
                value={(col.textColor || '#ffffff').slice(0, 7)}
                onChange={(e) => props.onChange({ textColor: e.target.value })}
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
            {(col.asImage || col.field === 'logo' || col.field === 'foto') ? (
              <label className="stream-style-field">
                <span>Tam. logo (px)</span>
                <input
                  type="number"
                  min={8}
                  max={400}
                  title="0 = preencher o espaço da célula após a margem"
                  value={col.imageSizePx ?? 0}
                  placeholder="auto"
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw.trim() === '' || Number(raw) <= 0) {
                      props.onChange({ imageSizePx: undefined })
                      return
                    }
                    props.onChange({ imageSizePx: Math.max(8, Number(raw) || 8) })
                  }}
                />
              </label>
            ) : null}
          </div>
          <p className="stream-hint">
            <strong>Margem</strong> = distância do conteúdo às bordas.
            Logo: margem menor = imagem maior; ou fixe <em>Tam. logo</em> (0 = automático).
          </p>
          <button
            type="button"
            className="stream-secondary-btn"
            onClick={() => props.onChange({ fill: undefined, textColor: undefined })}
          >
            Limpar cores da coluna
          </button>
          <button type="button" className="stream-secondary-btn" onClick={props.onRemove}>
            <Trash2 size={14} /> Remover coluna
          </button>
        </div>
      ) : null}
    </li>
  )
}
