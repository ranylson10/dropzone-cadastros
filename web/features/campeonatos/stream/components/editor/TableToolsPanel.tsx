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
  TableRowItem,
} from '../../types/stream.types'
import {
  addTableColumn,
  fieldLabel,
  removeTableColumn,
  tableSourceId,
  updateTableColumn,
  updateTableRow,
} from '../../utils/table-structure'
import { FieldStyleEditor } from './StylePanels'
import { ColumnPicker } from './CellPicker'

type TabId = 'colunas' | 'visual'

const TABS: Array<{ id: TabId; label: string; hint: string }> = [
  { id: 'colunas', label: 'Colunas', hint: 'Partes da linha — vincular na planilha' },
  { id: 'visual', label: 'Visual', hint: 'Altura, cores e estilos' },
]

export function TableToolsPanel(props: {
  table: StreamTableBlock
  selectedRow: TableRowItem | null
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  onPatchData: (patch: (data: TableBlockData) => TableBlockData, history?: 'soft' | 'force') => void
}) {
  const [tab, setTab] = useState<TabId>('colunas')
  const [openColId, setOpenColId] = useState<string | null>(null)

  const data = props.table.data
  const sourceId = tableSourceId(data.source)
  const sheetDef = getSheetDef(sourceId)
  const cols = data.columnDefs || []

  function patch(fn: (d: TableBlockData) => TableBlockData, history: 'soft' | 'force' = 'soft') {
    props.onPatchData(fn, history)
  }

  function bindColumn(colId: string, pick: {
    sheetId: StreamSheetId
    colKey: string
    label: string
    image?: boolean
    display: string
  }) {
    patch((d) => {
      const next = updateTableColumn(d, colId, {
        field: pick.colKey,
        label: pick.label,
        asImage: Boolean(pick.image),
      })
      // planilha da tabela = a da coluna vinculada (como no bloco)
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
      const next = addTableColumn(d, 'nome')
      createdId = next.columnDefs?.[next.columnDefs.length - 1]?.id || null
      // coluna nova sem vínculo real ainda — marca label genérico
      if (createdId) {
        return updateTableColumn(next, createdId, {
          field: '',
          label: `Coluna ${(next.columnDefs?.length || 1)}`,
          asImage: false,
        })
      }
      return next
    }, 'force')
    if (createdId) setOpenColId(createdId)
  }

  return (
    <div className="stream-table-tools">
      <p className="stream-hint">
        <strong>Tabela</strong> — cada coluna é uma parte da linha.
        Abra a planilha e clique no campo, igual ao bloco.
      </p>
      {sourceId ? (
        <p className="stream-hint">
          Planilha em uso: <code>{sheetDef.title}</code> (definida pelo vínculo das colunas)
        </p>
      ) : null}

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

      {tab === 'colunas' ? (
        <div className="stream-table-tab-body" role="tabpanel">
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
                onChange={(patchCol) => patch((d) => updateTableColumn(d, col.id, patchCol))}
                onBind={(pick) => bindColumn(col.id, pick)}
                onRemove={() => {
                  patch((d) => removeTableColumn(d, col.id), 'force')
                  if (openColId === col.id) setOpenColId(null)
                }}
              />
            ))}
          </ul>

          {!cols.length ? (
            <p className="stream-hint">Nenhuma coluna. Clique + Coluna e vincule na planilha.</p>
          ) : null}
        </div>
      ) : null}

      {tab === 'visual' ? (
        <div className="stream-table-tab-body" role="tabpanel">
          <p className="stream-hint"><strong>Aparência</strong></p>
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
                <strong>Linha selecionada</strong> — {props.selectedRow.name}
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
                  <span>Altura (px)</span>
                  <input
                    type="number"
                    min={18}
                    max={200}
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
            <p className="stream-hint">Selecione a linha no canvas ou em Camadas para cor individual.</p>
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
  const display = bound
    ? `${sheetTitle || props.sourceId}.${col.field}`
    : undefined

  return (
    <li className={props.open ? 'is-open' : ''}>
      <button type="button" className="stream-table-col-row" onClick={props.onToggle}>
        <span className="stream-table-col-index">{props.index + 1}</span>
        <span>
          <strong>{col.label || fieldLabel(col.field) || `Coluna ${props.index + 1}`}</strong>
          <small>
            {bound
              ? `→ ${col.field} · ${col.widthPx || 0}px${col.asImage ? ' · img' : ''}`
              : 'sem vínculo — abra a planilha'}
          </small>
        </span>
        <em>{props.open ? '▲' : '▼'}</em>
      </button>
      {props.open ? (
        <div className="stream-table-col-drawer">
          <ColumnPicker
            sheets={props.sheets}
            value={
              bound
                ? { sheetId: props.sourceId, colKey: col.field, display }
                : undefined
            }
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
              <span>Rótulo header</span>
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
