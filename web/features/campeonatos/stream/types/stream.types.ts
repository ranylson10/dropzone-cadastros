/**
 * Tipos da aba Stream / workspace de produção.
 */

export type StreamOverlayKind = 'lower_third' | 'scoreboard' | 'standings' | 'custom'

export type StreamOverlay = {
  id: string
  name: string
  kind: StreamOverlayKind
  /** Campos da overlay e endereço da planilha (ex.: Classificacao!B2). */
  fields: Array<{ key: string; label: string; cellRef: string }>
  updatedAt: string
}

export type StreamSheetColumn = {
  key: string
  label: string
  letter: string
}

export type StreamSheetRow = {
  id: string
  cells: Record<string, string>
}

export type StreamSheetId = 'equipes' | 'jogadores' | 'classificacao'

export type StreamSheetDefinition = {
  id: StreamSheetId
  title: string
  /** Nome usado em bindings (ex.: Equipes!B2) */
  refName: string
  columns: StreamSheetColumn[]
  live: boolean
}

export type StreamInnerPanel = 'overlays' | 'planilha'

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
]

export function colLetterToIndex(letter: string) {
  return letter.toUpperCase().charCodeAt(0) - 65
}
