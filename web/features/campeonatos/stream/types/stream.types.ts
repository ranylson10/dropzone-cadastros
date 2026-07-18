/**
 * Stream / Character Generator — tipos de overlay, blocos e estilos.
 */

/**
 * Abas da planilha Stream (fontes para overlays).
 * IDs legados (classificacao, equipes, …) permanecem como alias em loadStreamSheet.
 */
export type StreamSheetId =
  | 'equipes_geral'
  | 'equipes_mapa'
  | 'equipes_jogo'
  | 'equipes_fase'
  | 'equipes_grupo'
  | 'equipes_partida'
  | 'mvp'
  | 'mapas'
  | 'partida_atual'
  | 'proxima_queda'
  // legado / extras
  | 'equipes'
  | 'jogadores'
  | 'classificacao'
  | 'jogos'
  | 'quedas'
  | 'sumula'

export type StreamSheetFilterKind = 'none' | 'mapa' | 'jogo' | 'fase' | 'grupo' | 'partida'

export type StreamSheetColumn = {
  key: string
  label: string
  letter: string
  /** se true, valor é URL de imagem (preview na planilha) */
  image?: boolean
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
  /** filtro secundário da aba */
  filter?: StreamSheetFilterKind
  group?: 'equipes' | 'mvp' | 'mapas' | 'partida' | 'legado'
}

export type StreamSheetFilters = {
  mapa_codigo?: string
  jogo_id?: string
  fase_id?: string
  grupo_id?: string
  partida_id?: string
}

export type StreamInnerPanel = 'overlays' | 'planilha'

/** Modelos de overlay (wizard). */
export type StreamTemplateId = 'map_cards' | 'standings' | 'mvp_combo' | 'custom'

export type FillMode = 'solid' | 'gradient' | 'image' | 'none'

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

/** Coluna da tabela (parte da linha) — largura em % da tabela. */
export type TableColumnDef = {
  id: string
  /**
   * Vínculo com a planilha: chave da coluna (ex: pos, nome, pontos, abates).
   * Aceita também chaves legadas (pts, booyah) — resolvidas no render.
   */
  field: string
  label: string
  /** 0–100, relativo à largura da tabela */
  widthPct: number
  align?: 'left' | 'center' | 'right'
  /** força render como imagem (logo/foto/…) */
  asImage?: boolean
}

/**
 * Item = linha da tabela (como camada do card).
 * dataIndex 0 = startRank na fonte de dados.
 */
export type TableRowItem = {
  id: string
  name: string
  dataIndex: number
  height?: number
  /** cor de fundo desta linha (sobrescreve rowStyle/alt) */
  fill?: string
  textColor?: string
}

