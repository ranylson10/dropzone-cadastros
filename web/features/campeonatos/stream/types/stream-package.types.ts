export const STREAM_SYSTEM_OVERLAYS = [
  'standings_general',
  'round_teams',
  'round_players',
  'mvp_general',
  'mvp_day',
  'mvp_round',
  'booyahs_day',
  'qualified_teams',
  'next_round',
  'champion',
] as const

export type StreamSystemOverlayType = (typeof STREAM_SYSTEM_OVERLAYS)[number]


export const STREAM_OVERLAY_COLUMN_META: Record<string, { label: string; kind: 'text' | 'number' | 'image' }> = {
  rank: { label: 'RK', kind: 'number' },
  logo: { label: 'Logo', kind: 'image' },
  name: { label: 'Equipe', kind: 'text' },
  nick: { label: 'Jogador', kind: 'text' },
  group: { label: 'Grupo', kind: 'text' },
  drops: { label: 'QD', kind: 'number' },
  booyah: { label: 'B!', kind: 'number' },
  position: { label: 'POS', kind: 'number' },
  kills: { label: 'ABT', kind: 'number' },
  points: { label: 'PTS', kind: 'number' },
  kd: { label: 'K/D', kind: 'number' },
  map: { label: 'Mapa', kind: 'image' },
  category: { label: 'Categoria', kind: 'text' },
  round: { label: 'Queda', kind: 'text' },
}

export type StreamPackageAssetKey =
  | 'event_logo'
  | 'table_row_bg'
  | 'table_rank_bg'
  | 'table_logo_bg'
  | 'table_name_bg'
  | 'table_stat_bg'
  | 'table_points_bg'
  | 'card_bg'
  | 'card_stats_bg'
  | 'top_art'

export type StreamLooseImageConfig = {
  assetKey: StreamPackageAssetKey | null
  show: boolean
  x: number
  y: number
  width: number
  height: number
  fit: 'contain' | 'cover'
}

export type StreamLooseTextConfig = {
  show: boolean
  x: number
  y: number
  width: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  align: 'left' | 'center' | 'right'
}

export type StreamSharedLayoutConfig = {
  offsetX: number
  offsetY: number
  widthScale: number
  heightScale: number
}

export type StreamSharedTableConfig = {
  mode: 'single' | 'double'
  rowHeight: number
  rowGap: number
  cellGap: number
  panelGap: number
  showHeaders: boolean
  headerHeight: number
  logoWidth: number
  statWidth: number
  pointsWidth: number
  nameAlign: 'left' | 'center' | 'right'
}

export type StreamSharedCardConfig = {
  width: number
  height: number
  gap: number
  imageHeight: number
  radius: number
  columns: number
  align: 'start' | 'center' | 'end'
  logoScale: number
}

export type StreamTablePresetKey = 'compact' | 'broadcast' | 'double'
export type StreamCardPresetKey = 'compact' | 'broadcast' | 'hero'

export type StreamTablePreset = {
  key: StreamTablePresetKey
  name: string
  description: string
  values: StreamSharedTableConfig
}

export type StreamCardPreset = {
  key: StreamCardPresetKey
  name: string
  description: string
  values: StreamSharedCardConfig
}

export const STREAM_TABLE_PRESETS: StreamTablePreset[] = [
  {
    key: 'compact',
    name: 'Compacta',
    description: 'Mais linhas na tela, ideal para rankings longos.',
    values: { mode: 'single', rowHeight: 58, rowGap: 4, cellGap: 0, panelGap: 48, showHeaders: true, headerHeight: 32, logoWidth: 70, statWidth: 88, pointsWidth: 96, nameAlign: 'left' },
  },
  {
    key: 'broadcast',
    name: 'Broadcast',
    description: 'Leitura confortável e proporção equilibrada para transmissão.',
    values: { mode: 'single', rowHeight: 76, rowGap: 6, cellGap: 0, panelGap: 70, showHeaders: true, headerHeight: 38, logoWidth: 90, statWidth: 108, pointsWidth: 118, nameAlign: 'left' },
  },
  {
    key: 'double',
    name: 'Duas colunas',
    description: 'Distribuição pronta para tabelas com muitas equipes.',
    values: { mode: 'double', rowHeight: 68, rowGap: 5, cellGap: 0, panelGap: 56, showHeaders: true, headerHeight: 34, logoWidth: 76, statWidth: 92, pointsWidth: 104, nameAlign: 'left' },
  },
]

