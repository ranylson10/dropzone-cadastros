import {
  getSheetDef,
  newLayerId,
  resolveSheetId,
  STREAM_SHEETS,
  type StreamSheetId,
  type StreamSheetRow,
  type StreamTableBlock,
  type TableBlockData,
  type TableColumnDef,
  type TableColumnKey,
  type TableRowItem,
} from '../types/stream.types'

const DEFAULT_FIELDS: string[] = ['pos', 'logo', 'nome', 'booyahs', 'abates', 'pontos', 'delta']

const FIELD_LABELS: Record<string, string> = {
  pos: '#',
  logo: 'Logo',
  nome: 'Nome',
  booyah: 'B!',
  booyahs: 'B!',
  abates: 'Abates',
  pts: 'Pts',
  pontos: 'Pts',
  delta: 'Δ',
  quedas: 'Quedas',
  kd: 'K.D',
  nick: 'Nick',
  foto: 'Foto',
  custom: 'Custom',
}

/** Aliases de campo legado → chaves da planilha / preview. */
const FIELD_ALIASES: Record<string, string[]> = {
  pts: ['pts', 'pontos'],
  pontos: ['pontos', 'pts'],
  booyah: ['booyah', 'booyahs'],
  booyahs: ['booyahs', 'booyah'],
  nome: ['nome', 'nick', 'line', 'eq_nome'],
  logo: ['logo', 'foto', 'eq_logo'],
  foto: ['foto', 'logo'],
  nick: ['nick', 'nome'],
  pos: ['pos', 'colocacao'],
  delta: ['delta'],
  abates: ['abates', 'eq_abates', 'pl_abates'],
  quedas: ['quedas'],
  kd: ['kd', 'pl_kd'],
}

const IMAGE_FIELDS = new Set([
  'logo',
  'foto',
  'imagem',
  'mapa_img',
  'booyah_logo',
  'eq_logo',
])

export function fieldLabel(field: string) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  const sheetCol = STREAM_SHEETS.flatMap((s) => s.columns).find((c) => c.key === field)
  if (sheetCol) return sheetCol.label
  return field.toUpperCase()
}

export function tableSourceId(source: string | undefined): StreamSheetId {
  const raw = (source || 'equipes_geral') as StreamSheetId
  return resolveSheetId(raw)
}

export function defaultColumnDefs(fields?: string[]): TableColumnDef[] {
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
      align: field === 'nome' || field === 'nick' ? 'left' : 'center',
      asImage: IMAGE_FIELDS.has(field),
    }
  })
}

/** Colunas sugeridas a partir da aba da planilha. */
export function columnDefsFromSheet(sheetId: StreamSheetId, maxCols = 7): TableColumnDef[] {
  const def = getSheetDef(sheetId)
  const preferred =
    sheetId === 'mvp'
      ? ['pos', 'logo', 'nick', 'quedas', 'kd', 'abates', 'delta']
      : sheetId.startsWith('equipes') || sheetId === 'classificacao'
        ? ['pos', 'logo', 'nome', 'booyahs', 'abates', 'pontos', 'delta']
        : def.columns.slice(0, maxCols).map((c) => c.key)
  const keys = preferred.filter((k) => def.columns.some((c) => c.key === k))
  const list = keys.length ? keys : def.columns.slice(0, maxCols).map((c) => c.key)
  return defaultColumnDefs(list).map((col) => {
    const sheetCol = def.columns.find((c) => c.key === col.field)
    return {
      ...col,
      label: sheetCol?.label || col.label,
      asImage: Boolean(sheetCol?.image || IMAGE_FIELDS.has(col.field)),
    }
  })
}

export function defaultRowItems(count: number, _startRank = 1): TableRowItem[] {
  const n = Math.max(1, Math.min(40, count || 1))
  return Array.from({ length: n }, (_, i) => ({
    id: newLayerId(),
    name: `Linha ${i + 1}`,
    dataIndex: i,
    height: 36,
  }))
}

export function createSeedRowItem(name = 'Linha 1'): TableRowItem {
  return {
    id: newLayerId(),
    name,
    dataIndex: 0,
    height: 36,
  }
}

