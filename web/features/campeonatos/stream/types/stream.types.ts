/**
 * Stream / Character Generator — tipos de overlay, blocos e estilos.
 */

export type StreamSheetId = 'equipes' | 'jogadores' | 'classificacao' | 'mvp' | 'jogos' | 'quedas' | 'sumula'

export type StreamSheetColumn = {
  key: string
  label: string
  letter: string
}

export type StreamSheetRow = {
  id: string
  cells: Record<string, string>
}

export type StreamSheetDefinition = {
  id: StreamSheetId
  title: string
  refName: string
  columns: StreamSheetColumn[]
  live: boolean
}

export type StreamInnerPanel = 'overlays' | 'planilha'

/** Modelos de overlay (wizard). */
export type StreamTemplateId = 'map_cards' | 'standings' | 'mvp_combo' | 'custom'

export type FillMode = 'solid' | 'gradient' | 'image'

export type FillStyle = {
  mode: FillMode
  color?: string
  colorTo?: string
  angle?: number
  imageUrl?: string
  fit?: 'cover' | 'contain'
  overlayColor?: string
  overlayOpacity?: number
  opacity?: number
}

export type TextStyle = {
  fontFamily: string
  fontWeight: number
  fontSize: number
  color: string
  align?: 'left' | 'center' | 'right'
  uppercase?: boolean
  letterSpacing?: number
  textShadow?: string
}

export type BoxStyle = {
  fill?: FillStyle
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  skewX?: number
  skewY?: number
  rotate?: number
  opacity?: number
  padding?: number
}

export type FieldStyle = {
  text?: TextStyle
  box?: BoxStyle
}

export type EnterTransition = 'none' | 'fade' | 'slide-up' | 'slide-left' | 'scale' | 'stagger'
export type DataTransition = 'none' | 'fade' | 'tick' | 'pulse' | 'rank-move'

export type TransitionStyle = {
  enter: EnterTransition
  onDataChange: DataTransition
  durationMs: number
  delayMs: number
}

export type MetricKey = 'pts' | 'abates' | 'booyah' | 'kd' | 'quedas'
export type TableColumnKey = 'pos' | 'logo' | 'nome' | 'booyah' | 'abates' | 'pts' | 'delta' | 'quedas' | 'kd'

export type CardFieldKey = 'title' | 'subtitle' | 'metric_primary' | 'metric_secondary' | 'metric_tertiary'

/** @deprecated legado — migrado para layers */
export type CardBlockData = {
  variant: 'map_result' | 'mvp_hero' | 'team'
  mapSlot?: number
  rank?: number
  titleFixed?: string
  metrics: MetricKey[]
  fieldStyles: Partial<Record<CardFieldKey, FieldStyle>>
}

/** Tipo visual do item dentro da pasta Card (GT Title light). */
export type LayerContentType = 'image' | 'logo' | 'text' | 'number'

/**
 * De onde vem o valor do item.
 * Usuário escolhe em português no painel; sem digitar célula no fluxo normal.
 */
export type LayerDataSource =
  | { source: 'fixed'; value: string }
  | { source: 'map_image'; mapSlot: number }
  | { source: 'map_name'; mapSlot: number }
  | { source: 'map_logo'; mapSlot: number }
  | { source: 'map_pts'; mapSlot: number }
  | { source: 'map_abates'; mapSlot: number }
  | { source: 'standing'; rank: number; field: 'nome' | 'logo' | 'pts' | 'abates' | 'booyah' | 'delta' }
  | { source: 'mvp'; rank: number; field: 'nome' | 'logo' | 'abates' | 'kd' | 'quedas' }
  /** Vínculo direto a uma célula da planilha Stream (linha 0 = header, dados começam em 1). */
  | { source: 'cell'; sheetId: StreamSheetId; colKey: string; rowIndex: number; display?: string }

/** Item/camada dentro da pasta Card — posição em % do card (0–100). */
export type StreamLayer = {
  id: string
  name: string
  type: LayerContentType
  x: number
  y: number
  w: number
  h: number
  z: number
  data: LayerDataSource
  style?: FieldStyle
  objectFit?: 'cover' | 'contain'
}

export type TableBlockData = {
  variant: 'standings' | 'mvp_list'
  source: 'classificacao' | 'mvp' | 'equipes'
  rows: number
  startRank: number
  columns: TableColumnKey[]
  headerStyle?: FieldStyle
  rowStyle?: FieldStyle
  altRowFill?: string
  highlightFirst?: boolean
  /** Ferramentas específicas de tabela */
  rowHeight?: number
  rowGap?: number
  headerHeight?: number
}

export type StreamBlockBase = {
  id: string
  name: string
  /**
   * Posição no frame 16:9 (px na base 1280×720).
   * Arrastar no canvas ou digitar X/Y no painel.
   */
  x?: number
  y?: number
  box: BoxStyle
  transition: TransitionStyle
}

/**
 * Bloco retangular (pasta): quadrado vazio que o usuário nomeia,
 * posiciona, dimensiona, define fundo e preenche com itens/camadas.
 * canvasW/H = largura/altura em px no frame.
 */
export type StreamCardBlock = StreamBlockBase & {
  type: 'card'
  canvasW: number
  canvasH: number
  layers: StreamLayer[]
  /** legado opcional */
  data?: CardBlockData
}

/** Pasta Tabela: grupo com colunas + fonte de dados. */
export type StreamTableBlock = StreamBlockBase & {
  type: 'table'
  /** Largura no frame (px). Altura é dinâmica pelo conteúdo se omitida. */
  tableW?: number
  data: TableBlockData
}