export type TableBlockData = {
  variant: 'standings' | 'mvp_list'
  /**
   * Planilha / aba de dados (STREAM_SHEETS).
   * Legado: classificacao | equipes → equipes_geral.
   */
  source: StreamSheetId
  /** legado: qtd de linhas se rowItems vazio */
  rows: number
  startRank: number
  /** legado: lista simples de campos; preferir columnDefs */
  columns: TableColumnKey[] | string[]
  /** colunas com largura / rótulo / vínculo */
  columnDefs?: TableColumnDef[]
  /** linhas como itens editáveis */
  rowItems?: TableRowItem[]
  showHeader?: boolean
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

/** Defaults de design do frame (produto final). Usuário pode mudar por overlay. */
export const FRAME_W = 1920
export const FRAME_H = 1080

export const FRAME_PRESETS = [
  { id: '1080p', label: '1920×1080 · 16:9', w: 1920, h: 1080 },
  { id: '720p', label: '1280×720 · 16:9', w: 1280, h: 720 },
  { id: 'vertical', label: '1080×1920 · 9:16', w: 1080, h: 1920 },
  { id: 'square', label: '1080×1080 · 1:1', w: 1080, h: 1080 },
  { id: 'ultrawide', label: '2560×1080 · UW', w: 2560, h: 1080 },
  { id: '4k', label: '3840×2160 · 4K', w: 3840, h: 2160 },
] as const

export type StreamBlock = StreamCardBlock | StreamTableBlock

export function newLayerId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Licença da overlay no campeonato / modelo no catálogo. */
export type StreamLicenseKind = 'own' | 'public_clone' | 'purchased'

export type StreamCatalogVisibility = 'private' | 'public' | 'for_sale'

export type StreamOverlay = {
  id: string
  name: string
  template: StreamTemplateId
  blocks: StreamBlock[]
  updatedAt: string
  /** Largura do produto final em px (área de trabalho). */
  frameW?: number
  /** Altura do produto final em px. */
  frameH?: number
  /** Token público Browser Source (/stream/live/[token]) */
  share_token?: string
  campeonato_id?: string
  /** Modelo de origem no catálogo (se veio de modelo). */
  catalog_source_id?: string
  /** own | public_clone | purchased — purchased não republica/revende */
  license_kind?: StreamLicenseKind
  /** legado — migrado para blocks */
  kind?: string
  fields?: Array<{ key: string; label: string; cellRef: string }>
}

/** Modelo no catálogo (biblioteca do usuário / público / venda). */
export type StreamCatalogModel = {
  id: string
  owner_user_id: string
  name: string
  description: string
  blocks: StreamBlock[]
  frameW: number
  frameH: number
  visibility: StreamCatalogVisibility
  is_purchased_copy: boolean
  source_catalog_id?: string | null
  price_label?: string | null
  preview_note?: string | null
  updatedAt: string
  createdAt?: string
  /** se o usuário logado tem direito de usar (compra/próprio) */
  entitled?: boolean
  entitlement_source?: StreamLicenseKind | 'public_clone' | null
  block_count?: number
  is_mine?: boolean
}

export type StreamPurchaseCode = {
  id: string
  catalog_id: string
  code: string
  max_redemptions: number
  redemption_count: number
  ativo: boolean
  createdAt: string
}

export function getOverlayFrame(overlay: Pick<StreamOverlay, 'frameW' | 'frameH'> | null | undefined) {
  return {
    w: Math.max(64, Number(overlay?.frameW) || FRAME_W),
    h: Math.max(64, Number(overlay?.frameH) || FRAME_H),
  }
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

const COLS_EQUIPE = [
  { key: 'pos', label: 'Pos', letter: 'A' },
  { key: 'delta', label: 'Δ', letter: 'B' },
  { key: 'logo', label: 'Logo', letter: 'C', image: true },
  { key: 'nome', label: 'Nome', letter: 'D' },
  { key: 'grupo', label: 'Grupo', letter: 'E' },
  { key: 'quedas', label: 'Quedas', letter: 'F' },
  { key: 'booyahs', label: 'Booyahs', letter: 'G' },
  { key: 'abates', label: 'Abates', letter: 'H' },
  { key: 'pontos', label: 'Pontos', letter: 'I' },
] as StreamSheetColumn[]

const COLS_EQUIPE_PARTIDA: StreamSheetColumn[] = [
  ...COLS_EQUIPE,
  { key: 'pos_morte', label: 'Pos. morte', letter: 'J' },
]

/** Abas principais da planilha (UI). */
export const STREAM_SHEETS: StreamSheetDefinition[] = [
  {
    id: 'equipes_geral',
    title: 'Equipes · Geral',
    refName: 'EquipesGeral',
    live: true,
    group: 'equipes',
    filter: 'none',
    columns: COLS_EQUIPE,
  },
  {
    id: 'equipes_mapa',
    title: 'Equipes · Mapa',
    refName: 'EquipesMapa',
    live: true,
    group: 'equipes',
    filter: 'mapa',
    columns: COLS_EQUIPE,
  },
  {
    id: 'equipes_jogo',
    title: 'Equipes · Jogo',
    refName: 'EquipesJogo',
    live: true,
    group: 'equipes',
    filter: 'jogo',
    columns: COLS_EQUIPE,
  },
  {
    id: 'equipes_fase',
    title: 'Equipes · Fase',
    refName: 'EquipesFase',
    live: true,
    group: 'equipes',
    filter: 'fase',
    columns: COLS_EQUIPE,
  },
  {
    id: 'equipes_grupo',
    title: 'Equipes · Grupo',
    refName: 'EquipesGrupo',
    live: true,
    group: 'equipes',
    filter: 'grupo',
    columns: COLS_EQUIPE,
  },
  {
    id: 'equipes_partida',
    title: 'Equipes · Partida',
    refName: 'EquipesPartida',
    live: true,
    group: 'equipes',
    filter: 'partida',
    columns: COLS_EQUIPE_PARTIDA,
  },
  {
    id: 'mvp',
    title: 'MVP',
    refName: 'MVP',
    live: true,
    group: 'mvp',
    filter: 'none',
    columns: [
      { key: 'pos', label: 'Pos', letter: 'A' },
      { key: 'delta', label: 'Δ', letter: 'B' },
      { key: 'foto', label: 'Foto', letter: 'C', image: true },
      { key: 'logo', label: 'Logo equipe', letter: 'D', image: true },
      { key: 'tag', label: 'Tag', letter: 'E' },
      { key: 'nick', label: 'Nick', letter: 'F' },
      { key: 'funcao', label: 'Função', letter: 'G' },
      { key: 'cidade', label: 'Cidade', letter: 'H' },
      { key: 'grupo', label: 'Grupo', letter: 'I' },
      { key: 'quedas', label: 'Quedas', letter: 'J' },
      { key: 'kd', label: 'K.D', letter: 'K' },
      { key: 'abates', label: 'Abates', letter: 'L' },
    ],
  },
  {
    id: 'mapas',
    title: 'Mapas',
    refName: 'Mapas',
    live: true,
    group: 'mapas',
    filter: 'none',
    columns: [
      { key: 'imagem', label: 'Imagem', letter: 'A', image: true },
      { key: 'nome', label: 'Mapa', letter: 'B' },
      { key: 'booyah_logo', label: 'Logo B!', letter: 'C', image: true },
      { key: 'booyah_nome', label: 'Equipe B!', letter: 'D' },
      { key: 'pontos', label: 'Pts B!', letter: 'E' },
      { key: 'abates', label: 'Abates B!', letter: 'F' },
      { key: 'jogo', label: 'Jogo', letter: 'G' },
      { key: 'queda', label: 'Queda', letter: 'H' },
    ],
  },
  {
    id: 'partida_atual',
    title: 'Partida atual',
    refName: 'PartidaAtual',
    live: true,
    group: 'partida',
    filter: 'none',
    columns: [
      { key: 'mapa_nome', label: 'Mapa', letter: 'A' },
      { key: 'mapa_img', label: 'Imagem', letter: 'B', image: true },
      { key: 'queda_atual', label: 'Queda atual', letter: 'C' },
      { key: 'quedas_totais', label: 'Quedas totais', letter: 'D' },
      { key: 'jogo', label: 'Jogo', letter: 'E' },
      { key: 'status', label: 'Status', letter: 'F' },
    ],
  },
  {
    id: 'proxima_queda',
    title: 'Próxima queda',
    refName: 'ProximaQueda',
    live: true,
    group: 'partida',
    filter: 'none',
    columns: [
      { key: 'mapa_nome', label: 'Próx. mapa', letter: 'A' },
      { key: 'mapa_img', label: 'Imagem', letter: 'B', image: true },
      { key: 'queda_numero', label: 'Nº queda', letter: 'C' },
      { key: 'jogo', label: 'Jogo', letter: 'D' },
      { key: 'eq_nome', label: 'Equipe (stats mapa)', letter: 'E' },
      { key: 'eq_logo', label: 'Logo', letter: 'F', image: true },
      { key: 'eq_pts', label: 'Pts no mapa', letter: 'G' },
      { key: 'eq_abates', label: 'Abates no mapa', letter: 'H' },
      { key: 'eq_booyahs', label: 'B! no mapa', letter: 'I' },
      { key: 'pl_nick', label: 'Jogador (stats)', letter: 'J' },
      { key: 'pl_abates', label: 'Abates jog.', letter: 'K' },
      { key: 'pl_kd', label: 'K.D jog.', letter: 'L' },
    ],
  },
]

/** Alias legados → aba atual (bindings de overlays antigas). */
export const STREAM_SHEET_ALIASES: Partial<Record<StreamSheetId, StreamSheetId>> = {
  classificacao: 'equipes_geral',
  sumula: 'equipes_partida',
  quedas: 'mapas',
  equipes: 'equipes_geral',
}

export function resolveSheetId(id: StreamSheetId): StreamSheetId {
  return STREAM_SHEET_ALIASES[id] || id
}

export function getSheetDef(id: StreamSheetId): StreamSheetDefinition {
  const resolved = resolveSheetId(id)
  return STREAM_SHEETS.find((s) => s.id === resolved) || STREAM_SHEETS[0]
}

export function colLetterToIndex(letter: string) {
  return letter.toUpperCase().charCodeAt(0) - 65
}

export function newBlockId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
