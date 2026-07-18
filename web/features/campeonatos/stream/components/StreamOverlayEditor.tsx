'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Columns2,
  Copy,
  Download,
  PanelLeft,
  PanelRight,
  Plus,
  Save,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import {
  fetchOverlay,
  loadStreamSheet,
  saveOverlayRemote,
} from '../services/stream-data.service'
import type {
  LayerContentType,
  StreamBlock,
  StreamCardBlock,
  StreamLayer,
  StreamOverlay,
  StreamSheetId,
  StreamSheetRow,
  StreamTableBlock,
} from '../types/stream.types'
import {
  DEFAULT_BOX,
  DEFAULT_TRANSITION,
  FRAME_H,
  FRAME_PRESETS,
  FRAME_W,
  getOverlayFrame,
  newBlockId,
} from '../types/stream.types'
import { migrateOverlay } from '../utils/migrate-overlay'
import {
  createDefaultLayer,
  createEmptyCard,
  duplicateCardFolder,
  ensureCardLayers,
} from '../utils/card-layers'
import {
  loadWorkspacePrefs,
  saveWorkspacePrefs,
  type StreamDockMode,
  type StreamWorkspacePrefs,
} from '../utils/workspace-prefs'
import {
  buildOverlayBrowserHtml,
  buildOverlayExportPayload,
  downloadHtml,
  downloadJson,
} from '../utils/export-overlay'
import { BoxStyleEditor, FieldStyleEditor, LayerImageUpload, TransitionEditor } from './editor/StylePanels'
import { CellPicker } from './editor/CellPicker'
import { CardLayerCanvas } from './CardLayerCanvas'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import { boxToCssSafe, fieldToCss } from '../utils/stream-style'
import type { PreviewMap, PreviewStanding } from './editor/OverlayPreview'
import '../stream.css'

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ov-${Date.now()}`
}

const LAYER_TYPES: Array<{ id: LayerContentType; label: string }> = [
  { id: 'image', label: 'Imagem livre' },
  { id: 'logo', label: 'Logo / arte' },
  { id: 'text', label: 'Texto livre' },
  { id: 'number', label: 'Número' },
]

/** Máx. de undos (Ctrl+Z) — limita memória. */
const UNDO_MAX = 5

type OverlaySnap = Pick<StreamOverlay, 'name' | 'blocks' | 'frameW' | 'frameH' | 'template'>

function cloneSnap(o: StreamOverlay): OverlaySnap {
  return JSON.parse(
    JSON.stringify({
      name: o.name,
      blocks: o.blocks,
      frameW: o.frameW,
      frameH: o.frameH,
      template: o.template,
    }),
  ) as OverlaySnap
}

export function StreamOverlayEditor(props: {
  campeonatoId: string
  overlayId?: string
  isNew?: boolean
}) {
  const router = useRouter()
  const stageRef = useRef<HTMLDivElement>(null)

  const [overlay, setOverlay] = useState<StreamOverlay | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [openLayerMenu, setOpenLayerMenu] = useState<string | null>(null)

  const [ws, setWs] = useState<StreamWorkspacePrefs>(() => loadWorkspacePrefs())
  const zoom = ws.zoom
  const pan = useMemo(() => ({ x: ws.panX, y: ws.panY }), [ws.panX, ws.panY])
  const setZoom = useCallback((updater: number | ((z: number) => number)) => {
    setWs((prev) => {
      const nextZ = typeof updater === 'function' ? updater(prev.zoom) : updater
      return { ...prev, zoom: Math.min(3, Math.max(0.15, nextZ)) }
    })
  }, [])
  const setPan = useCallback((next: { x: number; y: number } | ((p: { x: number; y: number }) => { x: number; y: number })) => {
    setWs((prev) => {
      const cur = { x: prev.panX, y: prev.panY }
      const p = typeof next === 'function' ? next(cur) : next
      return { ...prev, panX: p.x, panY: p.y }
    })
  }, [])

  const [panning, setPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const spaceHeld = useRef(false)
  const dragBlock = useRef<{
    id: string
    startClientX: number
    startClientY: number
    origX: number
    origY: number
  } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  /** Pilha de undos (máx. UNDO_MAX). */
  const undoStack = useRef<OverlaySnap[]>([])
  const softUndoOpen = useRef(false)
  const softUndoAt = useRef(0)
  const [undoCount, setUndoCount] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveWarning, setSaveWarning] = useState('')
  const [standings, setStandings] = useState<PreviewStanding[]>([])
  const [mvpRows, setMvpRows] = useState<PreviewStanding[]>([])
  const [maps, setMaps] = useState<PreviewMap[]>([])
  const [sheets, setSheets] = useState<Partial<Record<StreamSheetId, StreamSheetRow[]>>>({})
  const [loadingData, setLoadingData] = useState(true)

  // Persiste layout do editor (laterais, zoom, pan, dock)
  useEffect(() => {
    saveWorkspacePrefs(ws)
  }, [ws])

  // Trava scroll da página — só laterais e canvas rolam/pan internamente
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  function recordUndo(prev: StreamOverlay, mode: 'force' | 'soft' = 'force') {
    if (mode === 'soft') {
      const now = Date.now()
      // agrupa edições contínuas (digitação/slider) numa única entrada
      if (softUndoOpen.current && now - softUndoAt.current < 700) {
        softUndoAt.current = now
        return
      }
      softUndoOpen.current = true
      softUndoAt.current = now
    } else {
      softUndoOpen.current = false
    }
    const snap = cloneSnap(prev)
    const stack = undoStack.current
    // evita duplicar o mesmo estado
    const last = stack[stack.length - 1]
    if (last && JSON.stringify(last) === JSON.stringify(snap)) return
    undoStack.current = [...stack.slice(-(UNDO_MAX - 1)), snap]
    setUndoCount(undoStack.current.length)
  }

  function undo() {
    const snap = undoStack.current.pop()
    if (!snap) return
    setUndoCount(undoStack.current.length)
    softUndoOpen.current = false
    setOverlay((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        name: snap.name,
        blocks: snap.blocks,
        frameW: snap.frameW,
        frameH: snap.frameH,
        template: snap.template,
      }
    })
  }

  // Espaço = pan · Ctrl+Z = desfazer (máx. 5)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const inField =
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        // em campo de texto o browser desfaz digitos; se stack vazio deixa nativo
        if (inField && undoStack.current.length === 0) return
        e.preventDefault()
        undo()
        return
      }

      if (e.code === 'Space' && !e.repeat) {
        if (inField) return
        e.preventDefault()
        spaceHeld.current = true
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spaceHeld.current = false
    }
    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const frame = getOverlayFrame(overlay)
  // Scroll do mouse = zoom da área de trabalho
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {})
  wheelHandlerRef.current = (e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    // zoom um pouco mais fino se shift
    const step = e.shiftKey ? delta * 0.5 : delta
    setZoom((z) => Math.min(3, Math.max(0.15, z + step)))
  }

  // wheel non-passive no stage (evita scroll da página; só zoom)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const fn = (e: WheelEvent) => wheelHandlerRef.current(e)
    el.addEventListener('wheel', fn, { passive: false })
    return () => el.removeEventListener('wheel', fn)
  }, [overlay])

  // Nova overlay: só nome, sem wizard
  useEffect(() => {
    if (props.isNew) {
      setOverlay({
        id: newId(),
        name: 'Nova overlay',
        template: 'custom',
        blocks: [],
        frameW: FRAME_W,
        frameH: FRAME_H,
        updatedAt: new Date().toISOString(),
      })
      undoStack.current = []
      setUndoCount(0)
      return
    }
    if (!props.overlayId) return
    let cancelled = false
    ;(async () => {
      const raw = await fetchOverlay(props.campeonatoId, props.overlayId!)
      const migrated = migrateOverlay(raw)
      if (cancelled || !migrated) return
      setOverlay(migrated)
      setSelectedBlockId(migrated.blocks[0]?.id || null)
      undoStack.current = []
      setUndoCount(0)
    })()
    return () => {
      cancelled = true
    }
  }, [props.campeonatoId, props.overlayId, props.isNew])

  const loadData = useCallback(async () => {
    setLoadingData(true)
    try {
      const ids: StreamSheetId[] = [
        'equipes_geral',
        'mvp',
        'mapas',
        'partida_atual',
        'proxima_queda',
        'equipes_partida',
      ]
      const loaded = await Promise.all(ids.map((id) => loadStreamSheet(props.campeonatoId, id).catch(() => [] as StreamSheetRow[])))
      const next: Partial<Record<StreamSheetId, StreamSheetRow[]>> = {}
      ids.forEach((id, i) => {
        next[id] = loaded[i]
      })
      // aliases para overlays legadas
      next.classificacao = next.equipes_geral
      next.equipes = next.equipes_geral
      next.quedas = next.mapas
      setSheets(next)

      const classif = next.equipes_geral || []
      const mvp = next.mvp || []
      const standingRows: PreviewStanding[] = classif.map((row, i) => ({
        pos: Number(row.cells.pos || row.cells.colocacao) || i + 1,
        nome: row.cells.nome || row.cells.line || '—',
        logo: row.cells.logo || undefined,
        booyah: row.cells.booyahs || '0',
        abates: row.cells.abates || '0',
        pts: row.cells.pontos || '0',
        delta: row.cells.delta || '0',
        quedas: row.cells.quedas || '0',
        kd: '0',
      }))
      const mvpPreview: PreviewStanding[] = mvp.map((row, i) => ({
        pos: Number(row.cells.pos || row.cells.colocacao) || i + 1,
        nome: row.cells.nick || '—',
        logo: row.cells.logo || row.cells.foto || undefined,
        booyah: '0',
        abates: row.cells.abates || '0',
        pts: '0',
        delta: row.cells.delta || '0',
        quedas: row.cells.quedas || '0',
        kd: row.cells.kd || '0',
      }))

      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        const res = await fetch(`/api/campeonatos/${props.campeonatoId}/equipes`, {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const json = await res.json()
        const vagas = Array.isArray(json.vagas) ? json.vagas : []
        const byName = new Map<string, string>()
        for (const v of vagas) {
          const name = String(v.line_nome || v.campeonato_equipe?.line_nome || '')
          const logo = String(v.line_logo_url || v.campeonato_equipe?.line_logo_url || '')
          if (name && logo) byName.set(name.toLowerCase(), logo)
        }
        for (const s of standingRows) s.logo = byName.get(s.nome.toLowerCase())
      } catch {
        // ignore
      }

      setStandings(standingRows)
      setMvpRows(mvpPreview.length ? mvpPreview : standingRows)

      const quedas = next.quedas || []
      const mapImages: Record<string, string> = {
        bermuda: '/images/maps/bermuda.png',
        purgatorio: '/images/maps/purgatorio.png',
        purgatório: '/images/maps/purgatorio.png',
        'nova terra': '/images/maps/nova-terra.png',
      }
      const fallback = ['BERMUDA 1', 'PURGATÓRIO 1', 'NOVA TERRA 1']
      const fromQ = quedas.slice(0, 6).map((q, i) => {
        const mapa = String(q.cells.mapa || fallback[i] || `MAPA ${i + 1}`)
        const imageUrl = Object.entries(mapImages).find(([k]) => mapa.toLowerCase().includes(k))?.[1] || '/images/maps/bermuda.png'
        return {
          title: mapa.toUpperCase(),
          imageUrl,
          logo: standingRows[i]?.logo,
          pts: standingRows[i]?.pts || '0',
          abates: standingRows[i]?.abates || '0',
          nome: standingRows[i]?.nome || '',
        }
      })
      setMaps(
        fromQ.length
          ? fromQ
          : fallback.map((title, i) => ({
              title,
              imageUrl: Object.values(mapImages)[i] || '/images/maps/bermuda.png',
              logo: standingRows[i]?.logo,
              pts: standingRows[i]?.pts || '0',
              abates: standingRows[i]?.abates || '0',
              nome: standingRows[i]?.nome || '',
            })),
      )
    } finally {
      setLoadingData(false)
    }
  }, [props.campeonatoId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selectedBlock = useMemo(
    () => overlay?.blocks.find((b) => b.id === selectedBlockId) || null,
    [overlay, selectedBlockId],
  )
  const selectedCard = selectedBlock?.type === 'card' ? ensureCardLayers(selectedBlock) : null
  const selectedLayer = selectedCard?.layers.find((l) => l.id === selectedLayerId) || null

  const ctx = useMemo(
    () => ({
      mapas: maps,
      classificacao: standings,
      mvp: mvpRows,
      sheets,
    }),
    [maps, standings, mvpRows, sheets],
  )

  function updateBlock(
    blockId: string,
    updater: (b: StreamBlock) => StreamBlock,
    opts?: { history?: 'force' | 'soft' | false },
  ) {
    const hist = opts?.history === undefined ? 'soft' : opts.history
    setOverlay((prev) => {
      if (!prev) return prev
      if (hist) recordUndo(prev, hist)
      return { ...prev, blocks: prev.blocks.map((b) => (b.id === blockId ? updater(b) : b)) }
    })
  }

  function patchOverlay(
    updater: (prev: StreamOverlay) => StreamOverlay,
    hist: 'force' | 'soft' | false = 'force',
  ) {
    setOverlay((prev) => {
      if (!prev) return prev
      if (hist) recordUndo(prev, hist)
      return updater(prev)
    })
  }

  function addBlock(type: 'card' | 'table') {
    if (!overlay) return
    const n = overlay.blocks.length
    const offset = (n % 8) * 28
    if (type === 'card') {
      const card = createEmptyCard(`Bloco ${overlay.blocks.filter((b) => b.type === 'card').length + 1}`, {
        x: 48 + offset,
        y: 48 + offset,
        w: 240,
        h: 160,
      })
      patchOverlay((prev) => ({ ...prev, blocks: [...prev.blocks, card] }), 'force')
      setSelectedBlockId(card.id)
      setSelectedLayerId(null)
      return
    }
    const table: StreamTableBlock = {
      id: newBlockId(),
      type: 'table',
      name: `Tabela ${overlay.blocks.filter((b) => b.type === 'table').length + 1}`,
      x: 48 + offset,
      y: 48 + offset,
      tableW: 420,
      box: { ...DEFAULT_BOX, padding: 0, fill: { mode: 'solid', color: '#1a1208' } },
      transition: { ...DEFAULT_TRANSITION, enter: 'slide-up' },
      data: {
        variant: 'standings',
        source: 'classificacao',
        rows: 10,
        startRank: 1,
        columns: ['pos', 'logo', 'nome', 'booyah', 'abates', 'pts', 'delta'],
        rowHeight: 36,
        rowGap: 0,
        headerHeight: 32,
      },
    }
    patchOverlay((prev) => ({ ...prev, blocks: [...prev.blocks, table] }), 'force')
    setSelectedBlockId(table.id)
    setSelectedLayerId(null)
  }

  function clampPos(x: number, y: number, w: number, h: number) {
    const fw = frame.w
    const fh = frame.h
    return {
      x: Math.max(0, Math.min(fw - Math.min(w, fw), Math.round(x))),
      y: Math.max(0, Math.min(fh - Math.min(h, fh), Math.round(y))),
    }
  }

  function setDock(dock: StreamDockMode) {
    setWs((p) => ({ ...p, dock }))
  }

  function setFrameSize(w: number, h: number) {
    if (!overlay) return
    patchOverlay(
      (prev) => ({
        ...prev,
        frameW: Math.max(64, Math.round(w)),
        frameH: Math.max(64, Math.round(h)),
      }),
      'soft',
    )
  }

  function onPanelResizeStart(side: 'tools' | 'layers', e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startLeft = ws.leftW
    const startRight = ws.rightW
    const dock = ws.dock
    // tools: leftW · layers: rightW
    // sentido depende se o painel está à esquerda ou à direita do handle
    const toolsAfterHandle = dock === 'clr' // canvas | tools | layers
    const layersBeforeHandle = dock === 'lrc' // tools | layers | canvas

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      if (side === 'tools') {
        const next = Math.min(720, Math.max(220, startLeft + (toolsAfterHandle ? -dx : dx)))
        setWs((p) => ({ ...p, leftW: next }))
      } else {
        const next = Math.min(720, Math.max(220, startRight + (layersBeforeHandle ? dx : -dx)))
        setWs((p) => ({ ...p, rightW: next }))
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function blockSize(b: StreamBlock) {
    if (b.type === 'card') {
      const c = ensureCardLayers(b)
      return { w: c.canvasW, h: c.canvasH }
    }
    return { w: b.tableW || 420, h: 200 }
  }

  function removeBlock(id: string) {
    if (!overlay) return
    patchOverlay((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }), 'force')
    if (selectedBlockId === id) {
      setSelectedBlockId(null)
      setSelectedLayerId(null)
    }
  }

  function dupBlock(id: string) {
    if (!overlay) return
    const block = overlay.blocks.find((b) => b.id === id)
    if (!block) return
    if (block.type === 'card') {
      const card = ensureCardLayers(block)
      const copy = duplicateCardFolder(card)
      patchOverlay((prev) => ({ ...prev, blocks: [...prev.blocks, copy] }), 'force')
      setSelectedBlockId(copy.id)
      return
    }
    const copy: StreamTableBlock = {
      ...block,
      id: newBlockId(),
      name: `${block.name} cópia`,
      x: (block.x ?? 40) + 24,
      y: (block.y ?? 40) + 24,
      data: { ...block.data },
    }
    patchOverlay((prev) => ({ ...prev, blocks: [...prev.blocks, copy] }), 'force')
    setSelectedBlockId(copy.id)
  }

  function addLayer(type: LayerContentType) {
    if (!selectedCard) return
    const layer = createDefaultLayer(type, 1)
    updateBlock(
      selectedCard.id,
      (b) => {
        if (b.type !== 'card') return b
        const c = ensureCardLayers(b)
        return { ...c, layers: [...c.layers, layer] }
      },
      { history: 'force' },
    )
    setSelectedLayerId(layer.id)
    setOpenLayerMenu(layer.id)
  }

  function updateLayer(layerId: string, patch: Partial<StreamLayer>) {
    if (!selectedCard) return
    updateBlock(
      selectedCard.id,
      (b) => {
        if (b.type !== 'card') return b
        const c = ensureCardLayers(b)
        return { ...c, layers: c.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) }
      },
      { history: 'soft' },
    )
  }

  function removeLayer(layerId: string) {
    if (!selectedCard) return
    updateBlock(
      selectedCard.id,
      (b) => {
        if (b.type !== 'card') return b
        const c = ensureCardLayers(b)
        return { ...c, layers: c.layers.filter((l) => l.id !== layerId) }
      },
      { history: 'force' },
    )
    if (selectedLayerId === layerId) setSelectedLayerId(null)
    if (openLayerMenu === layerId) setOpenLayerMenu(null)
  }

  async function handleSave() {
    if (!overlay) return
    const next = { ...overlay, template: 'custom' as const, updatedAt: new Date().toISOString() }
    const isNew = Boolean(props.isNew) || next.id.startsWith('ov-') || !props.overlayId
    const result = await saveOverlayRemote(props.campeonatoId, next, { isNew })
    setOverlay(result.overlay)
    setSaveWarning(result.warning || '')
    setSaved(true)
    if (isNew || props.overlayId !== result.overlay.id) {
      router.replace(`/campeonatos/${props.campeonatoId}/stream/overlays/${result.overlay.id}`)
    }
    window.setTimeout(() => setSaved(false), 2000)
  }

  function startPan(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    setPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  // pan: botão direito (principal) · meio · Alt/Espaço+esquerdo
  function onStagePointerDown(e: React.PointerEvent) {
    if (dragBlock.current) return
    const wantPan =
      e.button === 2 // direito = mover área de trabalho
      || e.button === 1
      || (e.button === 0 && (e.altKey || spaceHeld.current))
    if (!wantPan) return
    startPan(e)
  }
  function onStagePointerMove(e: React.PointerEvent) {
    if (dragBlock.current) {
      const dx = (e.clientX - dragBlock.current.startClientX) / zoom
      const dy = (e.clientY - dragBlock.current.startClientY) / zoom
      const block = overlay?.blocks.find((b) => b.id === dragBlock.current!.id)
      const size = block ? blockSize(block) : { w: 240, h: 160 }
      const next = clampPos(dragBlock.current.origX + dx, dragBlock.current.origY + dy, size.w, size.h)
      // arraste contínuo sem encher a pilha de undo
      updateBlock(dragBlock.current.id, (b) => ({ ...b, x: next.x, y: next.y }), { history: false })
      return
    }
    if (!panning) return
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    })
  }
  function onStagePointerUp() {
    dragBlock.current = null
    setDraggingId(null)
    setPanning(false)
  }
  function onBlockPointerDown(e: React.PointerEvent, block: StreamBlock) {
    // direito/meio = pan da área (não move o bloco)
    if (e.button === 2 || e.button === 1) return
    if (e.button !== 0 || e.altKey || spaceHeld.current) return
    const t = e.target as HTMLElement
    // clique em camada interna = seleciona camada, não inicia drag do bloco
    if (t.closest('.stream-layer-hit')) {
      setSelectedBlockId(block.id)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    setSelectedBlockId(block.id)
    setSelectedLayerId(null)
    // 1 undo por gesto de arraste (estado antes de mover)
    if (overlay) recordUndo(overlay, 'force')
    dragBlock.current = {
      id: block.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: block.x ?? 40,
      origY: block.y ?? 40,
    }
    setDraggingId(block.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  if (!overlay) {
    return (
      <div className="stream-editor">
        <p className="stream-hint" style={{ padding: 24 }}>Carregando…</p>
      </div>
    )
  }

  return (
    <div className="stream-editor stream-gt">
      <header className="stream-workspace-header">
        <div className="stream-workspace-brand">
          <button type="button" className="stream-icon-btn" onClick={() => router.push(`/campeonatos/${props.campeonatoId}/stream`)}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <div>
            <p className="eyebrow">Editor de overlay</p>
            <input
              className="stream-name-input"
              value={overlay.name}
              onChange={(e) => setOverlay({ ...overlay, name: e.target.value })}
              placeholder="Nome da overlay"
            />
          </div>
        </div>
        <div className="stream-panel-actions">
          {loadingData ? <span className="stream-badge">dados…</span> : null}
          {saved ? <span className="stream-badge">salvo</span> : null}
          {overlay.share_token ? (
            <a className="stream-secondary-btn" href={`/stream/live/${overlay.share_token}`} target="_blank" rel="noopener noreferrer">Live</a>
          ) : null}
          <button type="button" className="stream-secondary-btn" onClick={() => downloadJson(`overlay.json`, buildOverlayExportPayload(overlay, props.campeonatoId))}>
            <Download size={15} /> JSON
          </button>
          <button
            type="button"
            className="stream-secondary-btn"
            onClick={() =>
              downloadHtml(
                'overlay.html',
                buildOverlayBrowserHtml(overlay, { origin: window.location.origin }),
              )
            }
          >
            <Download size={15} /> HTML
          </button>
          <StreamSpreadsheetPanel
            campeonatoId={props.campeonatoId}
            asModal
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            showTrigger
            triggerLabel="Planilha"
          />
          <button
            type="button"
            className="stream-secondary-btn"
            disabled={undoCount === 0}
            title="Desfazer (Ctrl+Z) — até 5 ações"
            onClick={() => undo()}
          >
            <Undo2 size={15} /> Desfazer{undoCount > 0 ? ` (${undoCount})` : ''}
          </button>
          <button type="button" className="stream-primary-btn" onClick={() => void handleSave()}>
            <Save size={15} /> Salvar
          </button>
        </div>
      </header>
      {saveWarning ? <p className="stream-hint" style={{ margin: '0 0 8px' }}>{saveWarning}</p> : null}

      <div
        className={`stream-gt-layout stream-gt-layout-3 dock-${ws.dock}`}
        style={{
          ['--gt-left' as string]: `${ws.leftW}px`,
          ['--gt-right' as string]: `${ws.rightW}px`,
        }}
      >
        {/* FERRAMENTAS */}
        <aside className="stream-gt-left stream-panel" style={{ gridArea: 'tools' }}>
          <div className="stream-gt-layer-head">
            <strong>Ferramentas</strong>
          </div>

          <div className="stream-gt-workspace-box">
            <p className="stream-hint"><strong>Área de trabalho</strong></p>
            <label className="stream-field">
              <span>Formato / resolução</span>
              <select
                value={
                  FRAME_PRESETS.find((p) => p.w === frame.w && p.h === frame.h)?.id || 'custom'
                }
                onChange={(e) => {
                  const preset = FRAME_PRESETS.find((p) => p.id === e.target.value)
                  if (preset) setFrameSize(preset.w, preset.h)
                }}
              >
                {FRAME_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
                <option value="custom">Personalizado…</option>
              </select>
            </label>
            <div className="stream-style-grid">
              <label className="stream-style-field">
                <span>Largura px</span>
                <input
                  type="number"
                  min={64}
                  max={7680}
                  value={frame.w}
                  onChange={(e) => setFrameSize(Number(e.target.value) || FRAME_W, frame.h)}
                />
              </label>
              <label className="stream-style-field">
                <span>Altura px</span>
                <input
                  type="number"
                  min={64}
                  max={7680}
                  value={frame.h}
                  onChange={(e) => setFrameSize(frame.w, Number(e.target.value) || FRAME_H)}
                />
              </label>
            </div>
            <p className="stream-hint"><strong>Layout dos painéis</strong></p>
            <div className="stream-dock-row">
              <button
                type="button"
                className={ws.dock === 'lcr' ? 'is-active' : ''}
                title="Ferramentas | Canvas | Camadas"
                onClick={() => setDock('lcr')}
              >
                <Columns2 size={14} /> Centro
              </button>
              <button
                type="button"
                className={ws.dock === 'clr' ? 'is-active' : ''}
                title="Canvas à esquerda, painéis à direita"
                onClick={() => setDock('clr')}
              >
                <PanelRight size={14} /> Canvas esq.
              </button>
              <button
                type="button"
                className={ws.dock === 'lrc' ? 'is-active' : ''}
                title="Painéis à esquerda, canvas à direita"
                onClick={() => setDock('lrc')}
              >
                <PanelLeft size={14} /> Canvas dir.
              </button>
            </div>
            <p className="stream-hint">Arraste as bordas dos painéis para largura. Zoom/pan e laterais são lembrados neste navegador.</p>
          </div>

          <div className="stream-gt-add">
            <button type="button" className="stream-primary-btn" onClick={() => addBlock('card')}>
              <Plus size={15} /> Bloco
            </button>
            <button type="button" className="stream-primary-btn" onClick={() => addBlock('table')}>
              <Plus size={15} /> Tabela
            </button>
          </div>
          <p className="stream-hint">Blocos vazios. Arraste no canvas ou digite X/Y.</p>

          {selectedBlock?.type === 'card' ? (
            <div className="stream-gt-tool-section">
              <p className="stream-hint"><strong>Conteúdo do bloco</strong></p>
              <div className="stream-add-layer-row">
                {LAYER_TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => addLayer(t.id)}>+ {t.label}</button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="stream-inspector-body">
            {!selectedBlock ? (
              <p className="stream-hint">Selecione um bloco na área de trabalho.</p>
            ) : (
              <>
                <label className="stream-field">
                  <span>Nome</span>
                  <input
                    value={selectedBlock.name}
                    onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, name: e.target.value }))}
                  />
                </label>

                <p className="stream-hint"><strong>Posição e tamanho</strong></p>
                <div className="stream-style-grid">
                  <label className="stream-style-field">
                    <span>X</span>
                    <input
                      type="number"
                      value={selectedBlock.x ?? 0}
                      onChange={(e) => {
                        const size = blockSize(selectedBlock)
                        const next = clampPos(Number(e.target.value) || 0, selectedBlock.y ?? 0, size.w, size.h)
                        updateBlock(selectedBlock.id, (b) => ({ ...b, x: next.x, y: next.y }))
                      }}
                    />
                  </label>
                  <label className="stream-style-field">
                    <span>Y</span>
                    <input
                      type="number"
                      value={selectedBlock.y ?? 0}
                      onChange={(e) => {
                        const size = blockSize(selectedBlock)
                        const next = clampPos(selectedBlock.x ?? 0, Number(e.target.value) || 0, size.w, size.h)
                        updateBlock(selectedBlock.id, (b) => ({ ...b, x: next.x, y: next.y }))
                      }}
                    />
                  </label>
                  <label className="stream-style-field">
                    <span>Largura</span>
                    <input
                      type="number"
                      min={40}
                      max={frame.w}
                      value={selectedBlock.type === 'card' ? ensureCardLayers(selectedBlock).canvasW : selectedBlock.tableW || 420}
                      onChange={(e) => {
                        const w = Math.max(40, Number(e.target.value) || 40)
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'card'
                            ? { ...ensureCardLayers(b), canvasW: w }
                            : { ...b, tableW: w },
                        )
                      }}
                    />
                  </label>
                  <label className="stream-style-field">
                    <span>Altura</span>
                    <input
                      type="number"
                      min={40}
                      max={frame.h}
                      value={selectedBlock.type === 'card' ? ensureCardLayers(selectedBlock).canvasH : 200}
                      disabled={selectedBlock.type === 'table'}
                      onChange={(e) => {
                        if (selectedBlock.type !== 'card') return
                        const h = Math.max(40, Number(e.target.value) || 40)
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'card' ? { ...ensureCardLayers(b), canvasH: h } : b,
                        )
                      }}
                    />
                  </label>
                </div>
                <p className="stream-hint">Segure e arraste o bloco no canvas, ou digite X/Y acima.</p>

                <p className="stream-hint"><strong>Fundo</strong></p>
                <BoxStyleEditor
                  allowImage={selectedBlock.type === 'card'}
                  value={selectedBlock.box}
                  onChange={(box) => updateBlock(selectedBlock.id, (b) => ({ ...b, box }))}
                />
                <TransitionEditor
                  mode={selectedBlock.type === 'card' ? 'card' : 'table'}
                  value={selectedBlock.transition}
                  onChange={(transition) => updateBlock(selectedBlock.id, (b) => ({ ...b, transition }))}
                />

                {selectedBlock.type === 'card' ? (
                  <p className="stream-hint"><strong>Itens</strong> — adicione texto, número, logo ou imagem e vincule à planilha na lista de camadas.</p>
                ) : null}

                {selectedBlock.type === 'table' ? (
                  <>
                    <p className="stream-hint"><strong>Tabela</strong></p>
                    <label className="stream-field">
                      <span>Fonte de dados</span>
                      <select
                        value={selectedBlock.data.source}
                        onChange={(e) =>
                          updateBlock(selectedBlock.id, (b) =>
                            b.type === 'table'
                              ? { ...b, data: { ...b.data, source: e.target.value as StreamTableBlock['data']['source'] } }
                              : b,
                          )
                        }
                      >
                        <option value="classificacao">Classificação</option>
                        <option value="mvp">MVP</option>
                        <option value="equipes">Equipes</option>
                      </select>
                    </label>
                    <div className="stream-style-grid">
                      <label className="stream-style-field">
                        <span>Linhas</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={selectedBlock.data.rows}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, (b) =>
                              b.type === 'table' ? { ...b, data: { ...b.data, rows: Number(e.target.value) || 10 } } : b,
                            )
                          }
                        />
                      </label>
                      <label className="stream-style-field">
                        <span>Rank inicial</span>
                        <input
                          type="number"
                          min={1}
                          value={selectedBlock.data.startRank}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, (b) =>
                              b.type === 'table' ? { ...b, data: { ...b.data, startRank: Number(e.target.value) || 1 } } : b,
                            )
                          }
                        />
                      </label>
                      <label className="stream-style-field">
                        <span>Altura linha</span>
                        <input
                          type="number"
                          min={20}
                          max={80}
                          value={selectedBlock.data.rowHeight ?? 36}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, (b) =>
                              b.type === 'table' ? { ...b, data: { ...b.data, rowHeight: Number(e.target.value) || 36 } } : b,
                            )
                          }
                        />
                      </label>
                      <label className="stream-style-field">
                        <span>Espaço linhas</span>
                        <input
                          type="number"
                          min={0}
                          max={24}
                          value={selectedBlock.data.rowGap ?? 0}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, (b) =>
                              b.type === 'table' ? { ...b, data: { ...b.data, rowGap: Number(e.target.value) || 0 } } : b,
                            )
                          }
                        />
                      </label>
                      <label className="stream-style-field">
                        <span>Altura header</span>
                        <input
                          type="number"
                          min={20}
                          max={64}
                          value={selectedBlock.data.headerHeight ?? 32}
                          onChange={(e) =>
                            updateBlock(selectedBlock.id, (b) =>
                              b.type === 'table' ? { ...b, data: { ...b.data, headerHeight: Number(e.target.value) || 32 } } : b,
                            )
                          }
                        />
                      </label>
                    </div>
                    <FieldStyleEditor
                      value={selectedBlock.data.headerStyle}
                      onChange={(headerStyle) =>
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'table' ? { ...b, data: { ...b.data, headerStyle } } : b,
                        )
                      }
                    />
                    <FieldStyleEditor
                      value={selectedBlock.data.rowStyle}
                      onChange={(rowStyle) =>
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'table' ? { ...b, data: { ...b.data, rowStyle } } : b,
                        )
                      }
                    />
                  </>
                ) : null}

                <div className="stream-block-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="stream-secondary-btn" onClick={() => dupBlock(selectedBlock.id)}>
                    <Copy size={14} /> Duplicar
                  </button>
                  <button type="button" className="stream-secondary-btn" onClick={() => removeBlock(selectedBlock.id)}>
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        <div
          className="stream-gt-resizer"
          style={{ gridArea: 'h1' }}
          onPointerDown={(e) => onPanelResizeStart(ws.dock === 'lrc' ? 'tools' : ws.dock === 'clr' ? 'tools' : 'tools', e)}
          title="Arraste para redimensionar painel"
        />

        {/* CANVAS — frame do produto final */}
        <main className="stream-gt-stage" ref={stageRef} style={{ gridArea: 'stage' }}>
          <div className="stream-gt-zoombar">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.15, z - 0.1))} title="Zoom -"><ZoomOut size={16} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} title="Zoom +"><ZoomIn size={16} /></button>
            <button type="button" onClick={() => { setZoom(0.55); setPan({ x: 0, y: 0 }) }}>Reset</button>
            <span className="stream-hint">{frame.w}×{frame.h} · scroll=zoom · botão direito=mover · Ctrl+Z=desfazer</span>
          </div>

          <div
            className={`stream-gt-stage-inner ${panning ? 'is-panning' : ''}`}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerLeave={onStagePointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              className="stream-gt-world"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              <div
                className="stream-gt-frame"
                aria-label={`Área final ${frame.w}×${frame.h}`}
                style={{ width: frame.w, height: frame.h }}
              >
                <div className="stream-gt-frame-badge">{frame.w}×{frame.h}</div>
                <div className="stream-gt-checker">
                  {!overlay.blocks.length ? (
                    <div className="stream-gt-empty">
                      <p>Área de trabalho {frame.w}×{frame.h}</p>
                      <p className="stream-hint">Fundo quadriculado = transparente no live.</p>
                      <p className="stream-hint">Use + Bloco e arraste na área. Formato em Ferramentas.</p>
                    </div>
                  ) : (
                    <div className="stream-gt-blocks stream-gt-blocks-abs">
                      {overlay.blocks.map((block) => {
                        const selected = selectedBlockId === block.id
                        const bx = block.x ?? 40
                        const by = block.y ?? 40
                        if (block.type === 'card') {
                          const card = ensureCardLayers(block)
                          return (
                            <div
                              key={block.id}
                              className={`stream-gt-block ${selected ? 'is-selected' : ''} ${draggingId === block.id ? 'is-dragging' : ''}`}
                              style={{
                                left: bx,
                                top: by,
                                width: card.canvasW,
                                height: card.canvasH,
                              }}
                              onPointerDown={(e) => onBlockPointerDown(e, block)}
                              onClick={() => {
                                setSelectedBlockId(block.id)
                              }}
                            >
                              <div className="stream-gt-block-label">{block.name}</div>
                              <CardLayerCanvas
                                card={card}
                                ctx={ctx}
                                editable={selected}
                                selectedLayerId={selected ? selectedLayerId : null}
                                onSelectLayer={(id) => {
                                  setSelectedBlockId(block.id)
                                  setSelectedLayerId(id)
                                  setOpenLayerMenu(id)
                                }}
                              />
                            </div>
                          )
                        }
                        const box = boxToCssSafe(block.box)
                        const header = fieldToCss(block.data.headerStyle)
                        const rowStyle = fieldToCss(block.data.rowStyle)
                        const source = block.data.source === 'mvp' ? mvpRows : standings
                        const start = block.data.startRank || 1
                        const rows = source.filter((r) => r.pos >= start).slice(0, block.data.rows)
                        const rh = block.data.rowHeight ?? 36
                        const gap = block.data.rowGap ?? 0
                        const tw = block.tableW || 420
                        return (
                          <div
                            key={block.id}
                            className={`stream-gt-block stream-gt-table-block ${selected ? 'is-selected' : ''} ${draggingId === block.id ? 'is-dragging' : ''}`}
                            style={{ left: bx, top: by, width: tw, ...box }}
                            onPointerDown={(e) => onBlockPointerDown(e, block)}
                            onClick={() => {
                              setSelectedBlockId(block.id)
                              setSelectedLayerId(null)
                            }}
                          >
                            <div className="stream-gt-block-label">{block.name}</div>
                            <div
                              className="stream-prev-table-head"
                              style={{ ...header.wrap, ...header.text, minHeight: block.data.headerHeight ?? 32 }}
                            >
                              {block.data.columns.map((c) => (
                                <span key={c}>{c === 'pos' ? '#' : c === 'nome' ? 'Nome' : c.toUpperCase()}</span>
                              ))}
                            </div>
                            {rows.map((row, i) => (
                              <div
                                key={`${row.pos}-${row.nome}`}
                                className="stream-prev-table-row"
                                style={{
                                  ...rowStyle.wrap,
                                  ...rowStyle.text,
                                  minHeight: rh,
                                  marginBottom: gap,
                                  backgroundColor:
                                    i % 2 === 1 && block.data.altRowFill
                                      ? block.data.altRowFill
                                      : (rowStyle.wrap.backgroundColor as string | undefined),
                                }}
                              >
                                {block.data.columns.map((col) => {
                                  if (col === 'pos') return <span key={col}>{String(row.pos).padStart(2, '0')}</span>
                                  if (col === 'logo') {
                                    return (
                                      <span key={col} className="col-logo">
                                        {row.logo ? <img src={row.logo} alt="" /> : <i />}
                                      </span>
                                    )
                                  }
                                  if (col === 'nome') return <span key={col} className="col-nome">{row.nome}</span>
                                  if (col === 'pts') return <span key={col} className="col-pts">{row.pts}</span>
                                  if (col === 'abates') return <span key={col}>{row.abates}</span>
                                  if (col === 'booyah') return <span key={col}>{row.booyah}</span>
                                  if (col === 'delta') return <span key={col}>{row.delta || '0'}</span>
                                  if (col === 'quedas') return <span key={col}>{row.quedas || '0'}</span>
                                  if (col === 'kd') return <span key={col}>{row.kd || '0'}</span>
                                  return <span key={col} />
                                })}
                              </div>
                            ))}
                            {!rows.length ? <div className="stream-prev-empty">Sem dados</div> : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        <div
          className="stream-gt-resizer"
          style={{ gridArea: 'h2' }}
          onPointerDown={(e) => onPanelResizeStart(ws.dock === 'lrc' ? 'layers' : 'layers', e)}
          title="Arraste para redimensionar painel"
        />

        {/* CAMADAS */}
        <aside className="stream-gt-right stream-panel" style={{ gridArea: 'layers' }}>
          <div className="stream-gt-layer-head">
            <strong>Camadas</strong>
            {selectedBlock ? (
              <div className="stream-block-actions">
                <button type="button" title="Duplicar" onClick={() => dupBlock(selectedBlock.id)}><Copy size={14} /></button>
                <button type="button" className="danger" title="Excluir" onClick={() => removeBlock(selectedBlock.id)}><Trash2 size={14} /></button>
              </div>
            ) : null}
          </div>

          {!overlay.blocks.length ? (
            <p className="stream-hint">Nenhum bloco. Use + Bloco em Ferramentas.</p>
          ) : (
            <ul className="stream-gt-layer-list stream-gt-block-tree">
              {overlay.blocks.map((block) => {
                const isSel = selectedBlockId === block.id
                const isCard = block.type === 'card'
                const card = isCard ? ensureCardLayers(block) : null
                const expanded = isSel
                return (
                  <li key={block.id} className={isSel ? 'is-active' : ''}>
                    <button
                      type="button"
                      className="stream-gt-layer-row stream-gt-folder-row"
                      onClick={() => {
                        setSelectedBlockId(block.id)
                        setSelectedLayerId(null)
                        setOpenLayerMenu(null)
                      }}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>
                        <small>{block.type === 'card' ? 'bloco' : 'tabela'}</small>
                        {block.name}
                      </span>
                      <em>
                        {isCard
                          ? `${Math.round(block.x ?? 0)},${Math.round(block.y ?? 0)} · ${card?.layers.length ?? 0} itens`
                          : `${Math.round(block.x ?? 0)},${Math.round(block.y ?? 0)}`}
                      </em>
                    </button>

                    {expanded && isCard && card ? (
                      <div className="stream-gt-folder-children">
                        <div className="stream-add-layer-row">
                          {LAYER_TYPES.map((t) => (
                            <button key={t.id} type="button" onClick={() => addLayer(t.id)}>+ {t.label}</button>
                          ))}
                        </div>
                        <ul className="stream-gt-layer-list">
                          {card.layers
                            .slice()
                            .sort((a, b) => b.z - a.z)
                            .map((layer) => {
                              const open = openLayerMenu === layer.id
                              const bound =
                                layer.data.source === 'cell'
                                  ? layer.data.display || `${layer.data.sheetId}.${layer.data.colKey}`
                                  : layer.data.source === 'fixed'
                                    ? layer.data.value || 'fixo'
                                    : layer.data.source
                              return (
                                <li key={layer.id} className={selectedLayerId === layer.id ? 'is-active' : ''}>
                                  <button
                                    type="button"
                                    className="stream-gt-layer-row"
                                    onClick={() => {
                                      setSelectedLayerId(layer.id)
                                      setOpenLayerMenu(open ? null : layer.id)
                                    }}
                                  >
                                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <span>
                                      <small>{layer.type}</small>
                                      {layer.name}
                                    </span>
                                    <em>{bound}</em>
                                  </button>
                                  {open ? (
                                    <div className="stream-gt-layer-drawer">
                                      <label className="stream-field">
                                        <span>Nome</span>
                                        <input value={layer.name} onChange={(e) => updateLayer(layer.id, { name: e.target.value })} />
                                      </label>
                                      <div className="stream-style-grid">
                                        {(['x', 'y', 'w', 'h', 'z'] as const).map((k) => (
                                          <label key={k} className="stream-style-field">
                                            <span>{k.toUpperCase()}</span>
                                            <input
                                              type="number"
                                              value={layer[k]}
                                              onChange={(e) => updateLayer(layer.id, { [k]: Number(e.target.value) || 0 })}
                                            />
                                          </label>
                                        ))}
                                      </div>
                                      {(layer.type === 'image' || layer.type === 'logo') ? (
                                        <LayerImageUpload
                                          label={layer.type === 'logo' ? 'Logo / arte (upload PC)' : 'Imagem livre (upload PC)'}
                                          value={layer.data.source === 'fixed' ? layer.data.value : ''}
                                          onChange={(url) => updateLayer(layer.id, { data: { source: 'fixed', value: url } })}
                                        />
                                      ) : (
                                        <label className="stream-field">
                                          <span>Texto livre</span>
                                          <input
                                            value={layer.data.source === 'fixed' ? layer.data.value : ''}
                                            placeholder="Ex.: TABELA GERAL, nome do campeonato…"
                                            onChange={(e) => updateLayer(layer.id, { data: { source: 'fixed', value: e.target.value } })}
                                          />
                                        </label>
                                      )}
                                      <CellPicker
                                        sheets={sheets}
                                        value={layer.data.source === 'cell' ? layer.data : undefined}
                                        onPick={(pick) => {
                                          updateLayer(layer.id, {
                                            data: {
                                              source: 'cell',
                                              sheetId: pick.sheetId,
                                              colKey: pick.colKey,
                                              rowIndex: pick.rowIndex,
                                              display: pick.display,
                                            },
                                          })
                                        }}
                                      />
                                      <p className="stream-hint"><strong>Fundo do item</strong> — cor ou imagem do PC</p>
                                      <FieldStyleEditor
                                        value={layer.style}
                                        allowImage
                                        hideText={layer.type === 'image' || layer.type === 'logo'}
                                        onChange={(style) => updateLayer(layer.id, { style })}
                                      />
                                      {(layer.type === 'image' || layer.type === 'logo') ? (
                                        <label className="stream-field">
                                          <span>Ajuste da imagem</span>
                                          <select
                                            value={layer.objectFit || (layer.type === 'logo' ? 'contain' : 'cover')}
                                            onChange={(e) =>
                                              updateLayer(layer.id, {
                                                objectFit: e.target.value as 'cover' | 'contain',
                                              })
                                            }
                                          >
                                            <option value="contain">Conter (logo)</option>
                                            <option value="cover">Cobrir</option>
                                          </select>
                                        </label>
                                      ) : null}
                                      <button type="button" className="stream-secondary-btn" onClick={() => removeLayer(layer.id)}>
                                        <Trash2 size={14} /> Remover
                                      </button>
                                    </div>
                                  ) : null}
                                </li>
                              )
                            })}
                        </ul>
                      </div>
                    ) : null}

                    {expanded && block.type === 'table' ? (
                      <div className="stream-gt-folder-children">
                        <p className="stream-hint">Tabela: ajuste altura, espaçamento e fonte em <strong>Ferramentas</strong>.</p>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
