import {
  newLayerId,
  type StreamTableBlock,
  type TableBlockData,
  type TableColumnDef,
  type TableColumnKey,
  type TableRowItem,
} from '../types/stream.types'

const DEFAULT_FIELDS: TableColumnKey[] = ['pos', 'logo', 'nome', 'booyah', 'abates', 'pts', 'delta']

const FIELD_LABELS: Record<string, string> = {
  pos: '#',
  logo: 'Logo',
  nome: 'Nome',
  booyah: 'B!',
  abates: 'Abates',
  pts: 'Pts',
  delta: 'Δ',
  quedas: 'Quedas',
  kd: 'K.D',
  custom: 'Custom',
}

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] || field.toUpperCase()
}

export function defaultColumnDefs(fields?: TableColumnKey[]): TableColumnDef[] {
  const list = fields?.length ? fields : DEFAULT_FIELDS
  const even = Math.floor(100 / list.length)
  let used = 0
  return list.map((field, i) => {
    const isLast = i === list.length - 1
    const widthPct = isLast ? Math.max(1, 100 - used) : even
    used += isLast ? 0 : even
    return {
      id: newLayerId(),
      field,
      label: fieldLabel(field),
      widthPct,
      align: field === 'nome' ? 'left' : 'center',
    }
  })
}

export function defaultRowItems(count: number, startRank = 1): TableRowItem[] {
  const n = Math.max(1, Math.min(40, count || 10))
  return Array.from({ length: n }, (_, i) => ({
    id: newLayerId(),
    name: `Linha ${i + 1}`,
    dataIndex: i,
    height: 36,
  }))
}

/** Normaliza tabela legada → columnDefs + rowItems. */
export function ensureTableStructure(block: StreamTableBlock): StreamTableBlock {
  if (block.type !== 'table') return block
  const data = block.data || ({} as TableBlockData)
  const columnDefs =
    Array.isArray(data.columnDefs) && data.columnDefs.length
      ? normalizeWidths(data.columnDefs)
      : defaultColumnDefs(data.columns)

  const rowItems =
    Array.isArray(data.rowItems) && data.rowItems.length
      ? data.rowItems
      : defaultRowItems(data.rows || 10, data.startRank || 1)

  return {
    ...block,
    tableW: block.tableW || 480,
    data: {
      ...data,
      columns: columnDefs.map((c) => (c.field === 'custom' ? 'nome' : c.field)) as TableColumnKey[],
      rows: rowItems.length,
      columnDefs,
      rowItems,
      showHeader: data.showHeader !== false,
      rowHeight: data.rowHeight ?? 36,
      rowGap: data.rowGap ?? 0,
      headerHeight: data.headerHeight ?? 32,
    },
  }
}

export function normalizeWidths(cols: TableColumnDef[]): TableColumnDef[] {
  if (!cols.length) return defaultColumnDefs()
  const sum = cols.reduce((s, c) => s + (Number(c.widthPct) || 0), 0)
  if (sum <= 0) {
    const even = Math.floor(100 / cols.length)
    return cols.map((c, i) => ({
      ...c,
      widthPct: i === cols.length - 1 ? 100 - even * (cols.length - 1) : even,
    }))
  }
  if (Math.abs(sum - 100) < 0.5) return cols.map((c) => ({ ...c, widthPct: Number(c.widthPct) || 1 }))
  // reescala para 100
  let used = 0
  return cols.map((c, i) => {
    const isLast = i === cols.length - 1
    const w = isLast ? Math.max(1, 100 - used) : Math.max(1, Math.round(((Number(c.widthPct) || 1) / sum) * 100))
    if (!isLast) used += w
    return { ...c, widthPct: w }
  })
}

export function addTableRow(data: TableBlockData): TableBlockData {
  const columnDefs =
    Array.isArray(data.columnDefs) && data.columnDefs.length
      ? data.columnDefs
      : defaultColumnDefs(data.columns)
  const items = [
    ...((Array.isArray(data.rowItems) && data.rowItems.length
      ? data.rowItems
      : defaultRowItems(data.rows || 10)) as TableRowItem[]),
  ]
  items.push({
    id: newLayerId(),
    name: `Linha ${items.length + 1}`,
    dataIndex: items.length,
    height: data.rowHeight ?? 36,
  })
  return {
    ...data,
    columnDefs: normalizeWidths(columnDefs),
    rowItems: items,
    rows: items.length,
  }
}