export const STREAM_CARD_PRESETS: StreamCardPreset[] = [
  {
    key: 'compact',
    name: 'Compacto',
    description: 'Mais cards por linha com foco em listas e classificados.',
    values: { width: 280, height: 360, gap: 14, imageHeight: 165, radius: 0, columns: 4, align: 'center', logoScale: .85 },
  },
  {
    key: 'broadcast',
    name: 'Broadcast',
    description: 'Card equilibrado para MVP, booyah e destaques.',
    values: { width: 360, height: 470, gap: 16, imageHeight: 220, radius: 0, columns: 3, align: 'center', logoScale: 1 },
  },
  {
    key: 'hero',
    name: 'Destaque',
    description: 'Poucos cards maiores, com mais presença visual.',
    values: { width: 470, height: 560, gap: 24, imageHeight: 285, radius: 0, columns: 2, align: 'center', logoScale: 1.12 },
  },
]

export type StreamSharedAnimationConfig = {
  enter: 'none' | 'fade' | 'slide'
  durationMs: number
  distancePx: number
  staggerMs: number
}

export type StreamPackageSharedConfig = {
  identity: {
    eventName: string
    primaryColor: string
    secondaryColor: string
    fontFamily: string
  }
  looseImage: StreamLooseImageConfig
  looseText: StreamLooseTextConfig
  layout: StreamSharedLayoutConfig
  table: StreamSharedTableConfig
  card: StreamSharedCardConfig
  animation: StreamSharedAnimationConfig
}

export type StreamPackageStructureOverrides = {
  layout?: Partial<StreamSharedLayoutConfig>
  table?: Partial<StreamSharedTableConfig>
  card?: Partial<StreamSharedCardConfig>
}

export type StreamPackageLooseOverrides = {
  image?: Partial<StreamLooseImageConfig>
  text?: Partial<StreamLooseTextConfig>
}

export type StreamPackageRenderItem = Record<string, string | number | null | undefined>

export type StreamPackageRenderData = {
  items: StreamPackageRenderItem[]
  source?: string
  emptyMessage?: string
}

export type StreamPackageOverlayConfig = {
  maxItems?: number
  tableMode?: 'single' | 'double'
  columns?: string[]
  title?: string
  assetOverrides?: Partial<Record<StreamPackageAssetKey, string>>
  structureOverrides?: StreamPackageStructureOverrides
  looseOverrides?: StreamPackageLooseOverrides
}

export type StreamOverlayPackage = {
  campeonato_id: string
  enabled_overlay_types: StreamSystemOverlayType[]
  assets: Partial<Record<StreamPackageAssetKey, string>>
  shared_config: StreamPackageSharedConfig
  overlay_configs: Partial<Record<StreamSystemOverlayType, StreamPackageOverlayConfig>>
  schema_version: number
  updated_at?: string | null
}

export const DEFAULT_STREAM_PACKAGE_SHARED_CONFIG: StreamPackageSharedConfig = {
  identity: {
    eventName: '',
    primaryColor: '#ffffff',
    secondaryColor: '#101218',
    fontFamily: 'Rajdhani',
  },
  looseImage: {
    assetKey: 'event_logo',
    show: true,
    x: 80,
    y: 60,
    width: 260,
    height: 160,
    fit: 'contain',
  },
  looseText: {
    show: true,
    x: 80,
    y: 250,
    width: 900,
    fontFamily: 'Rajdhani',
    fontSize: 54,
    fontWeight: 800,
    color: '#ffffff',
    align: 'left',
  },
  layout: {
    offsetX: 0,
    offsetY: 0,
    widthScale: 1,
    heightScale: 1,
  },
  table: {
    mode: 'single',
    rowHeight: 76,
    rowGap: 6,
    cellGap: 0,
    panelGap: 70,
    showHeaders: true,
    headerHeight: 38,
    logoWidth: 90,
    statWidth: 108,
    pointsWidth: 118,
    nameAlign: 'left',
  },
  card: {
    width: 360,
    height: 470,
    gap: 16,
    imageHeight: 220,
    radius: 0,
    columns: 3,
    align: 'center',
    logoScale: 1,
  },
  animation: {
    enter: 'slide',
    durationMs: 650,
    distancePx: 160,
    staggerMs: 70,
  },
}

