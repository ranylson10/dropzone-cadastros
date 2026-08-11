/**
 * Stream — tipos e definições das fontes de dados usadas pelo pacote de overlays.
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
  | 'jogadores_mapa'
  | 'mvp_partida'
  | 'mvp_dia'
  | 'mvp_geral'
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
  group?: 'equipes' | 'jogadores' | 'mvp' | 'mapas' | 'partida' | 'legado'
}

export type StreamSheetFilters = {
  mapa_codigo?: string
  jogo_id?: string
  fase_id?: string
  grupo_id?: string
  partida_id?: string
}

const COLS_EQUIPE = [
  { key: 'pos', label: 'Pos', letter: 'A' },
  { key: 'delta', label: 'Δ', letter: 'B' },
  { key: 'logo', label: 'Logo', letter: 'C', image: true },
  { key: 'nome', label: 'Nome', letter: 'D' },
  { key: 'grupo', label: 'Grupo', letter: 'E' },
  { key: 'quedas', label: 'Quedas', letter: 'F' },
  { key: 'booyahs', label: 'B!', letter: 'G' },
  { key: 'abates', label: 'Abates', letter: 'H' },
  { key: 'pontos', label: 'Pontos', letter: 'I' },
] as StreamSheetColumn[]

const COLS_EQUIPE_JOGO: StreamSheetColumn[] = [
  { key: 'slot', label: 'Slot', letter: 'A' },
  { key: 'logo', label: 'Logo', letter: 'B', image: true },
  { key: 'nome', label: 'Equipe', letter: 'C' },
  { key: 'grupo', label: 'Grupo', letter: 'D' },
]

const COLS_EQUIPE_PARTIDA: StreamSheetColumn[] = [
  { key: 'pos', label: 'Pos', letter: 'A' },
  { key: 'logo', label: 'Logo', letter: 'B', image: true },
  { key: 'nome', label: 'Equipe', letter: 'C' },
  { key: 'abates', label: 'Kills', letter: 'D' },
  { key: 'pontos_posicao', label: 'Pts posição', letter: 'E' },
  { key: 'pontos_abates', label: 'Pts kills', letter: 'F' },
  { key: 'pontos', label: 'Pts total', letter: 'G' },
]

const COLS_MVP: StreamSheetColumn[] = [
  { key: 'pos', label: 'Pos', letter: 'A' },
  { key: 'foto', label: 'Foto', letter: 'B', image: true },
  { key: 'logo', label: 'Logo equipe', letter: 'C', image: true },
  { key: 'tag', label: 'Tag', letter: 'D' },
  { key: 'nick', label: 'Nick', letter: 'E' },
  { key: 'quedas', label: 'Quedas', letter: 'F' },
  { key: 'kd', label: 'K.D', letter: 'G' },
  { key: 'abates', label: 'Kills', letter: 'H' },
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
    columns: COLS_EQUIPE_JOGO,
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
    id: 'jogadores_mapa',
    title: 'Jogadores · Mapa',
    refName: 'JogadoresMapa',
    live: true,
    group: 'jogadores',
    filter: 'mapa',
    columns: COLS_MVP,
  },
  {
    id: 'mvp_partida',
    title: 'MVP · Partida',
    refName: 'MVPPartida',
    live: true,
    group: 'mvp',
    filter: 'partida',
    columns: COLS_MVP,
  },
  {
    id: 'mvp_dia',
    title: 'MVP · Dia',
    refName: 'MVPDia',
    live: true,
    group: 'mvp',
    filter: 'jogo',
    columns: COLS_MVP,
  },
  {
    id: 'mvp_geral',
    title: 'MVP · Geral',
    refName: 'MVPGeral',
    live: true,
    group: 'mvp',
    filter: 'none',
    columns: COLS_MVP,
  },
  {
    id: 'mapas',
    title: 'Mapas do dia',
    refName: 'Mapas',
    live: true,
    group: 'mapas',
    /** Filtra por jogo; vazio = jogo ativo da live (auto / pack). */
    filter: 'jogo',
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

/** Alias históricos da API/planilha → aba semântica atual. */
export const STREAM_SHEET_ALIASES: Partial<Record<StreamSheetId, StreamSheetId>> = {
  classificacao: 'equipes_geral',
  sumula: 'equipes_partida',
  quedas: 'mapas',
  equipes: 'equipes_geral',
  mvp: 'mvp_geral',
}

export function resolveSheetId(id: StreamSheetId): StreamSheetId {
  return STREAM_SHEET_ALIASES[id] || id
}
