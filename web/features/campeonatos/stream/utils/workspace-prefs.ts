/** Preferências de workspace do editor Stream (por navegador). */

export type StreamDockMode = 'lcr' | 'clr' | 'lrc'

export type StreamWorkspacePrefs = {
  leftW: number
  rightW: number
  zoom: number
  panX: number
  panY: number
  /** lcr = ferramentas | canvas | camadas; clr = canvas | ferramentas | camadas; lrc = ferramentas | camadas | canvas */
  dock: StreamDockMode
}

const KEY = 'dropzone-stream-editor-workspace-v1'

const DEFAULTS: StreamWorkspacePrefs = {
  leftW: 340,
  rightW: 320,
  zoom: 0.55,
  panX: 0,
  panY: 0,
  dock: 'lcr',
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function loadWorkspacePrefs(): StreamWorkspacePrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<StreamWorkspacePrefs>
    return {
      leftW: clamp(Number(parsed.leftW) || DEFAULTS.leftW, 220, 720),
      rightW: clamp(Number(parsed.rightW) || DEFAULTS.rightW, 220, 720),
      zoom: clamp(Number(parsed.zoom) || DEFAULTS.zoom, 0.15, 3),
      panX: Number(parsed.panX) || 0,
      panY: Number(parsed.panY) || 0,
      dock: parsed.dock === 'clr' || parsed.dock === 'lrc' || parsed.dock === 'lcr' ? parsed.dock : 'lcr',
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveWorkspacePrefs(prefs: StreamWorkspacePrefs) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        leftW: clamp(prefs.leftW, 220, 720),
        rightW: clamp(prefs.rightW, 220, 720),
        zoom: clamp(prefs.zoom, 0.15, 3),
        panX: prefs.panX,
        panY: prefs.panY,
        dock: prefs.dock,
      }),
    )
  } catch {
    // ignore quota
  }
}

export { DEFAULTS as WORKSPACE_DEFAULTS }
