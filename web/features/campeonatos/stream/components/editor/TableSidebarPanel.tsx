'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { getSheetDef } from '../../types/stream.types'
import type {
  StreamSheetId,
  StreamSheetRow,
  StreamTableBlock,
  TableBlockData,
  TableColumnDef,
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
          <span>Header (px)</span>
          <input
            type="number"
            min={0}
            max={120}
            value={data.headerHeight ?? 32}
            onChange={(e) => patch((d) => ({ ...d, headerHeight: Number(e.target.value) || 0 }))}
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
        <label className="stream-style-field stream-check-inline">
          <span>Header</span>
          <input
            type="checkbox"
            checked={data.showHeader !== false}
            onChange={(e) => patch((d) => ({ ...d, showHeader: e.target.checked }))}
          />
        </label>
      </div>

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
              ? `→ ${col.field} · ${col.widthPx || 0}px`
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
              <span>Rótulo</span>
              <input value={col.label} onChange={(e) => props.onChange({ label: e.target.value })} />
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
          </div>
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
