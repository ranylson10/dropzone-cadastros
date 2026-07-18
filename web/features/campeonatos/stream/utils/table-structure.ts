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

const DEFAULT_TABLE_W = 520

/** Larguras padrão em px por campo (resto divide). */
function defaultWidthPx(field: string, count: number, tableW = DEFAULT_TABLE_W): number {
  const presets: Record<string, number> = {
    pos: 48,
    logo: 44,
    foto: 44,
    delta: 56,
    booyah: 48,
    booyahs: 48,
    abates: 64,
    pts: 64,
    pontos: 64,
    quedas: 56,
    kd: 48,
  }
  if (presets[field]) return presets[field]
  if (field === 'nome' || field === 'nick') return Math.max(120, Math.round(tableW * 0.28))
  return Math.max(48, Math.floor(tableW / Math.max(1, count)))
}

export function defaultColumnDefs(fields?: string[], tableW = DEFAULT_TABLE_W): TableColumnDef[] {
  const list = fields?.length ? fields : DEFAULT_FIELDS
  return list.map((field) => ({
    id: newLayerId(),
    field,
    label: fieldLabel(field),
    widthPx: defaultWidthPx(field, list.length, tableW),
    align: field === 'nome' || field === 'nick' ? 'left' : 'center',
    asImage: IMAGE_FIELDS.has(field),
  }))
}

/** Colunas sugeridas a partir da aba da planilha. */
export function columnDefsFromSheet(
  sheetId: StreamSheetId,
  maxCols = 7,
  tableW = DEFAULT_TABLE_W,
): TableColumnDef[] {
  const def = getSheetDef(sheetId)
  const preferred =
    sheetId === 'mvp'
      ? ['pos', 'logo', 'nick', 'quedas', 'kd', 'abates', 'delta']
      : sheetId.startsWith('equipes') || sheetId === 'classificacao'
        ? ['pos', 'logo', 'nome', 'booyahs', 'abates', 'pontos', 'delta']
        : def.columns.slice(0, maxCols).map((c) => c.key)
  const keys = preferred.filter((k) => def.columns.some((c) => c.key === k))
  const list = keys.length ? keys : def.columns.slice(0, maxCols).map((c) => c.key)
  return defaultColumnDefs(list, tableW).map((col) => {
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

/** Normaliza tabela legada → columnDefs + rowItems (larguras em px). */
export function ensureTableStructure(block: StreamTableBlock): StreamTableBlock {
  if (block.type !== 'table') return block
  const data = block.data || ({} as TableBlockData)
  const source = tableSourceId(data.source)
  const tableW = Math.max(64, Number(block.tableW) || DEFAULT_TABLE_W)
  const columnDefs =
    Array.isArray(data.columnDefs) && data.columnDefs.length
      ? normalizeColumnWidths(data.columnDefs, tableW)
      : defaultColumnDefs((data.columns as string[]) || undefined, tableW)

  const rowItems =
    Array.isArray(data.rowItems) && data.rowItems.length
      ? data.rowItems
      : defaultRowItems(data.rows ?? 1, data.startRank || 1)

  return {
    ...block,
    tableW,
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

/** Garante widthPx em cada coluna; migra widthPct legado. */
export function normalizeColumnWidths(cols: TableColumnDef[], tableW = DEFAULT_TABLE_W): TableColumnDef[] {
  if (!cols.length) return defaultColumnDefs(undefined, tableW)
  const tw = Math.max(64, tableW)
  return cols.map((c, i) => {
    let widthPx = Number(c.widthPx)
    if (!Number.isFinite(widthPx) || widthPx <= 0) {
      const pct = Number(c.widthPct)
      if (Number.isFinite(pct) && pct > 0) {
        widthPx = Math.max(1, Math.round((pct / 100) * tw))
      } else {
        widthPx = defaultWidthPx(c.field || 'nome', cols.length, tw)
      }
    }
    return {
      ...c,
      widthPx: Math.max(1, Math.round(widthPx)),
      // limpa % legado depois de migrar
      widthPct: undefined,
    }
  })
}

/** @deprecated use normalizeColumnWidths */
export function normalizeWidths(cols: TableColumnDef[], tableW = DEFAULT_TABLE_W): TableColumnDef[] {
  return normalizeColumnWidths(cols, tableW)
}

export function setTableSheetSource(
  data: TableBlockData,
  sheetId: StreamSheetId,
  tableW = DEFAULT_TABLE_W,
): TableBlockData {
  const source = resolveSheetId(sheetId)
  const nextCols = columnDefsFromSheet(source, 7, tableW)
  return {
    ...data,
    source,
    variant: source === 'mvp' ? 'mvp_list' : 'standings',
    columnDefs: nextCols,
    columns: nextCols.map((c) => c.field) as TableColumnKey[],
  }
}

export function addTableRow(data: TableBlockData, tableW = DEFAULT_TABLE_W): TableBlockData {
  const columnDefs =
    Array.isArray(data.columnDefs) && data.columnDefs.length
      ? data.columnDefs
      : defaultColumnDefs((data.columns as string[]) || undefined, tableW)
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
    columnDefs: normalizeColumnWidths(columnDefs, tableW),
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

export function addTableColumn(
  data: TableBlockData,
  field: string = '',
  tableW = DEFAULT_TABLE_W,
): TableBlockData {
  const cols = [
    ...(data.columnDefs || defaultColumnDefs((data.columns as string[]) || undefined, tableW)),
  ]
  const def = getSheetDef(tableSourceId(data.source))
  const sheetCol = field ? def.columns.find((c) => c.key === field) : undefined
  cols.push({
    id: newLayerId(),
    field: field || '',
    label: sheetCol?.label || (field ? fieldLabel(field) : `Coluna ${cols.length + 1}`),
    widthPx: field ? defaultWidthPx(field, cols.length + 1, tableW) : 120,
    align: field === 'nome' || field === 'nick' ? 'left' : 'center',
    asImage: Boolean(sheetCol?.image || (field && IMAGE_FIELDS.has(field))),
  })
  return {
    ...data,
    columnDefs: normalizeColumnWidths(cols, tableW),
    columns: cols.map((c) => c.field).filter(Boolean) as TableColumnKey[],
  }
}

export function removeTableColumn(data: TableBlockData, colId: string, tableW = DEFAULT_TABLE_W): TableBlockData {
  const cols = (data.columnDefs || []).filter((c) => c.id !== colId)
  if (!cols.length) return data
  return {
    ...data,
    columnDefs: normalizeColumnWidths(cols, tableW),
    columns: cols.map((c) => c.field) as TableColumnKey[],
  }
}

export function updateTableColumn(
  data: TableBlockData,
  colId: string,
  patch: Partial<TableColumnDef>,
  tableW = DEFAULT_TABLE_W,
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
    if (patch.widthPx != null) next.widthPx = Math.max(1, Math.round(Number(patch.widthPx) || 1))
    return next
  })
  return {
    ...data,
    columnDefs: normalizeColumnWidths(cols, tableW),
    columns: cols.map((c) => c.field) as TableColumnKey[],
  }
}

/** Grid CSS com larguras fixas em px. */
export function gridTemplateFromColumns(cols: TableColumnDef[]): string {
  return cols.map((c) => `${Math.max(1, Number(c.widthPx) || 48)}px`).join(' ')
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