/** Base de design do frame (proporção do produto final). */
export const FRAME_W = 1280
export const FRAME_H = 720

export type StreamBlock = StreamCardBlock | StreamTableBlock

export function newLayerId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export type StreamOverlay = {
  id: string
  name: string
  template: StreamTemplateId
  blocks: StreamBlock[]
  updatedAt: string
  /** Token público Browser Source (/stream/live/[token]) */
  share_token?: string
  campeonato_id?: string
  /** legado — migrado para blocks */
  kind?: string
  fields?: Array<{ key: string; label: string; cellRef: string }>
}

export const STREAM_FONTS = [
  'Rajdhani',
  'Segoe UI',
  'Arial Black',
  'Impact',
  'Inter',
  'Roboto',
  'Oswald',
] as const

export const DEFAULT_TEXT: TextStyle = {
  fontFamily: 'Rajdhani',
  fontWeight: 800,
  fontSize: 18,
  color: '#ffffff',
  align: 'center',
  uppercase: true,
  letterSpacing: 0.04,
}

export const DEFAULT_BOX: BoxStyle = {
  fill: { mode: 'solid', color: '#1a1d24', opacity: 1 },
  borderColor: '#c9a227',
  borderWidth: 2,
  borderRadius: 8,
  skewX: 0,
  skewY: 0,
  rotate: 0,
  opacity: 1,
  padding: 10,
}

export const DEFAULT_TRANSITION: TransitionStyle = {
  enter: 'fade',
  onDataChange: 'pulse',
  durationMs: 400,
  delayMs: 0,
}

export const STREAM_SHEETS: StreamSheetDefinition[] = [
  {
    id: 'equipes',
    title: 'Equipes',
    refName: 'Equipes',
    live: true,
    columns: [
      { key: 'slot', label: 'Slot', letter: 'A' },
      { key: 'line', label: 'Line', letter: 'B' },
      { key: 'tag', label: 'Tag', letter: 'C' },
      { key: 'grupo', label: 'Grupo', letter: 'D' },
      { key: 'status', label: 'Status', letter: 'E' },
      { key: 'origem', label: 'Origem', letter: 'F' },
    ],
  },
  {
    id: 'jogadores',
    title: 'Jogadores',
    refName: 'Jogadores',
    live: true,
    columns: [
      { key: 'nick', label: 'Nick', letter: 'A' },
      { key: 'id_jogo', label: 'ID jogo', letter: 'B' },
      { key: 'line', label: 'Line', letter: 'C' },
      { key: 'funcao', label: 'Função', letter: 'D' },
      { key: 'slot', label: 'Slot', letter: 'E' },
      { key: 'status', label: 'Status', letter: 'F' },
    ],
  },
  {
    id: 'classificacao',
    title: 'Classificação',
    refName: 'Classificacao',
    live: true,
    columns: [
      { key: 'colocacao', label: 'Pos', letter: 'A' },
      { key: 'line', label: 'Line', letter: 'B' },
      { key: 'tag', label: 'Tag', letter: 'C' },
      { key: 'booyahs', label: 'Booyah', letter: 'D' },
      { key: 'abates', label: 'Kills', letter: 'E' },
      { key: 'pontos', label: 'Pontos', letter: 'F' },
    ],
  },
  {
    id: 'mvp',
    title: 'MVP',
    refName: 'MVP',
    live: true,
    columns: [
      { key: 'colocacao', label: 'Pos', letter: 'A' },
      { key: 'nick', label: 'Nick', letter: 'B' },
      { key: 'abates', label: 'Kills', letter: 'C' },
      { key: 'quedas', label: 'Quedas', letter: 'D' },
      { key: 'kd', label: 'K.D', letter: 'E' },
      { key: 'dano', label: 'Dano', letter: 'F' },
    ],
  },
  {
    id: 'jogos',
    title: 'Jogos',
    refName: 'Jogos',
    live: true,
    columns: [
      { key: 'nome', label: 'Jogo', letter: 'A' },
      { key: 'data', label: 'Data', letter: 'B' },
      { key: 'horario', label: 'Hora', letter: 'C' },
      { key: 'status', label: 'Status', letter: 'D' },
      { key: 'quedas', label: 'Quedas', letter: 'E' },
      { key: 'mapas', label: 'Mapas', letter: 'F' },
    ],
  },
  {
    id: 'quedas',
    title: 'Quedas',
    refName: 'Quedas',
    live: true,
    columns: [
      { key: 'jogo', label: 'Jogo', letter: 'A' },
      { key: 'numero', label: 'Nº', letter: 'B' },
      { key: 'mapa', label: 'Mapa', letter: 'C' },
      { key: 'status', label: 'Status', letter: 'D' },
      { key: 'horario', label: 'Hora', letter: 'E' },
      { key: 'id', label: 'ID', letter: 'F' },
    ],
  },
  {
    id: 'sumula',
    title: 'Súmula',
    refName: 'Sumula',
    live: true,
    columns: [
      { key: 'mapa', label: 'Mapa', letter: 'A' },
      { key: 'pos', label: 'Pos', letter: 'B' },
      { key: 'line', label: 'Line', letter: 'C' },
      { key: 'abates', label: 'Kills', letter: 'D' },
      { key: 'pontos', label: 'Pontos', letter: 'E' },
      { key: 'booyah', label: 'B!', letter: 'F' },
    ],
  },
]

export function colLetterToIndex(letter: string) {
  return letter.toUpperCase().charCodeAt(0) - 65
}

export function newBlockId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
