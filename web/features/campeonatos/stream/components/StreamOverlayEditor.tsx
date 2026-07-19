'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Columns2,
  Copy,
  GripVertical,
  Library,
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
import { saveOverlayAsCatalogModel } from '../services/stream-catalog.service'
import type {
  LayerContentType,
  StreamBlock,
  StreamCardBlock,
  StreamLayer,
  StreamOverlay,
  StreamSheetId,
  StreamSheetRow,
  StreamTableBlock,
  TableBlockData,
  TableColumnKey,
  TablePartSelection,
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

import { BoxStyleEditor, FieldStyleEditor, LayerImageUpload, TransitionEditor } from './editor/StylePanels'
import { CellPicker } from './editor/CellPicker'
import { CardLayerCanvas } from './CardLayerCanvas'
import { StreamTableCanvas } from './StreamTableCanvas'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import {
  addTableColumn,
  createSeedRowItem,
  ensureTableStructure,
  fieldLabel,
  scaleTableBlock,
  tableOuterWidth,
  updateTableColumn,
} from '../utils/table-structure'
import { exitTransitionClass, transitionClass, transitionStyle } from '../utils/stream-style'
import { TablePartInspector } from './editor/TableSidebarPanel'
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

const LAYER_TYPE_BADGE: Record<LayerContentType, string> = {
  image: 'IMG',
  logo: 'LOGO',
  text: 'TXT',
  number: 'Nº',
}

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
  /** Parte interna da tabela: legenda, linha modelo ou coluna */
  const [selectedTablePart, setSelectedTablePart] = useState<TablePartSelection | null>(null)
  /** Preview de transição no canvas (entrada / saída). */
  const [animPreview, setAnimPreview] = useState<{
    blockId: string
    kind: 'enter' | 'exit'
    token: number
  } | null>(null)
  /** Passo de escala da tabela (% aplicado em − / +). */
  const [scaleStepPct, setScaleStepPct] = useState('10')

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
  /** rascunho dos inputs numéricos (permite apagar e digitar) */
  const [sizeDraft, setSizeDraft] = useState<{ w?: string; h?: string; x?: string; y?: string }>({})
  const dragList = useRef<{ kind: 'block' | 'layer' | 'table-row'; id: string; fromIndex: number } | null>(null)
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

  // Trava scroll só nesta tela (classe — não deixa overflow preso no sistema)
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add('stream-editor-scroll-lock')
    body.classList.add('stream-editor-scroll-lock')
    return () => {
      html.classList.remove('stream-editor-scroll-lock')
      body.classList.remove('stream-editor-scroll-lock')
      // limpa residual de style inline de versões antigas
      if (html.style.overflow === 'hidden') html.style.overflow = ''
      if (body.style.overflow === 'hidden') body.style.overflow = ''
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
  const selectedTable = selectedBlock?.type === 'table' ? ensureTableStructure(selectedBlock) : null
  const selectedLayer = selectedCard?.layers.find((l) => l.id === selectedLayerId) || null
  const selectedTableColumn =
    selectedTable && selectedTablePart?.kind === 'column'
      ? (selectedTable.data.columnDefs || []).find((c) => c.id === selectedTablePart.id) || null
      : null

  function selectBlockOnly(blockId: string) {
    setSelectedBlockId(blockId)
    setSelectedLayerId(null)
    setSelectedTablePart(null)
  }

  function patchSelectedTableData(
    fn: (data: TableBlockData) => TableBlockData,
    history: 'soft' | 'force' = 'soft',
  ) {
    if (!selectedTable) return
    updateBlock(
      selectedTable.id,
      (b) => {
        if (b.type !== 'table') return b
        const t = ensureTableStructure(b)
        return { ...t, data: fn(t.data) }
      },
      { history },
    )
  }

  function tablePartLabel(part: TablePartSelection | null): string {
    if (!part) return 'Tabela'
    if (part.kind === 'header') return 'Legenda'
    if (part.kind === 'row') return 'Linha modelo'
    return selectedTableColumn?.label || fieldLabel(selectedTableColumn?.field || '') || 'Coluna'
  }

  function previewBlockTransition(kind: 'enter' | 'exit') {
    if (!selectedBlock) return
    const token = Date.now()
    setAnimPreview({ blockId: selectedBlock.id, kind, token })
    const ms = Math.max(200, selectedBlock.transition?.durationMs || 400) + (selectedBlock.transition?.delayMs || 0) + 80
    window.setTimeout(() => {
      setAnimPreview((cur) => (cur?.token === token ? null : cur))
    }, ms)
  }

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
      selectBlockOnly(card.id)
      return
    }
    // Etapa 1: 1 linha + colunas vazias — usuário vincula cada coluna na planilha (igual bloco).
    const seedRow = createSeedRowItem('Linha 1')
    const cols = [
      { id: newBlockId(), field: '', label: 'Coluna 1', widthPx: 200, align: 'left' as const },
    ]
    const rawTable: StreamTableBlock = {
      id: newBlockId(),
      type: 'table',
      name: `Tabela ${overlay.blocks.filter((b) => b.type === 'table').length + 1}`,
      x: 48 + offset,
      y: 48 + offset,
      tableW: 520,
      box: {
        fill: { mode: 'none', color: 'transparent' },
        borderColor: '#c9a227',
        borderWidth: 1,
        borderRadius: 4,
        padding: 0,
      },
      transition: { ...DEFAULT_TRANSITION, enter: 'slide-up' },
      data: {
        variant: 'standings',
        source: 'equipes_geral',
        rows: 1,
        startRank: 1,
        columns: [],
        columnDefs: cols,
        rowItems: [seedRow],
        rowHeight: 36,
        rowGap: 0,
        headerHeight: 32,
        showHeader: true,
        altRowFill: 'rgba(255,255,255,0.04)',
      },
    }
    const table = ensureTableStructure(rawTable)
    patchOverlay((prev) => ({ ...prev, blocks: [...prev.blocks, table] }), 'force')
    selectBlockOnly(table.id)
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
    return { w: tableOuterWidth(ensureTableStructure(b)), h: 200 }
  }

  function removeBlock(id: string) {
    if (!overlay) return
    patchOverlay((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }), 'force')
    if (selectedBlockId === id) {
      setSelectedBlockId(null)
      setSelectedLayerId(null)
      setSelectedTablePart(null)
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
    const src = ensureTableStructure(block)
    const copy: StreamTableBlock = {
      ...src,
      id: newBlockId(),
      name: `${src.name} cópia`,
      x: (src.x ?? 40) + 24,
      y: (src.y ?? 40) + 24,
      data: {
        ...src.data,
        columnDefs: (src.data.columnDefs || []).map((c) => ({ ...c, id: newBlockId() })),
        rowItems: (src.data.rowItems || []).map((r, i) => ({
          ...r,
          id: newBlockId(),
          dataIndex: i,
        })),
      },
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
    setSelectedTablePart(null)
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
  }

  function reorderBlocks(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    patchOverlay((prev) => {
      const next = prev.blocks.slice()
      const [item] = next.splice(fromIndex, 1)
      if (!item) return prev
      next.splice(toIndex, 0, item)
      return { ...prev, blocks: next }
    }, 'force')
  }

  /** Reordena camadas: lista visual é z desc; ao soltar, renumera z. */
  function reorderLayers(cardId: string, fromVisualIndex: number, toVisualIndex: number) {
    if (fromVisualIndex === toVisualIndex) return
    updateBlock(
      cardId,
      (b) => {
        if (b.type !== 'card') return b
        const c = ensureCardLayers(b)
        const sorted = c.layers.slice().sort((a, b2) => b2.z - a.z)
        const [item] = sorted.splice(fromVisualIndex, 1)
        if (!item) return b
        sorted.splice(toVisualIndex, 0, item)
        // z alto = topo da lista
        const layers = sorted.map((layer, i) => ({ ...layer, z: sorted.length - i }))
        return { ...c, layers }
      },
      { history: 'force' },
    )
  }

  // ao trocar bloco selecionado, limpa rascunho de tamanho
  useEffect(() => {
    setSizeDraft({})
  }, [selectedBlockId])

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

  async function handleSaveAsModel() {
    if (!overlay) return
    try {
      await saveOverlayAsCatalogModel({
        name: overlay.name || 'Modelo',
        blocks: overlay.blocks,
        frameW: overlay.frameW,
        frameH: overlay.frameH,
        visibility: overlay.license_kind === 'purchased' ? 'private' : 'private',
        is_purchased_copy: overlay.license_kind === 'purchased',
        source_catalog_id: overlay.catalog_source_id,
        license_kind: overlay.license_kind || 'own',
      })
      setSaveWarning(
        overlay.license_kind === 'purchased'
          ? 'Salvo no catálogo como modelo comprado (privado — sem publicar/vender).'
          : 'Salvo em Meus modelos do catálogo.',
      )
      window.setTimeout(() => setSaveWarning(''), 3500)
    } catch (e: any) {
      setSaveWarning(e?.message || 'Falha ao salvar no catálogo (rode o SQL do catálogo?).')
    }
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
      setSelectedTablePart(null)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    selectBlockOnly(block.id)
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
          <button
            type="button"
            className="stream-secondary-btn"
            title="Salvar no catálogo de modelos"
            onClick={() => void handleSaveAsModel()}
          >
            <Library size={15} /> Salvar modelo
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
        {/* PROPRIEDADES (inspector contextual — como no Photoshop) */}
        <aside className="stream-gt-left stream-panel" style={{ gridArea: 'tools' }}>
          <div className="stream-gt-layer-head">
            <strong>Propriedades</strong>
          </div>

          <details className="stream-workspace-details" open={!selectedBlock}>
            <summary>Área de trabalho</summary>
            <div className="stream-gt-workspace-box">
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
                  title="Propriedades | Canvas | Camadas"
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
              <p className="stream-hint">Arraste as bordas dos painéis. Zoom/pan e laterais ficam salvos neste navegador.</p>
            </div>
          </details>

          <div className="stream-gt-add">
            <button type="button" className="stream-primary-btn" onClick={() => addBlock('card')}>
              <Plus size={14} /> Bloco
            </button>
            <button type="button" className="stream-primary-btn" onClick={() => addBlock('table')}>
              <Plus size={14} /> Tabela
            </button>
          </div>

          {selectedBlock ? (
            <p className="stream-inspector-crumb">
              <button
                type="button"
                onClick={() => {
                  setSelectedLayerId(null)
                  setSelectedTablePart(null)
                }}
                title="Editar o bloco / tabela"
              >
                {selectedBlock.name}
              </button>
              {selectedLayer ? (
                <>
                  <span aria-hidden>›</span>
                  <strong>{selectedLayer.name}</strong>
                </>
              ) : selectedTablePart ? (
                <>
                  <span aria-hidden>›</span>
                  <strong>{tablePartLabel(selectedTablePart)}</strong>
                </>
              ) : (
                <>
                  <span aria-hidden>›</span>
                  <strong>{selectedBlock.type === 'table' ? 'Tabela' : 'Bloco'}</strong>
                </>
              )}
            </p>
          ) : (
            <p className="stream-hint">Selecione um item na lista de camadas (direita) ou no canvas.</p>
          )}

          <div className="stream-inspector-body">
            {/* —— Parte da tabela (legenda / linha / coluna) —— */}
            {selectedTable && selectedTablePart ? (
              <TablePartInspector
                table={selectedTable}
                part={selectedTablePart}
                sheets={sheets}
                onPatchData={patchSelectedTableData}
                onClearPart={() => setSelectedTablePart(null)}
              />
            ) : null}

            {/* —— Camada (item) selecionada —— */}
            {selectedLayer && selectedCard ? (
              <>
                <details className="stream-inspector-section" open>
                  <summary>Conteúdo do item</summary>
                  <label className="stream-field">
                    <span>Nome</span>
                    <input
                      value={selectedLayer.name}
                      onChange={(e) => updateLayer(selectedLayer.id, { name: e.target.value })}
                    />
                  </label>
                  {(selectedLayer.type === 'image' || selectedLayer.type === 'logo') ? (
                    <LayerImageUpload
                      label={selectedLayer.type === 'logo' ? 'Logo / arte (upload PC)' : 'Imagem livre (upload PC)'}
                      value={selectedLayer.data.source === 'fixed' ? selectedLayer.data.value : ''}
                      onChange={(url) => updateLayer(selectedLayer.id, { data: { source: 'fixed', value: url } })}
                    />
                  ) : (
                    <label className="stream-field">
                      <span>Texto livre</span>
                      <input
                        value={selectedLayer.data.source === 'fixed' ? selectedLayer.data.value : ''}
                        placeholder="Ex.: TABELA GERAL, nome do campeonato…"
                        onChange={(e) => updateLayer(selectedLayer.id, { data: { source: 'fixed', value: e.target.value } })}
                      />
                    </label>
                  )}
                  <CellPicker
                    sheets={sheets}
                    value={selectedLayer.data.source === 'cell' ? selectedLayer.data : undefined}
                    onPick={(pick) => {
                      updateLayer(selectedLayer.id, {
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
                  {(selectedLayer.type === 'image' || selectedLayer.type === 'logo') ? (
                    <label className="stream-field">
                      <span>Ajuste da imagem</span>
                      <select
                        value={selectedLayer.objectFit || (selectedLayer.type === 'logo' ? 'contain' : 'cover')}
                        onChange={(e) =>
                          updateLayer(selectedLayer.id, {
                            objectFit: e.target.value as 'cover' | 'contain',
                          })
                        }
                      >
                        <option value="contain">Conter (logo)</option>
                        <option value="cover">Cobrir</option>
                      </select>
                    </label>
                  ) : null}
                </details>

                <details className="stream-inspector-section" open>
                  <summary>Posição e tamanho</summary>
                  <div className="stream-style-grid">
                    {([
                      { k: 'x' as const, label: 'X (px)' },
                      { k: 'y' as const, label: 'Y (px)' },
                      { k: 'w' as const, label: 'Larg. (px)' },
                      { k: 'h' as const, label: 'Alt. (px)' },
                      { k: 'z' as const, label: 'Z' },
                    ]).map(({ k, label }) => (
                      <label key={k} className="stream-style-field">
                        <span>{label}</span>
                        <input
                          type="number"
                          min={k === 'z' ? 0 : k === 'w' || k === 'h' ? 1 : 0}
                          value={selectedLayer[k]}
                          onChange={(e) => {
                            const raw = e.target.value
                            if (raw.trim() === '') {
                              updateLayer(selectedLayer.id, { [k]: k === 'w' || k === 'h' ? 1 : 0 })
                              return
                            }
                            const n = Number(raw)
                            if (!Number.isFinite(n)) return
                            updateLayer(selectedLayer.id, {
                              [k]: k === 'w' || k === 'h' ? Math.max(1, Math.round(n)) : Math.round(n),
                            })
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <p className="stream-hint">Medidas do item em pixels dentro do bloco. Z maior fica por cima.</p>
                </details>

                <details className="stream-inspector-section" open>
                  <summary>
                    {selectedLayer.type === 'image' || selectedLayer.type === 'logo'
                      ? 'Fundo e borda'
                      : 'Texto, fundo e borda'}
                  </summary>
                  <FieldStyleEditor
                    value={selectedLayer.style}
                    allowImage
                    hideText={selectedLayer.type === 'image' || selectedLayer.type === 'logo'}
                    onChange={(style) => updateLayer(selectedLayer.id, { style })}
                  />
                </details>

                <div className="stream-block-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="stream-secondary-btn"
                    onClick={() => setSelectedLayerId(null)}
                  >
                    Voltar ao bloco
                  </button>
                  <button
                    type="button"
                    className="stream-secondary-btn"
                    onClick={() => removeLayer(selectedLayer.id)}
                  >
                    <Trash2 size={14} /> Remover
                  </button>
                </div>
              </>
            ) : null}

            {/* —— Bloco / tabela selecionado (sem camada nem parte) —— */}
            {selectedBlock && !selectedLayer && !selectedTablePart ? (
              <>
                <details className="stream-inspector-section" open>
                  <summary>Identidade e tamanho</summary>
                  <label className="stream-field">
                    <span>Nome</span>
                    <input
                      value={selectedBlock.name}
                      onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, name: e.target.value }))}
                    />
                  </label>
                  <div className="stream-style-grid">
                    {(() => {
                      const size = blockSize(selectedBlock)
                      const curW = selectedBlock.type === 'card' ? ensureCardLayers(selectedBlock).canvasW : selectedBlock.tableW || 420
                      const curH = selectedBlock.type === 'card' ? ensureCardLayers(selectedBlock).canvasH : 200
                      const applyNum = (key: 'x' | 'y' | 'w' | 'h', raw: string) => {
                        setSizeDraft((d) => ({ ...d, [key]: raw }))
                        if (raw === '' || raw === '-') return
                        const n = Number(raw)
                        if (!Number.isFinite(n)) return
                        if (key === 'x' || key === 'y') {
                          const next = clampPos(
                            key === 'x' ? n : selectedBlock.x ?? 0,
                            key === 'y' ? n : selectedBlock.y ?? 0,
                            size.w,
                            size.h,
                          )
                          updateBlock(selectedBlock.id, (b) => ({ ...b, x: next.x, y: next.y }), { history: 'soft' })
                          return
                        }
                        if (key === 'w') {
                          const w = Math.max(1, Math.min(frame.w, Math.round(n)))
                          updateBlock(
                            selectedBlock.id,
                            (b) => (b.type === 'card' ? { ...ensureCardLayers(b), canvasW: w } : { ...b, tableW: w }),
                            { history: 'soft' },
                          )
                          return
                        }
                        if (selectedBlock.type === 'card') {
                          const h = Math.max(1, Math.min(frame.h, Math.round(n)))
                          updateBlock(
                            selectedBlock.id,
                            (b) => (b.type === 'card' ? { ...ensureCardLayers(b), canvasH: h } : b),
                            { history: 'soft' },
                          )
                        }
                      }
                      const blurNum = (key: 'x' | 'y' | 'w' | 'h') => {
                        setSizeDraft((d) => {
                          const next = { ...d }
                          delete next[key]
                          return next
                        })
                      }
                      return (
                        <>
                          <label className="stream-style-field">
                            <span>X (px)</span>
                            <input
                              type="number"
                              value={sizeDraft.x ?? String(selectedBlock.x ?? 0)}
                              onChange={(e) => applyNum('x', e.target.value)}
                              onBlur={() => blurNum('x')}
                            />
                          </label>
                          <label className="stream-style-field">
                            <span>Y (px)</span>
                            <input
                              type="number"
                              value={sizeDraft.y ?? String(selectedBlock.y ?? 0)}
                              onChange={(e) => applyNum('y', e.target.value)}
                              onBlur={() => blurNum('y')}
                            />
                          </label>
                          <label className="stream-style-field">
                            <span>Largura (px)</span>
                            <input
                              type="number"
                              min={1}
                              max={frame.w}
                              value={sizeDraft.w ?? String(curW)}
                              onChange={(e) => applyNum('w', e.target.value)}
                              onBlur={() => blurNum('w')}
                            />
                          </label>
                          <label className="stream-style-field">
                            <span>Altura (px)</span>
                            <input
                              type="number"
                              min={1}
                              max={frame.h}
                              value={sizeDraft.h ?? String(curH)}
                              disabled={selectedBlock.type === 'table'}
                              onChange={(e) => applyNum('h', e.target.value)}
                              onBlur={() => blurNum('h')}
                            />
                          </label>
                        </>
                      )
                    })()}
                  </div>
                  <p className="stream-hint">Todas as medidas em pixels. Arraste o bloco no canvas para mover.</p>
                </details>

                <details className="stream-inspector-section" open>
                  <summary>Fundo do bloco</summary>
                  <BoxStyleEditor
                    allowImage
                    value={selectedBlock.box}
                    onChange={(box) => updateBlock(selectedBlock.id, (b) => ({ ...b, box }))}
                  />
                </details>

                <details className="stream-inspector-section" open>
                  <summary>Animação / transição</summary>
                  <TransitionEditor
                    mode={selectedBlock.type === 'card' ? 'card' : 'table'}
                    value={selectedBlock.transition}
                    onChange={(transition) => updateBlock(selectedBlock.id, (b) => ({ ...b, transition }))}
                    onPreview={previewBlockTransition}
                  />
                </details>

                {selectedBlock.type === 'table' && selectedTable ? (
                  <details className="stream-inspector-section" open>
                    <summary>Painéis e escala</summary>
                    <div className="stream-style-grid">
                      <label className="stream-style-field">
                        <span>Painéis</span>
                        <div className="stream-num-stepper">
                          <button
                            type="button"
                            aria-label="Menos painéis"
                            onClick={() =>
                              patchSelectedTableData((d) => ({
                                ...d,
                                splitPanels: Math.max(1, (d.splitPanels || 1) - 1),
                              }))
                            }
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            value={selectedTable.data.splitPanels || 1}
                            onChange={(e) =>
                              patchSelectedTableData((d) => ({
                                ...d,
                                splitPanels: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                              }))
                            }
                          />
                          <button
                            type="button"
                            aria-label="Mais painéis"
                            onClick={() =>
                              patchSelectedTableData((d) => ({
                                ...d,
                                splitPanels: Math.min(6, (d.splitPanels || 1) + 1),
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </label>
                      <label className="stream-style-field">
                        <span>Linhas / painel</span>
                        <div className="stream-num-stepper">
                          <button
                            type="button"
                            aria-label="Menos linhas"
                            onClick={() => {
                              const cur =
                                selectedTable.data.rowsPerPanel ||
                                Math.ceil(
                                  (selectedTable.data.rows || 1) /
                                    Math.max(1, selectedTable.data.splitPanels || 1),
                                )
                              patchSelectedTableData((d) => ({
                                ...d,
                                rowsPerPanel: Math.max(1, cur - 1),
                              }))
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={40}
                            value={
                              selectedTable.data.rowsPerPanel ||
                              Math.ceil(
                                (selectedTable.data.rows || 1) /
                                  Math.max(1, selectedTable.data.splitPanels || 1),
                              )
                            }
                            onChange={(e) =>
                              patchSelectedTableData((d) => ({
                                ...d,
                                rowsPerPanel: Math.max(1, Math.min(40, Number(e.target.value) || 1)),
                              }))
                            }
                          />
                          <button
                            type="button"
                            aria-label="Mais linhas"
                            onClick={() => {
                              const cur =
                                selectedTable.data.rowsPerPanel ||
                                Math.ceil(
                                  (selectedTable.data.rows || 1) /
                                    Math.max(1, selectedTable.data.splitPanels || 1),
                                )
                              patchSelectedTableData((d) => ({
                                ...d,
                                rowsPerPanel: Math.min(40, cur + 1),
                              }))
                            }}
                          >
                            +
                          </button>
                        </div>
                      </label>
                      <label className="stream-style-field">
                        <span>Espaço (px)</span>
                        <div className="stream-num-stepper">
                          <button
                            type="button"
                            aria-label="Menos espaço"
                            onClick={() =>
                              patchSelectedTableData((d) => ({
                                ...d,
                                splitGapPx: Math.max(0, (d.splitGapPx || 0) - 4),
                              }))
                            }
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            value={selectedTable.data.splitGapPx ?? 0}
                            onChange={(e) =>
                              patchSelectedTableData((d) => ({
                                ...d,
                                splitGapPx: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                              }))
                            }
                          />
                          <button
                            type="button"
                            aria-label="Mais espaço"
                            onClick={() =>
                              patchSelectedTableData((d) => ({
                                ...d,
                                splitGapPx: Math.min(200, (d.splitGapPx || 0) + 4),
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </label>
                      <label className="stream-style-field">
                        <span>Escala (%)</span>
                        <div className="stream-num-stepper">
                          <button
                            type="button"
                            aria-label="Reduzir escala"
                            onClick={() => {
                              const pct = Math.max(1, Math.min(50, Number(scaleStepPct) || 10))
                              updateBlock(
                                selectedBlock.id,
                                (b) => (b.type === 'table' ? scaleTableBlock(b, 1 - pct / 100) : b),
                                { history: 'force' },
                              )
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={scaleStepPct}
                            title="Percentual a aplicar em − / +"
                            onChange={(e) => setScaleStepPct(e.target.value)}
                            onBlur={() => {
                              const n = Math.max(1, Math.min(50, Number(scaleStepPct) || 10))
                              setScaleStepPct(String(n))
                            }}
                          />
                          <button
                            type="button"
                            aria-label="Aumentar escala"
                            onClick={() => {
                              const pct = Math.max(1, Math.min(50, Number(scaleStepPct) || 10))
                              updateBlock(
                                selectedBlock.id,
                                (b) => (b.type === 'table' ? scaleTableBlock(b, 1 + pct / 100) : b),
                                { history: 'force' },
                              )
                            }}
                          >
                            +
                          </button>
                        </div>
                      </label>
                    </div>
                    <p className="stream-hint">
                      Escala: digite o % e use − / +. Painéis: top 1–6 | 7–12 com 2 painéis e 6 linhas.
                    </p>
                  </details>
                ) : null}

                {selectedBlock.type === 'card' ? (
                  <details className="stream-inspector-section" open>
                    <summary>Itens do bloco</summary>
                    <p className="stream-hint">Adicione e selecione na lista de camadas à direita para editar cada item.</p>
                    <div className="stream-add-layer-row">
                      {LAYER_TYPES.map((t) => (
                        <button key={t.id} type="button" onClick={() => addLayer(t.id)}>+ {t.label}</button>
                      ))}
                    </div>
                  </details>
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
            ) : null}
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
            <button type="button" onClick={() => setZoom((z) => Math.max(0.15, z - 0.1))} title="Zoom -"><ZoomOut size={14} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} title="Zoom +"><ZoomIn size={14} /></button>
            <button
              type="button"
              className="stream-zoom-reset"
              title="Resetar zoom e posição"
              onClick={() => { setZoom(0.55); setPan({ x: 0, y: 0 }) }}
            >
              Reset
            </button>
            <span className="stream-hint" title="scroll=zoom · botão direito=mover · Ctrl+Z=desfazer">
              {frame.w}×{frame.h}
            </span>
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
                        const preview =
                          animPreview?.blockId === block.id ? animPreview : null
                        const animCls = preview
                          ? preview.kind === 'enter'
                            ? transitionClass(block.transition)
                            : exitTransitionClass(block.transition)
                          : ''
                        const animStyle = preview
                          ? transitionStyle(block.transition, 0, preview.kind)
                          : undefined
                        if (block.type === 'card') {
                          const card = ensureCardLayers(block)
                          return (
                            <div
                              key={preview ? `${block.id}-anim-${preview.token}` : block.id}
                              className={`stream-gt-block ${selected ? 'is-selected' : ''} ${draggingId === block.id ? 'is-dragging' : ''} ${animCls}`}
                              style={{
                                left: bx,
                                top: by,
                                width: card.canvasW,
                                height: card.canvasH,
                                ...animStyle,
                              }}
                              onPointerDown={(e) => onBlockPointerDown(e, block)}
                              onClick={() => {
                                selectBlockOnly(block.id)
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
                                  setSelectedTablePart(null)
                                }}
                              />
                            </div>
                          )
                        }
                        const table = ensureTableStructure(block)
                        const tw = tableOuterWidth(table)
                        return (
                          <div
                            key={preview ? `${block.id}-anim-${preview.token}` : block.id}
                            className={`stream-gt-block stream-gt-table-block ${selected ? 'is-selected' : ''} ${draggingId === block.id ? 'is-dragging' : ''} ${animCls}`}
                            style={{ left: bx, top: by, width: tw, ...animStyle }}
                            onPointerDown={(e) => onBlockPointerDown(e, block)}
                            onClick={() => {
                              selectBlockOnly(block.id)
                            }}
                          >
                            <div className="stream-gt-block-label">{block.name}</div>
                            <StreamTableCanvas
                              table={table}
                              standings={standings}
                              mvpRows={mvpRows}
                              sheets={sheets}
                              editable={selected}
                            />
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

        {/* CAMADAS (lista estilo Photoshop) — blocos + partes da tabela */}
        <aside className="stream-gt-right stream-panel stream-gt-ps-layers" style={{ gridArea: 'layers' }}>
          <div className="stream-gt-layer-head">
            <strong>Camadas</strong>
            {selectedBlock ? (
              <div className="stream-block-actions">
                <button type="button" title="Duplicar bloco" onClick={() => dupBlock(selectedBlock.id)}><Copy size={14} /></button>
                <button type="button" className="danger" title="Excluir bloco" onClick={() => removeBlock(selectedBlock.id)}><Trash2 size={14} /></button>
              </div>
            ) : null}
          </div>

          {!overlay.blocks.length ? (
            <p className="stream-hint">Nenhum bloco. Use + Bloco em Propriedades.</p>
          ) : (
            <>
              <p className="stream-hint" style={{ marginBottom: 6 }}>
                Clique para selecionar e editar à esquerda. Arraste ≡ para reordenar.
              </p>
              <ul className="stream-gt-layer-list stream-gt-block-tree">
                {overlay.blocks.map((block, blockIndex) => {
                  const isSel = selectedBlockId === block.id
                  const isCard = block.type === 'card'
                  const isTable = block.type === 'table'
                  const card = isCard ? ensureCardLayers(block) : null
                  const tableBlk = isTable ? ensureTableStructure(block as StreamTableBlock) : null
                  const expanded = isSel && (isCard || isTable)
                  const rootActive = isSel && !selectedLayerId && !selectedTablePart
                  return (
                    <li
                      key={block.id}
                      className={rootActive ? 'is-active' : ''}
                      draggable
                      onDragStart={(e) => {
                        dragList.current = { kind: 'block', id: block.id, fromIndex: blockIndex }
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', `block:${block.id}`)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const d = dragList.current
                        if (!d || d.kind !== 'block') return
                        reorderBlocks(d.fromIndex, blockIndex)
                        dragList.current = null
                      }}
                      onDragEnd={() => {
                        dragList.current = null
                      }}
                    >
                      <button
                        type="button"
                        className="stream-gt-layer-row stream-gt-folder-row"
                        onClick={() => selectBlockOnly(block.id)}
                      >
                        <span className="stream-drag-handle" title="Arrastar para reordenar" aria-hidden>
                          <GripVertical size={13} />
                        </span>
                        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>
                          <small>{isCard ? 'bloco' : 'tabela'}</small>
                          {block.name}
                        </span>
                        <em>
                          {isCard
                            ? `${card?.layers.length ?? 0} itens`
                            : tableBlk
                              ? `${tableBlk.data.rows || 1}×${(tableBlk.data.columnDefs || []).length}`
                              : ''}
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
                              .map((layer, layerIndex) => {
                                const layerActive = selectedLayerId === layer.id
                                const bound =
                                  layer.data.source === 'cell'
                                    ? layer.data.display || `${layer.data.sheetId}.${layer.data.colKey}`
                                    : layer.data.source === 'fixed'
                                      ? (layer.data.value
                                        ? (String(layer.data.value).length > 22
                                          ? `${String(layer.data.value).slice(0, 18)}…`
                                          : layer.data.value)
                                        : 'fixo')
                                      : layer.data.source
                                return (
                                  <li
                                    key={layer.id}
                                    className={layerActive ? 'is-active' : ''}
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation()
                                      dragList.current = { kind: 'layer', id: layer.id, fromIndex: layerIndex }
                                      e.dataTransfer.effectAllowed = 'move'
                                      e.dataTransfer.setData('text/plain', `layer:${layer.id}`)
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      e.dataTransfer.dropEffect = 'move'
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const d = dragList.current
                                      if (!d || d.kind !== 'layer') return
                                      reorderLayers(block.id, d.fromIndex, layerIndex)
                                      dragList.current = null
                                    }}
                                    onDragEnd={() => {
                                      dragList.current = null
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="stream-gt-layer-row"
                                      onClick={() => {
                                        setSelectedBlockId(block.id)
                                        setSelectedLayerId(layer.id)
                                        setSelectedTablePart(null)
                                      }}
                                    >
                                      <span className="stream-drag-handle" title="Arrastar camada" aria-hidden>
                                        <GripVertical size={13} />
                                      </span>
                                      <span
                                        className={`stream-gt-layer-type-icon is-${layer.type}`}
                                        title={layer.type}
                                      >
                                        {LAYER_TYPE_BADGE[layer.type]}
                                      </span>
                                      <span>
                                        <small>{layer.type}</small>
                                        {layer.name}
                                      </span>
                                      <em>{bound}</em>
                                    </button>
                                  </li>
                                )
                              })}
                          </ul>
                        </div>
                      ) : null}

                      {expanded && isTable && tableBlk ? (
                        <div className="stream-gt-folder-children">
                          <ul className="stream-gt-layer-list">
                            <li className={selectedTablePart?.kind === 'header' ? 'is-active' : ''}>
                              <button
                                type="button"
                                className="stream-gt-layer-row"
                                onClick={() => {
                                  setSelectedBlockId(block.id)
                                  setSelectedLayerId(null)
                                  setSelectedTablePart({ kind: 'header' })
                                }}
                              >
                                <span className="stream-drag-handle" aria-hidden style={{ opacity: 0.35 }}>
                                  <GripVertical size={13} />
                                </span>
                                <span className="stream-gt-layer-type-icon is-text" title="Legenda">HD</span>
                                <span>
                                  <small>legenda</small>
                                  Cabeçalho
                                </span>
                                <em>{tableBlk.data.showHeader === false ? 'oculto' : `${tableBlk.data.headerHeight ?? 32}px`}</em>
                              </button>
                            </li>
                            <li className={selectedTablePart?.kind === 'row' ? 'is-active' : ''}>
                              <button
                                type="button"
                                className="stream-gt-layer-row"
                                onClick={() => {
                                  setSelectedBlockId(block.id)
                                  setSelectedLayerId(null)
                                  setSelectedTablePart({ kind: 'row' })
                                }}
                              >
                                <span className="stream-drag-handle" aria-hidden style={{ opacity: 0.35 }}>
                                  <GripVertical size={13} />
                                </span>
                                <span className="stream-gt-layer-type-icon is-block" title="Linha">LN</span>
                                <span>
                                  <small>linha</small>
                                  Linha modelo
                                </span>
                                <em>{tableBlk.data.rows || 1}× · {tableBlk.data.rowHeight ?? 36}px</em>
                              </button>
                            </li>
                            {(tableBlk.data.columnDefs || []).map((col) => {
                              const colActive =
                                selectedTablePart?.kind === 'column' && selectedTablePart.id === col.id
                              return (
                                <li key={col.id} className={colActive ? 'is-active' : ''}>
                                  <button
                                    type="button"
                                    className="stream-gt-layer-row"
                                    onClick={() => {
                                      setSelectedBlockId(block.id)
                                      setSelectedLayerId(null)
                                      setSelectedTablePart({ kind: 'column', id: col.id })
                                    }}
                                  >
                                    <span className="stream-drag-handle" aria-hidden style={{ opacity: 0.35 }}>
                                      <GripVertical size={13} />
                                    </span>
                                    <span className="stream-gt-layer-type-icon is-number" title="Coluna">COL</span>
                                    <span>
                                      <small>coluna</small>
                                      {col.label || fieldLabel(col.field) || 'Coluna'}
                                    </span>
                                    <em>
                                      {col.field
                                        ? `${col.field} · ${col.widthPx || 0}px`
                                        : `sem vínculo · ${col.widthPx || 0}px`}
                                    </em>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                          <div className="stream-add-layer-row" style={{ marginTop: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                let createdId: string | null = null
                                updateBlock(
                                  block.id,
                                  (b) => {
                                    if (b.type !== 'table') return b
                                    const t = ensureTableStructure(b)
                                    const tw = t.tableW || 520
                                    const next = addTableColumn(t.data, '', tw)
                                    createdId = next.columnDefs?.[next.columnDefs.length - 1]?.id || null
                                    if (createdId) {
                                      return {
                                        ...t,
                                        data: updateTableColumn(
                                          next,
                                          createdId,
                                          {
                                            field: '',
                                            label: `Coluna ${next.columnDefs?.length || 1}`,
                                            asImage: false,
                                          },
                                          tw,
                                        ),
                                      }
                                    }
                                    return { ...t, data: next }
                                  },
                                  { history: 'force' },
                                )
                                setSelectedBlockId(block.id)
                                setSelectedLayerId(null)
                                if (createdId) setSelectedTablePart({ kind: 'column', id: createdId })
                              }}
                            >
                              + Coluna
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
