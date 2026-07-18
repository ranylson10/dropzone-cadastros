/**
 * Tipos preparatórios da aba Stream.
 * Ainda sem persistência/API — só estrutura para overlays + planilha.
 */

export type StreamOverlayKind = 'lower_third' | 'scoreboard' | 'standings' | 'custom'

export type StreamOverlay = {
  id: string
  name: string
  kind: StreamOverlayKind
  /** Campos exibidos no overlay (ex.: nick, kills). */
  fields?: string[]
}

export type StreamSheetColumn = {
  key: string
  label: string
  width?: number
}

export type StreamSheetRow = {
  id: string
  cells: Record<string, string>
}

/** Vínculo futuro: campo do overlay ← coluna da planilha. */
export type StreamDataBinding = {
  overlayId: string
  field: string
  columnKey: string
}

export type StreamInnerPanel = 'overlays' | 'planilha'