export const DEFAULT_STREAM_OVERLAY_CONFIGS: Record<StreamSystemOverlayType, StreamPackageOverlayConfig> = {
  standings_general: {
    maxItems: 12,
    tableMode: 'double',
    columns: ['rank', 'logo', 'name', 'drops', 'booyah', 'kills', 'points'],
    title: 'Classificação geral',
  },
  round_teams: {
    maxItems: 12,
    tableMode: 'single',
    columns: ['rank', 'logo', 'name', 'position', 'kills', 'points'],
    title: 'Resultado da queda',
  },
  round_players: {
    maxItems: 12,
    tableMode: 'single',
    columns: ['rank', 'logo', 'nick', 'kills'],
    title: 'Jogadores da queda',
  },
  mvp_general: {
    maxItems: 8,
    tableMode: 'single',
    columns: ['rank', 'logo', 'nick', 'drops', 'kd', 'kills'],
    title: 'MVP geral',
  },
  mvp_day: {
    maxItems: 6,
    tableMode: 'single',
    columns: ['rank', 'logo', 'nick', 'kills'],
    title: 'MVP do dia',
  },
  mvp_round: {
    maxItems: 4,
    tableMode: 'single',
    columns: ['rank', 'logo', 'nick', 'kills'],
    title: 'MVP da queda',
  },
  booyahs_day: {
    maxItems: 3,
    columns: ['map', 'logo', 'name', 'points', 'kills'],
    title: 'Booyahs do dia',
  },
  qualified_teams: {
    maxItems: 12,
    columns: ['logo', 'category'],
    title: 'Equipes classificadas',
  },
  next_round: {
    maxItems: 1,
    columns: ['map', 'round'],
    title: 'Próxima queda',
  },
  champion: {
    maxItems: 1,
    columns: ['logo', 'name'],
    title: 'Campeão',
  },
}


export type StreamSystemOverlayLayout = {
  content: { x: number; y: number; width: number; height: number }
  variant: 'table' | 'ranking' | 'map-card' | 'player-card' | 'logo-card' | 'next-round' | 'champion'
}

export const STREAM_SYSTEM_OVERLAY_LAYOUTS: Record<StreamSystemOverlayType, StreamSystemOverlayLayout> = {
  standings_general: { content: { x: 70, y: 340, width: 1780, height: 680 }, variant: 'ranking' },
  round_teams: { content: { x: 120, y: 350, width: 1680, height: 660 }, variant: 'table' },
  round_players: { content: { x: 120, y: 350, width: 1680, height: 660 }, variant: 'table' },
  mvp_general: { content: { x: 180, y: 370, width: 1560, height: 610 }, variant: 'ranking' },
  mvp_day: { content: { x: 240, y: 390, width: 1440, height: 560 }, variant: 'ranking' },
  mvp_round: { content: { x: 120, y: 390, width: 1680, height: 570 }, variant: 'player-card' },
  booyahs_day: { content: { x: 100, y: 360, width: 1720, height: 610 }, variant: 'map-card' },
  qualified_teams: { content: { x: 100, y: 350, width: 1720, height: 620 }, variant: 'logo-card' },
  next_round: { content: { x: 120, y: 360, width: 1680, height: 590 }, variant: 'next-round' },
  champion: { content: { x: 120, y: 330, width: 1680, height: 640 }, variant: 'champion' },
}

export const STREAM_SYSTEM_OVERLAY_META: Record<StreamSystemOverlayType, {
  name: string
  description: string
  structure: 'table' | 'cards' | 'hero'
}> = {
  standings_general: { name: 'Classificação geral', description: 'Ranking acumulado do campeonato.', structure: 'table' },
  round_teams: { name: 'Resultado da queda', description: 'Resultado das equipes na queda selecionada.', structure: 'table' },
  round_players: { name: 'Jogadores da queda', description: 'Ranking individual da queda selecionada.', structure: 'table' },
  mvp_general: { name: 'MVP geral', description: 'Líderes individuais no acumulado.', structure: 'table' },
  mvp_day: { name: 'MVP do dia', description: 'Líderes individuais no dia/jogo.', structure: 'table' },
  mvp_round: { name: 'MVP da queda', description: 'Destaques da queda atual.', structure: 'cards' },
  booyahs_day: { name: 'Booyahs do dia', description: 'Cards das equipes vencedoras por mapa.', structure: 'cards' },
  qualified_teams: { name: 'Equipes classificadas', description: 'Cards por categoria de classificação.', structure: 'cards' },
  next_round: { name: 'Próxima queda', description: 'Mapa e identificação da próxima queda.', structure: 'hero' },
  champion: { name: 'Campeão', description: 'Cena de campeão com identidade do evento.', structure: 'hero' },
}