/** Normaliza tabela legada → columnDefs + rowItems. */
export function ensureTableStructure(block: StreamTableBlock): StreamTableBlock {
  if (block.type !== 'table') return block
  const data = block.data || ({} as TableBlockData)
  const source = tableSourceId(data.source)
  const columnDefs =
    Array.isArray(data.columnDefs) && data.columnDefs.length
      ? normalizeWidths(data.columnDefs)
      : defaultColumnDefs((data.columns as string[]) || undefined)

  const rowItems =
    Array.isArray(data.rowItems) && data.rowItems.length
      ? data.rowItems
      : defaultRowItems(data.rows ?? 1, data.startRank || 1)

  return {
    ...block,
    tableW: block.tableW || 480,
    data: {
      ...data,
      source,
      variant: source === 'mvp' ? 'mvp_list' : data.variant || 'standings',
      columns: columnDefs.map((c) => c.field) as TableColumnKey[],
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
  let used = 0
  return cols.map((c, i) => {
    const isLast = i === cols.length - 1
    const w = isLast ? Math.max(1, 100 - used) : Math.max(1, Math.round(((Number(c.widthPct) || 1) / sum) * 100))
    if (!isLast) used += w
    return { ...c, widthPct: w }
  })
}

export function setTableSheetSource(data: TableBlockData, sheetId: StreamSheetId): TableBlockData {
  const source = resolveSheetId(sheetId)
  const nextCols = columnDefsFromSheet(source)
  return {
    ...data,
    source,
    variant: source === 'mvp' ? 'mvp_list' : 'standings',
    columnDefs: nextCols,
    columns: nextCols.map((c) => c.field) as TableColumnKey[],
  }
}

export function addTableRow(data: TableBlockData): TableBlockData {
  const columnDefs =
    Array.isArray(data.columnDefs) && data.columnDefs.length
      ? data.columnDefs
      : defaultColumnDefs((data.columns as string[]) || undefined)
  const items = [
    ...((Array.isArray(data.rowItems) && data.rowItems.length
      ? data.rowItems
      : defaultRowItems(data.rows ?? 1)) as TableRowItem[]),
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

export function addTableColumn(data: TableBlockData, field: string = 'nome'): TableBlockData {
  const cols = [...(data.columnDefs || defaultColumnDefs((data.columns as string[]) || undefined))]
  const def = getSheetDef(tableSourceId(data.source))
  const sheetCol = def.columns.find((c) => c.key === field)
  cols.push({
    id: newLayerId(),
    field,
    label: sheetCol?.label || fieldLabel(field),
    widthPct: 12,
    align: field === 'nome' || field === 'nick' ? 'left' : 'center',
    asImage: Boolean(sheetCol?.image || IMAGE_FIELDS.has(field)),
  })
  return {
    ...data,
    columnDefs: normalizeWidths(cols),
    columns: cols.map((c) => c.field) as TableColumnKey[],
  }
}

export function removeTableColumn(data: TableBlockData, colId: string): TableBlockData {
  const cols = (data.columnDefs || []).filter((c) => c.id !== colId)
  if (!cols.length) return data
  return {
    ...data,
    columnDefs: normalizeWidths(cols),
    columns: cols.map((c) => c.field) as TableColumnKey[],
  }
}

export function updateTableColumn(
  data: TableBlockData,
  colId: string,
  patch: Partial<TableColumnDef>,
): TableBlockData {
  const cols = (data.columnDefs || []).map((c) => {
    if (c.id !== colId) return c
    const next = { ...c, ...patch }
    if (patch.field != null) {
      const def = getSheetDef(tableSourceId(data.source))
      const sheetCol = def.columns.find((sc) => sc.key === patch.field)
      if (sheetCol && patch.label == null) next.label = sheetCol.label
      if (sheetCol && patch.asImage == null) next.asImage = Boolean(sheetCol.image)
    }
    return next
  })
  const normalized = patch.widthPct != null ? normalizeWidths(cols) : cols
  return {
    ...data,
    columnDefs: normalized,
    columns: normalized.map((c) => c.field) as TableColumnKey[],
  }
}

export function gridTemplateFromColumns(cols: TableColumnDef[]): string {
  return cols.map((c) => `minmax(0, ${Math.max(1, c.widthPct)}fr)`).join(' ')
}

export type TableDataRow = Record<string, string | number | null | undefined>

function pickField(field: string, row: TableDataRow): string {
  const keys = FIELD_ALIASES[field] || [field]
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v) !== '') return String(v)
  }
  const direct = row[field]
  if (direct != null) return String(direct)
  return ''
}

export function cellValue(
  field: string,
  row: TableDataRow,
  opts?: { asImage?: boolean },
): { kind: 'text' | 'image'; text?: string; src?: string } {
  const asImage = opts?.asImage || IMAGE_FIELDS.has(field)
  const raw = pickField(field, row)

  if (asImage) {
    return { kind: 'image', src: raw || undefined }
  }
  if (field === 'pos') {
    const n = raw || String(row.pos ?? '')
    return { kind: 'text', text: String(n).padStart(2, '0') }
  }
  if (field === 'delta') {
    return { kind: 'text', text: raw || '0' }
  }
  return { kind: 'text', text: raw || (field === 'nome' || field === 'nick' ? '—' : '0') }
}

/** Linhas da planilha selecionada → objetos de célula para o canvas. */
export function sheetRowsToDataRows(rows: StreamSheetRow[] | undefined): TableDataRow[] {
  if (!rows?.length) return []
  return rows.map((r) => ({ ...r.cells }))
}

export function standingToDataRow(s: {
  pos?: number | string
  nome?: string
  logo?: string | null
  booyah?: number | string
  abates?: number | string
  pts?: number | string
  delta?: number | string
  quedas?: number | string
  kd?: string
}): TableDataRow {
  return {
    pos: s.pos,
    nome: s.nome,
    logo: s.logo,
    booyah: s.booyah,
    booyahs: s.booyah,
    abates: s.abates,
    pts: s.pts,
    pontos: s.pts,
    delta: s.delta,
    quedas: s.quedas,
    kd: s.kd,
  }
}
