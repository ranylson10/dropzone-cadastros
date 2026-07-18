'use client'

import { Trash2 } from 'lucide-react'
import { getSheetDef } from '../../types/stream.types'
import type {
  StreamSheetId,
  StreamSheetRow,
  StreamTableBlock,
  TableBlockData,
  TableColumnDef,
  TablePartSelection,
} from '../../types/stream.types'
import {
  fieldLabel,
  removeTableColumn,
  setTableRowCount,
  tableSourceId,
  updateTableColumn,
} from '../../utils/table-structure'
import { FieldStyleEditor } from './StylePanels'
import { ColumnPicker } from './CellPicker'

/**
 * Inspector esquerdo — edita a parte selecionada da tabela
 * (legenda, linha modelo ou coluna), com estilos completos.
 */
export function TablePartInspector(props: {
  table: StreamTableBlock
  part: TablePartSelection
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  onPatchData: (patch: (data: TableBlockData) => TableBlockData, history?: 'soft' | 'force') => void
  onClearPart: () => void
}) {
  const data = props.table.data
  const tableW = props.table.tableW || 520
  const sourceId = tableSourceId(data.source)
  const sheetDef = getSheetDef(sourceId)

  function patch(fn: (d: TableBlockData) => TableBlockData, history: 'soft' | 'force' = 'soft') {
    props.onPatchData(fn, history)
  }

  if (props.part.kind === 'header') {
    return (
      <div className="stream-table-part-inspector">
        <details className="stream-inspector-section" open>
          <summary>Legenda (cabeçalho)</summary>
          <label className="stream-field stream-check-inline">
            <input
              type="checkbox"
              checked={data.showHeader !== false}
              onChange={(e) => patch((d) => ({ ...d, showHeader: e.target.checked }))}
            />
            <span>Mostrar legenda da tabela</span>
          </label>
          <label className="stream-style-field">
            <span>Altura (px)</span>
            <input
              type="number"
              min={14}
              max={120}
              value={data.headerHeight ?? 32}
              disabled={data.showHeader === false}
              onChange={(e) =>
                patch((d) => ({ ...d, headerHeight: Math.max(0, Number(e.target.value) || 0) }))
              }
            />
          </label>
          <p className="stream-hint">
            Por coluna: use <em>Ocultar legenda</em> na camada da coluna para esconder só aquele título.
          </p>
        </details>

        {data.showHeader !== false ? (
          <details className="stream-inspector-section" open>
            <summary>Texto, fundo e borda</summary>
            <FieldStyleEditor
              value={data.headerStyle}
              allowImage
              onChange={(headerStyle) => patch((d) => ({ ...d, headerStyle }))}
            />
          </details>
        ) : (
          <p className="stream-hint">Legenda oculta. Ative para editar fonte, fundo e borda.</p>
        )}

        <div className="stream-block-actions" style={{ marginTop: 8 }}>
          <button type="button" className="stream-secondary-btn" onClick={props.onClearPart}>
            Voltar à tabela
          </button>
        </div>
      </div>
    )
  }

  if (props.part.kind === 'row') {
    const panels = Math.max(1, Number(data.splitPanels) || 1)
    const perPanel =
      data.rowsPerPanel != null && Number(data.rowsPerPanel) > 0
        ? Number(data.rowsPerPanel)
        : Math.max(1, Math.ceil((data.rows || 1) / panels))
    const start = data.startRank || 1
    const splitHint =
      panels > 1
        ? `Ex.: painel 1 = #${start}–#${start + perPanel - 1}, painel 2 = #${start + perPanel}–#${start + perPanel * 2 - 1}`
        : 'Use 2+ painéis para top 1–6 de um lado e top 7–12 do outro.'

    return (
      <div className="stream-table-part-inspector">
        <details className="stream-inspector-section" open>
          <summary>Linha modelo</summary>
          <p className="stream-hint">
            Uma linha define o visual de todas. O nº de linhas multiplica o layout com dados da planilha.
          </p>
          <div className="stream-style-grid">
            <label className="stream-style-field">
              <span>Nº de linhas</span>
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
            <label className="stream-style-field">
              <span>Altura (px)</span>
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
                onChange={(e) =>
                  patch((d) => ({ ...d, startRank: Math.max(1, Number(e.target.value) || 1) }))
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
          {sourceId ? (
            <p className="stream-hint">
              Planilha: <code>{sheetDef.title}</code> (pelo vínculo das colunas)
            </p>
          ) : null}
        </details>

        <details className="stream-inspector-section" open>
          <summary>Dividir em painéis</summary>
          <p className="stream-hint">
            Divide a tabela em blocos lado a lado (ex.: top 1–6 | top 7–12).
          </p>
          <div className="stream-style-grid">
            <label className="stream-style-field">
              <span>Painéis</span>
              <input
                type="number"
                min={1}
                max={6}
                value={panels}
                onChange={(e) =>
                  patch((d) => ({
                    ...d,
                    splitPanels: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                  }))
                }
              />
            </label>
            <label className="stream-style-field">
              <span>Linhas / painel</span>
              <input
                type="number"
                min={1}
                max={40}
                value={perPanel}
                title="Quantas linhas em cada bloco lateral"
                onChange={(e) => {
                  const n = Math.max(1, Math.min(40, Number(e.target.value) || 1))
                  patch((d) => ({ ...d, rowsPerPanel: n }))
                }}
              />
            </label>
            <label className="stream-style-field">
              <span>Espaço entre (px)</span>
              <input
                type="number"
                min={0}
                max={200}
                value={data.splitGapPx ?? 0}
                onChange={(e) =>
                  patch((d) => ({
                    ...d,
                    splitGapPx: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                  }))
                }
              />
            </label>
          </div>
          <label className="stream-field stream-check-inline">
            <input
              type="checkbox"
              checked={data.splitRepeatHeader !== false}
              disabled={panels <= 1}
              onChange={(e) => patch((d) => ({ ...d, splitRepeatHeader: e.target.checked }))}
            />
            <span>Repetir legenda em cada painel</span>
          </label>
          <p className="stream-hint">{splitHint}</p>
          <div className="stream-dock-row" style={{ marginTop: 4 }}>
            <button
              type="button"
              title="1 coluna"
              className={panels === 1 ? 'is-active' : ''}
              onClick={() => patch((d) => ({ ...d, splitPanels: 1 }))}
            >
              1×
            </button>
            <button
              type="button"
              title="2 painéis (ex.: 1–6 | 7–12)"
              className={panels === 2 ? 'is-active' : ''}
              onClick={() =>
                patch((d) => ({
                  ...d,
                  splitPanels: 2,
                  rowsPerPanel: d.rowsPerPanel || Math.ceil((d.rows || 12) / 2) || 6,
                  splitGapPx: d.splitGapPx || 24,
                }))
              }
            >
              2×
            </button>
            <button
              type="button"
              title="3 painéis"
              className={panels === 3 ? 'is-active' : ''}
              onClick={() =>
                patch((d) => ({
                  ...d,
                  splitPanels: 3,
                  rowsPerPanel: d.rowsPerPanel || Math.ceil((d.rows || 12) / 3) || 4,
                  splitGapPx: d.splitGapPx || 16,
                }))
              }
            >
              3×
            </button>
          </div>
        </details>

        <details className="stream-inspector-section" open>
          <summary>Texto, fundo e borda da linha</summary>
          <FieldStyleEditor
            value={data.rowStyle}
            allowImage
            onChange={(rowStyle) => patch((d) => ({ ...d, rowStyle }))}
          />
        </details>

        <div className="stream-block-actions" style={{ marginTop: 8 }}>
          <button type="button" className="stream-secondary-btn" onClick={props.onClearPart}>
            Voltar à tabela
          </button>
        </div>
      </div>
    )
  }

  // column
  if (props.part.kind !== 'column') return null
  const colId = props.part.id
  const col = (data.columnDefs || []).find((c) => c.id === colId)
  if (!col) {
    return (
      <p className="stream-hint">
        Coluna não encontrada.{' '}
        <button type="button" className="stream-secondary-btn" onClick={props.onClearPart}>
          Voltar
        </button>
      </p>
    )
  }

  return (
    <ColumnPartInspector
      col={col}
      tableW={tableW}
      sourceId={sourceId}
      sheets={props.sheets}
      onPatch={(p, history = 'soft') => patch((d) => updateTableColumn(d, col.id, p, tableW), history)}
      onBind={(pick) => {
        patch((d) => {
          const next = updateTableColumn(
            d,
            col.id,
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
      }}
      onRemove={() => {
        patch((d) => removeTableColumn(d, col.id, tableW), 'force')
        props.onClearPart()
      }}
      onClearPart={props.onClearPart}
    />
  )
}

function ColumnPartInspector(props: {
  col: TableColumnDef
  tableW: number
  sourceId: StreamSheetId
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  onPatch: (patch: Partial<TableColumnDef>, history?: 'soft' | 'force') => void
  onBind: (pick: {
    sheetId: StreamSheetId
    colKey: string
    label: string
    image?: boolean
    display: string
  }) => void
  onRemove: () => void
  onClearPart: () => void
}) {
  const { col } = props
  const bound = Boolean(col.field)
  const sheetTitle = bound ? getSheetDef(props.sourceId).title : null
  const display = bound ? `${sheetTitle || props.sourceId}.${col.field}` : undefined

  // monta FieldStyle a partir de style ou legado fill/textColor
  const styleValue = col.style || {
    box: col.fill
      ? { fill: { mode: 'solid' as const, color: col.fill, opacity: 1 } }
      : undefined,
    text: col.textColor
      ? {
          fontFamily: 'Rajdhani',
          fontWeight: 700,
          fontSize: 14,
          color: col.textColor,
          align: col.align || 'center',
        }
      : undefined,
  }

  return (
    <div className="stream-table-part-inspector">
      <details className="stream-inspector-section" open>
        <summary>Conteúdo da coluna</summary>
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
              onChange={(e) => props.onPatch({ label: e.target.value })}
            />
          </label>
          <label className="stream-style-field stream-check-inline">
            <span>Ocultar legenda</span>
            <input
              type="checkbox"
              checked={Boolean(col.hideHeader)}
              title="Esconde só o texto da legenda nesta coluna"
              onChange={(e) => props.onPatch({ hideHeader: e.target.checked })}
            />
          </label>
          <label className="stream-style-field">
            <span>Largura (px)</span>
            <input
              type="number"
              min={8}
              max={2000}
              value={col.widthPx || 80}
              onChange={(e) => props.onPatch({ widthPx: Math.max(1, Number(e.target.value) || 1) })}
            />
          </label>
          <label className="stream-style-field">
            <span>Alinhar</span>
            <select
              value={col.align || 'center'}
              onChange={(e) =>
                props.onPatch({ align: e.target.value as 'left' | 'center' | 'right' })
              }
            >
              <option value="left">Esq.</option>
              <option value="center">Centro</option>
              <option value="right">Dir.</option>
            </select>
          </label>
          <label className="stream-style-field">
            <span>Margem H (px)</span>
            <input
              type="number"
              min={0}
              max={80}
              value={col.paddingX ?? col.paddingPx ?? 4}
              onChange={(e) => props.onPatch({ paddingX: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label className="stream-style-field">
            <span>Margem V (px)</span>
            <input
              type="number"
              min={0}
              max={80}
              value={col.paddingY ?? col.paddingPx ?? 4}
              onChange={(e) => props.onPatch({ paddingY: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>
        <p className="stream-hint">
          {bound
            ? `Vínculo: ${col.field || fieldLabel(col.field)}`
            : 'Sem vínculo — abra a planilha e escolha a coluna.'}
        </p>
      </details>

      <details className="stream-inspector-section" open>
        <summary>Texto, fundo e borda da coluna</summary>
        <FieldStyleEditor
          value={styleValue}
          allowImage
          hideText={Boolean(col.asImage)}
          onChange={(style) => {
            // grava style completo + espelha fill/textColor legados para export antigo
            const fillColor =
              style.box?.fill?.mode === 'solid' || style.box?.fill?.mode === 'gradient'
                ? style.box.fill.color
                : undefined
            props.onPatch({
              style,
              fill: fillColor || col.fill,
              textColor: style.text?.color || col.textColor,
              align: (style.text?.align as TableColumnDef['align']) || col.align,
            })
          }}
        />
      </details>

      <div className="stream-block-actions" style={{ marginTop: 8 }}>
        <button type="button" className="stream-secondary-btn" onClick={props.onClearPart}>
          Voltar à tabela
        </button>
        <button type="button" className="stream-secondary-btn" onClick={props.onRemove}>
          <Trash2 size={14} /> Remover
        </button>
      </div>
    </div>
  )
}

/**
 * @deprecated O painel direito completo foi substituído por camadas + TablePartInspector.
 * Mantido como re-export para imports legados.
 */
export function TableSidebarPanel(props: {
  table: StreamTableBlock
  sheets: Partial<Record<StreamSheetId, StreamSheetRow[]>>
  onPatchData: (patch: (data: TableBlockData) => TableBlockData, history?: 'soft' | 'force') => void
}) {
  // fallback mínimo se ainda for montado em algum lugar
  return (
    <div className="stream-table-sidebar">
      <p className="stream-hint">
        Selecione <strong>Legenda</strong>, <strong>Linha</strong> ou uma <strong>Coluna</strong> na
        lista de camadas para editar à esquerda.
      </p>
      <p className="stream-hint">
        {props.table.data.rows} linhas · {(props.table.data.columnDefs || []).length} cols
      </p>
    </div>
  )
}