export function removeTableRow(data: TableBlockData, rowId: string): TableBlockData {
  const items = (data.rowItems || []).filter((r) => r.id !== rowId).map((r, i) => ({
    ...r,
    dataIndex: i,
    name: r.name || `Linha ${i + 1}`,
  }))
  return { ...data, rowItems: items, rows: Math.max(1, items.length) }
}

export function updateTableRow(
  data: TableBlockData,
  rowId: string,
  patch: Partial<TableRowItem>,
): TableBlockData {
  return {
    ...data,
    rowItems: (data.rowItems || []).map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
  }
}

/** Reordena linhas (itens) e renumera dataIndex. */
export function reorderTableRows(
  data: TableBlockData,
  fromIndex: number,
  toIndex: number,
): TableBlockData {
  const items = [...(data.rowItems || [])]
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return data
  if (fromIndex >= items.length || toIndex >= items.length) return data
  const [item] = items.splice(fromIndex, 1)
  if (!item) return data
  items.splice(toIndex, 0, item)
  const rowItems = items.map((r, i) => ({
    ...r,
    dataIndex: i,
    name: r.name || `Linha ${i + 1}`,
  }))
  return { ...data, rowItems, rows: rowItems.length }
}

export function addTableColumn(data: TableBlockData, field: TableColumnKey = 'nome'): TableBlockData {
  const cols = [...(data.columnDefs || defaultColumnDefs(data.columns))]
  cols.push({
    id: newLayerId(),
    field,
    label: fieldLabel(field),
    widthPct: 12,
    align: field === 'nome' ? 'left' : 'center',
  })
  return {
    ...data,
    columnDefs: normalizeWidths(cols),
    columns: cols.map((c) => (c.field === 'custom' ? 'nome' : c.field)) as TableColumnKey[],
  }
}

export function removeTableColumn(data: TableBlockData, colId: string): TableBlockData {
  const cols = (data.columnDefs || []).filter((c) => c.id !== colId)
  if (!cols.length) return data
  return {
    ...data,
    columnDefs: normalizeWidths(cols),
    columns: cols.map((c) => (c.field === 'custom' ? 'nome' : c.field)) as TableColumnKey[],
  }
}

export function updateTableColumn(
  data: TableBlockData,
  colId: string,
  patch: Partial<TableColumnDef>,
): TableBlockData {
  const cols = (data.columnDefs || []).map((c) => (c.id === colId ? { ...c, ...patch } : c))
  const normalized = patch.widthPct != null ? normalizeWidths(cols) : cols
  return {
    ...data,
    columnDefs: normalized,
    columns: normalized.map((c) => (c.field === 'custom' ? 'nome' : c.field)) as TableColumnKey[],
  }
}

export function gridTemplateFromColumns(cols: TableColumnDef[]): string {
  return cols.map((c) => `minmax(0, ${Math.max(1, c.widthPct)}fr)`).join(' ')
}

export function cellValue(
  field: string,
  row: {
    pos?: number | string
    nome?: string
    logo?: string | null
    booyah?: number | string
    abates?: number | string
    pts?: number | string
    delta?: number | string
    quedas?: number | string
    kd?: string
  },
): { kind: 'text' | 'image'; text?: string; src?: string } {
  if (field === 'pos') return { kind: 'text', text: String(row.pos ?? '').padStart(2, '0') }
  if (field === 'logo') return { kind: 'image', src: row.logo || undefined }
  if (field === 'nome') return { kind: 'text', text: String(row.nome ?? '—') }
  if (field === 'booyah') return { kind: 'text', text: String(row.booyah ?? 0) }
  if (field === 'abates') return { kind: 'text', text: String(row.abates ?? 0) }
  if (field === 'pts') return { kind: 'text', text: String(row.pts ?? 0) }
  if (field === 'delta') return { kind: 'text', text: String(row.delta ?? '0') }
  if (field === 'quedas') return { kind: 'text', text: String(row.quedas ?? 0) }
  if (field === 'kd') return { kind: 'text', text: String(row.kd ?? '0') }
  return { kind: 'text', text: '' }
}
