'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Copy, Download, ImagePlus, Loader2, Maximize2, Minus, Plus, Trash2 } from 'lucide-react'
import JSZip from 'jszip'
import { StreamPackageStage } from './StreamPackageStage'
import { loadStreamPackageRenderData } from '../services/stream-package-data.service'
import { renderStreamOutputCanvas } from '../services/stream-output-canvas-renderer'
import {
  STREAM_ARTWORK_DESIGN_HEIGHT,
  STREAM_ARTWORK_DESIGN_WIDTH,
  streamOutputArtworkArea,
  streamOutputArtworkBounds,
  streamOutputArtworkEffectiveSize,
} from '../services/stream-output-artwork-geometry'
import { resolveStreamAsset, resolveStreamCardConfig, resolveStreamLayoutConfig, resolveStreamLooseImageConfig, resolveStreamLooseTextConfig, resolveStreamOverlayConfig, resolveStreamTableConfig } from '../services/stream-package-config'
import { uploadPublicFile } from '@/lib/upload-public'
import {
  cropStreamOutputCanvas,
  downloadStreamOutputBlob,
  sanitizeStreamOutputFilename,
  streamOutputCanvasToBlob,
} from '../services/stream-output-export'
import {
  DEFAULT_STREAM_PACKAGE_SHARED_CONFIG,
  STREAM_OVERLAY_COLUMN_META,
  STREAM_SYSTEM_OVERLAY_META,
  STREAM_SYSTEM_OVERLAYS,
  type StreamOutputArea,
  type StreamOutputLayout,
  type StreamOverlayPackage,
  type StreamPackageAssetKey,
  type StreamPackageOutputVariantConfig,
  type StreamPackageRenderData,
  type StreamTableColumnStyleKey,
} from '../types/stream-package.types'

const SIZE_PRESETS = [
  { label: 'Post vertical 4:5', width: 1080, height: 1350 },
  { label: 'Story / Reels 9:16', width: 1080, height: 1920 },
  { label: 'Quadrado 1:1', width: 1080, height: 1080 },
  { label: 'Live HD 16:9', width: 1920, height: 1080 },
  { label: '4K 16:9', width: 3840, height: 2160 },
] as const

const FONT_OPTIONS = ['Rajdhani', 'Arial', 'Arial Black', 'Bebas Neue', 'Barlow Condensed', 'Chakra Petch', 'DM Sans', 'Exo 2', 'Inter', 'League Spartan', 'Montserrat', 'Oswald', 'Poppins', 'Roboto', 'Space Grotesk', 'Saira Condensed', 'Teko', 'Titillium Web']

const ASSET_OPTIONS: Array<{ key: StreamPackageAssetKey; label: string }> = [
  { key: 'event_logo', label: 'Logo do campeonato' },
  { key: 'top_art', label: 'Arte superior' },
  { key: 'table_row_bg', label: 'Fundo da linha' },
  { key: 'table_rank_bg', label: 'Fundo da posição' },
  { key: 'table_logo_bg', label: 'Fundo do logo' },
  { key: 'table_name_bg', label: 'Fundo do nome' },
  { key: 'table_stat_bg', label: 'Fundo de estatística' },
  { key: 'table_points_bg', label: 'Fundo de pontos' },
  { key: 'card_bg', label: 'Fundo do card' },
  { key: 'card_stats_bg', label: 'Fundo das estatísticas' },
]

type OutputInspectorItem = 'area' | 'table' | 'header' | 'loose_image' | 'loose_text' | `column_${StreamTableColumnStyleKey}`
type OutputToolsTab = 'project' | 'areas' | 'edit'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}


function mergeOutputOverrides(base: StreamPackageOutputVariantConfig, patch: StreamPackageOutputVariantConfig): StreamPackageOutputVariantConfig {
  const assetOverrides = { ...(base.assetOverrides || {}), ...(patch.assetOverrides || {}) }
  const baseStructure = base.structureOverrides || {}
  const patchStructure = patch.structureOverrides || {}
  const structureOverrides = {
    ...baseStructure,
    ...patchStructure,
    layout: { ...(baseStructure.layout || {}), ...(patchStructure.layout || {}) },
    table: { ...(baseStructure.table || {}), ...(patchStructure.table || {}) },
    card: { ...(baseStructure.card || {}), ...(patchStructure.card || {}) },
  }
  const baseLoose = base.looseOverrides || {}
  const patchLoose = patch.looseOverrides || {}
  const looseOverrides = {
    ...baseLoose,
    ...patchLoose,
    image: { ...(baseLoose.image || {}), ...(patchLoose.image || {}) },
    text: { ...(baseLoose.text || {}), ...(patchLoose.text || {}) },
  }
  return {
    ...base,
    ...patch,
    ...(Object.keys(assetOverrides).length ? { assetOverrides } : {}),
    ...(Object.keys(structureOverrides.layout || {}).length || Object.keys(structureOverrides.table || {}).length || Object.keys(structureOverrides.card || {}).length ? { structureOverrides } : {}),
    ...(Object.keys(looseOverrides.image || {}).length || Object.keys(looseOverrides.text || {}).length ? { looseOverrides } : {}),
  }
}

function packForOutputArea(pack: StreamOverlayPackage, area: StreamOutputArea) {
  const overrides = area.overrides || {}
  if (area.inheritFromLive !== false) {
    if (!Object.keys(overrides).length) return pack
    const stored = pack.overlay_configs[area.overlayType] || {}
    if (area.profileId === 'live-hd') {
      return { ...pack, overlay_configs: { ...pack.overlay_configs, [area.overlayType]: mergeOutputOverrides(stored, overrides) } }
    }
    const variants = { ...(stored.outputVariants || {}) }
    variants[area.profileId] = mergeOutputOverrides(variants[area.profileId] || {}, overrides)
    return { ...pack, overlay_configs: { ...pack.overlay_configs, [area.overlayType]: { ...stored, outputVariants: variants } } }
  }

  // Postagem independente: não consulta configuração da overlay de live nem o kit compartilhado.
  // O snapshot salvo em `overrides` vira a fonte visual desta área.
  return {
    ...pack,
    assets: {},
    shared_config: DEFAULT_STREAM_PACKAGE_SHARED_CONFIG,
    overlay_configs: { ...pack.overlay_configs, [area.overlayType]: overrides },
  }
}


function DraftNumberInput(props: {
  label: string
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  integer?: boolean
  prominent?: boolean
}) {
  const [draft, setDraft] = useState(String(props.value))

  useEffect(() => { setDraft(String(props.value)) }, [props.value])

  function commit() {
    const normalized = draft.trim().replace(',', '.')
    if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
      setDraft(String(props.value))
      return
    }
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) {
      setDraft(String(props.value))
      return
    }
    let next = props.integer === false ? parsed : Math.round(parsed)
    if (props.min !== undefined) next = Math.max(props.min, next)
    if (props.max !== undefined) next = Math.min(props.max, next)
    props.onCommit(next)
    setDraft(String(next))
  }

  return (
    <label className={`stream-output-number-field${props.prominent ? ' is-prominent' : ''}`}>
      {props.label}
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.currentTarget.blur() }
          if (event.key === 'Escape') { setDraft(String(props.value)); event.currentTarget.blur() }
        }}
      />
    </label>
  )
}

function DraftOptionalNumberInput(props: {
  label: string
  value: number | null
  onCommit: (value: number | null) => void
  min?: number
  max?: number
}) {
  const [draft, setDraft] = useState(props.value == null ? '' : String(props.value))

  useEffect(() => { setDraft(props.value == null ? '' : String(props.value)) }, [props.value])

  function commit() {
    const normalized = draft.trim().replace(',', '.')
    if (!normalized) { props.onCommit(null); setDraft(''); return }
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) { setDraft(props.value == null ? '' : String(props.value)); return }
    let next = Math.round(parsed)
    if (props.min !== undefined) next = Math.max(props.min, next)
    if (props.max !== undefined) next = Math.min(props.max, next)
    props.onCommit(next)
    setDraft(String(next))
  }

  return (
    <label className="stream-output-number-field">
      {props.label}
      <input type="text" inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(props.value == null ? '' : String(props.value)); event.currentTarget.blur() } }} />
    </label>
  )
}


function newLayout(index: number): StreamOutputLayout {
  return {
    id: uid('output'),
    name: `Postagem ${index + 1}`,
    width: 1080,
    height: 1350,
    backgroundType: 'transparent',
    backgroundColor: '#101218',
    backgroundUrl: '',
    outputFormat: 'png',
    sliceCount: 1,
    sliceDirection: 'horizontal',
    sliceWidth: 1080,
    sliceHeight: 1350,
    areas: [],
  }
}

function fitLegacyFullBoardAreasIntoSlice(layout: StreamOutputLayout) {
  if (layout.sliceCount <= 1) return layout

  const fullBoardDefaultWidth = Math.max(240, layout.width - 120)
  const fullBoardDefaultHeight = Math.max(180, Math.min(720, layout.height - 160))
  const sliceDefaultWidth = Math.max(240, layout.sliceWidth - 120)
  const sliceDefaultHeight = Math.max(180, Math.min(720, layout.sliceHeight - 160))
  let changed = false
  const areas = layout.areas.map((area) => {
    const isLegacyFullBoardArea = area.x === 60
      && area.y === 80
      && area.width === fullBoardDefaultWidth
      && area.height === fullBoardDefaultHeight
    if (!isLegacyFullBoardArea) return area
    changed = true
    return { ...area, width: sliceDefaultWidth, height: sliceDefaultHeight }
  })

  return changed ? { ...layout, areas } : layout
}

function newArea(layout: StreamOutputLayout, index: number): StreamOutputArea {
  const sliceIndex = index % Math.max(1, layout.sliceCount)
  const x = layout.sliceDirection === 'horizontal'
    ? sliceIndex * layout.sliceWidth + 60
    : 60
  const y = layout.sliceDirection === 'vertical'
    ? sliceIndex * layout.sliceHeight + 80
    : 80
  return {
    id: uid('area'),
    overlayType: 'standings_general',
    profileId: 'png-4k',
    x,
    y,
    width: Math.max(240, layout.sliceWidth - 120),
    height: Math.max(180, Math.min(720, layout.sliceHeight - 160)),
    zIndex: index,
    dataStart: 1,
    dataEnd: 12,
    visible: true,
    contentMode: 'full',
    lockAspect: false,
    inheritFromLive: true,
  }
}

function OutputAreaPreview(props: {
  campeonatoId: string
  pack: StreamOverlayPackage
  area: StreamOutputArea
  scale: number
  selected: boolean
  onSelect: () => void
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  interactive?: boolean
}) {
  const [data, setData] = useState<StreamPackageRenderData>({ items: [] })
  const [ready, setReady] = useState(false)
  const interactive = props.interactive !== false
  useEffect(() => {
    setReady(false)
    let active = true
    loadStreamPackageRenderData(props.campeonatoId, props.area.overlayType)
      .then((next) => {
        if (!active) return
        const start = Math.max(0, props.area.dataStart - 1)
        const end = Math.max(start + 1, props.area.dataEnd)
        setData({ ...next, items: next.items.slice(start, end) })
        setReady(true)
      })
      .catch(() => { if (active) { setData({ items: [], emptyMessage: 'Sem dados para esta área.' }); setReady(true) } })
    return () => { active = false }
  }, [props.area.dataEnd, props.area.dataStart, props.area.overlayType, props.campeonatoId])

  const artArea = streamOutputArtworkArea(props.area)
  const areaPack = useMemo(() => packForOutputArea(props.pack, artArea), [props.area, props.pack])
  const artworkBounds = streamOutputArtworkBounds(areaPack, artArea, data.items.length || undefined)
  const effectiveSize = streamOutputArtworkEffectiveSize(areaPack, artArea, data.items.length || undefined)
  const displayWidth = effectiveSize.width * props.scale
  const displayHeight = effectiveSize.height * props.scale
  const innerScale = displayWidth / artworkBounds.width

  return (
    <div
      className={`stream-output-area-preview${props.selected ? ' is-selected' : ''}`}
      style={{
        left: props.area.x * props.scale,
        top: props.area.y * props.scale,
        width: displayWidth,
        height: displayHeight,
        zIndex: props.area.zIndex,
      }}
      data-stream-export-area={props.area.id}
      data-ready={ready ? 'true' : 'false'}
      onPointerDown={interactive ? (event) => { props.onSelect(); props.onPointerDown(event, 'move') } : undefined}
      onPointerMove={interactive ? props.onPointerMove : undefined}
      onPointerUp={interactive ? props.onPointerUp : undefined}
      onPointerCancel={interactive ? props.onPointerUp : undefined}
    >
      <div
        className="stream-output-area-stage"
        style={{
          left: -artworkBounds.x * innerScale,
          top: -artworkBounds.y * innerScale,
          width: STREAM_ARTWORK_DESIGN_WIDTH,
          height: STREAM_ARTWORK_DESIGN_HEIGHT,
          transform: `scale(${innerScale})`,
        }}
      >
        <StreamPackageStage
          pack={areaPack}
          type={props.area.overlayType}
          data={data}
          preview
          canvasWidth={STREAM_ARTWORK_DESIGN_WIDTH}
          canvasHeight={STREAM_ARTWORK_DESIGN_HEIGHT}
          outputProfileId="png-4k"
          contentOnly={false}
          artworkMode
        />
      </div>
    </div>
  )
}

type AreaInteraction = {
  pointerId: number
  areaId: string
  mode: 'move' | 'resize'
  startClientX: number
  startClientY: number
  original: StreamOutputArea
}

export function StreamOutputLayoutsEditor(props: {
  campeonatoId: string
  pack: StreamOverlayPackage
  layouts: StreamOutputLayout[]
  onChange: (layouts: StreamOutputLayout[]) => void
}) {
  const [activeLayoutId, setActiveLayoutId] = useState(props.layouts[0]?.id || '')
  const [activeAreaId, setActiveAreaId] = useState('')
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [activeSliceIndex, setActiveSliceIndex] = useState<number | null>(null)
  const [exporting, setExporting] = useState<'board' | 'slices' | null>(null)
  const [exportError, setExportError] = useState('')
  const [outputInspectorItem, setOutputInspectorItem] = useState<OutputInspectorItem>('area')
  const [uploadingOutputAsset, setUploadingOutputAsset] = useState(false)
  const [toolsTab, setToolsTab] = useState<OutputToolsTab>('project')
  const [previewZoom, setPreviewZoom] = useState(1)
  const exportBoardRef = useRef<HTMLDivElement | null>(null)
  const interactionRef = useRef<AreaInteraction | null>(null)

  useEffect(() => {
    const nextLayouts = props.layouts.map(fitLegacyFullBoardAreasIntoSlice)
    if (nextLayouts.some((layout, index) => layout !== props.layouts[index])) props.onChange(nextLayouts)
  }, [props.layouts, props.onChange])

  useEffect(() => {
    const nextLayouts = props.layouts.map((layout) => {
      let changed = false
      const areas = layout.areas.map((area) => {
        if (area.profileId === 'png-4k' && area.contentMode === 'full' && area.lockAspect === true) return area
        changed = true
        return streamOutputArtworkArea(area)
      })
      return changed ? { ...layout, areas } : layout
    })
    if (nextLayouts.some((layout, index) => layout !== props.layouts[index])) props.onChange(nextLayouts)
  }, [props.layouts, props.onChange])

  useEffect(() => {
    if (activeLayoutId && props.layouts.some((layout) => layout.id === activeLayoutId)) return
    setActiveLayoutId(props.layouts[0]?.id || '')
  }, [activeLayoutId, props.layouts])

  useEffect(() => {
    setOutputInspectorItem('area')
  }, [activeAreaId])

  useEffect(() => {
    setPreviewZoom(1)
  }, [activeLayoutId, activeSliceIndex])

  const activeLayout = props.layouts.find((layout) => layout.id === activeLayoutId) || null
  const activeArea = activeLayout?.areas.find((area) => area.id === activeAreaId) || null
  const activeAreaPack = useMemo(() => activeArea ? packForOutputArea(props.pack, activeArea) : props.pack, [activeArea, props.pack])
  const activeAreaConfig = useMemo(() => activeArea ? resolveStreamOverlayConfig(activeAreaPack, activeArea.overlayType, activeArea.profileId) : null, [activeArea, activeAreaPack])
  const activeAreaTable = useMemo(() => activeArea ? resolveStreamTableConfig(activeAreaPack, activeArea.overlayType, activeArea.profileId) : null, [activeArea, activeAreaPack])
  const activeAreaLooseImage = useMemo(() => activeArea ? resolveStreamLooseImageConfig(activeAreaPack, activeArea.overlayType, activeArea.profileId) : null, [activeArea, activeAreaPack])
  const activeAreaLooseText = useMemo(() => activeArea ? resolveStreamLooseTextConfig(activeAreaPack, activeArea.overlayType, activeArea.profileId) : null, [activeArea, activeAreaPack])
  const activeAreaColumns = useMemo(() => (activeAreaConfig?.columns || []).filter((column) => STREAM_OVERLAY_COLUMN_META[column]), [activeAreaConfig])
  const availableAreaColumns = useMemo(() => activeArea ? resolveStreamOverlayConfig(props.pack, activeArea.overlayType, activeArea.profileId).columns?.filter((column) => STREAM_OVERLAY_COLUMN_META[column]) || [] : [], [activeArea, props.pack])
  const selectedOutputColumnKey = outputInspectorItem.startsWith('column_') ? outputInspectorItem.slice(7) as StreamTableColumnStyleKey : null
  const selectedOutputColumn = selectedOutputColumnKey && activeAreaTable ? activeAreaTable.columnStyles[selectedOutputColumnKey] : null
  const viewWidth = activeLayout ? (activeSliceIndex == null ? activeLayout.width : activeLayout.sliceWidth) : 1
  const viewHeight = activeLayout ? (activeSliceIndex == null ? activeLayout.height : activeLayout.sliceHeight) : 1
  const basePreviewScale = activeLayout ? Math.min(1, 720 / viewWidth, 720 / viewHeight) : 1
  const previewScale = basePreviewScale * previewZoom
  const sliceOffsetX = activeLayout && activeSliceIndex != null && activeLayout.sliceDirection === 'horizontal' ? activeLayout.sliceWidth * activeSliceIndex : 0
  const sliceOffsetY = activeLayout && activeSliceIndex != null && activeLayout.sliceDirection === 'vertical' ? activeLayout.sliceHeight * activeSliceIndex : 0


  function clampPreviewZoom(value: number) {
    return Math.max(.25, Math.min(4, value))
  }

  function handlePreviewWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    setPreviewZoom((current) => clampPreviewZoom(current * (event.deltaY < 0 ? 1.12 : .88)))
  }

  function chooseArea(areaId: string) {
    setActiveAreaId(areaId)
    setToolsTab('areas')
  }

  function replaceLayout(next: StreamOutputLayout) {
    props.onChange(props.layouts.map((layout) => layout.id === next.id ? next : layout))
  }

  function patchLayout(patch: Partial<StreamOutputLayout>) {
    if (!activeLayout) return
    replaceLayout({ ...activeLayout, ...patch })
  }

  function patchArea(areaId: string, patch: Partial<StreamOutputArea>) {
    if (!activeLayout) return
    replaceLayout({
      ...activeLayout,
      areas: activeLayout.areas.map((area) => area.id === areaId ? { ...area, ...patch } : area),
    })
  }

  function patchAreaOverrides(patch: StreamPackageOutputVariantConfig) {
    if (!activeArea) return
    patchArea(activeArea.id, { overrides: mergeOutputOverrides(activeArea.overrides || {}, patch) })
  }


  function makeAreaIndependent() {
    if (!activeArea) return
    const config = resolveStreamOverlayConfig(props.pack, activeArea.overlayType, activeArea.profileId)
    const assetOverrides = Object.fromEntries(
      ASSET_OPTIONS.map(({ key }) => [key, resolveStreamAsset(props.pack, activeArea.overlayType, key, activeArea.profileId)])
        .filter(([, value]) => Boolean(value)),
    ) as StreamPackageOutputVariantConfig['assetOverrides']
    const snapshot: StreamPackageOutputVariantConfig = {
      maxItems: config.maxItems,
      tableMode: config.tableMode,
      columns: config.columns ? [...config.columns] : undefined,
      title: config.title,
      columnLabels: config.columnLabels ? { ...config.columnLabels } : undefined,
      hiddenHeaders: config.hiddenHeaders ? [...config.hiddenHeaders] : undefined,
      sceneItems: config.sceneItems ? config.sceneItems.map((item) => ({ ...item })) : undefined,
      assetOverrides,
      structureOverrides: {
        layout: { ...resolveStreamLayoutConfig(props.pack, activeArea.overlayType, activeArea.profileId) },
        table: { ...resolveStreamTableConfig(props.pack, activeArea.overlayType, activeArea.profileId) },
        card: { ...resolveStreamCardConfig(props.pack, activeArea.overlayType, activeArea.profileId) },
      },
      looseOverrides: {
        image: { ...resolveStreamLooseImageConfig(props.pack, activeArea.overlayType, activeArea.profileId) },
        text: { ...resolveStreamLooseTextConfig(props.pack, activeArea.overlayType, activeArea.profileId) },
      },
    }
    patchArea(activeArea.id, { inheritFromLive: false, overrides: mergeOutputOverrides(snapshot, activeArea.overrides || {}) })
  }

  function inheritAreaFromLive() {
    if (!activeArea) return
    patchArea(activeArea.id, { inheritFromLive: true, overrides: undefined })
  }

  function patchAreaTable(patch: NonNullable<StreamPackageOutputVariantConfig['structureOverrides']>['table']) {
    patchAreaOverrides({ structureOverrides: { table: patch } })
  }

  function patchAreaColumn(key: StreamTableColumnStyleKey, patch: Record<string, unknown>) {
    if (!activeAreaTable) return
    const current = activeAreaTable.columnStyles[key]
    patchAreaTable({ columnStyles: { ...activeAreaTable.columnStyles, [key]: { ...current, ...patch } } })
  }

  function patchAreaLoose(section: 'image' | 'text', patch: Record<string, unknown>) {
    if (!activeArea) return
    patchArea(activeArea.id, {
      overrides: mergeOutputOverrides(activeArea.overrides || {}, { looseOverrides: { [section]: patch } }),
    })
  }

  async function uploadOutputAsset(key: StreamPackageAssetKey, file?: File | null) {
    if (!file) return
    setUploadingOutputAsset(true)
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId: props.campeonatoId })
      patchAreaOverrides({ assetOverrides: { [key]: url } })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Não foi possível enviar a imagem desta postagem.')
    } finally {
      setUploadingOutputAsset(false)
    }
  }

  function addLayout() {
    const layout = newLayout(props.layouts.length)
    props.onChange([...props.layouts, layout])
    setActiveLayoutId(layout.id)
    setActiveAreaId('')
    setActiveSliceIndex(null)
  }

  function removeLayout() {
    if (!activeLayout) return
    props.onChange(props.layouts.filter((layout) => layout.id !== activeLayout.id))
    setActiveLayoutId('')
    setActiveAreaId('')
    setActiveSliceIndex(null)
  }

  function addArea() {
    if (!activeLayout) return
    const area = newArea(activeLayout, activeLayout.areas.length)
    replaceLayout({ ...activeLayout, areas: [...activeLayout.areas, area] })
    setActiveAreaId(area.id)
  }

  function duplicateArea(areaId: string) {
    if (!activeLayout) return
    const source = activeLayout.areas.find((area) => area.id === areaId)
    if (!source) return
    const maxZ = Math.max(-1, ...activeLayout.areas.map((area) => area.zIndex))
    const area: StreamOutputArea = {
      ...source,
      id: uid('area'),
      x: source.x + 24,
      y: source.y + 24,
      zIndex: maxZ + 1,
    }
    replaceLayout({ ...activeLayout, areas: [...activeLayout.areas, area] })
    setActiveAreaId(area.id)
  }

  function removeArea(areaId: string) {
    if (!activeLayout) return
    replaceLayout({ ...activeLayout, areas: activeLayout.areas.filter((area) => area.id !== areaId) })
    if (activeAreaId === areaId) setActiveAreaId('')
  }

  function moveAreaLayer(areaId: string, target: 'front' | 'back') {
    if (!activeLayout) return
    const ordered = [...activeLayout.areas].sort((a, b) => a.zIndex - b.zIndex)
    const index = ordered.findIndex((area) => area.id === areaId)
    if (index < 0) return
    const [area] = ordered.splice(index, 1)
    if (target === 'front') ordered.push(area)
    else ordered.unshift(area)
    const zById = new Map(ordered.map((item, zIndex) => [item.id, zIndex]))
    replaceLayout({ ...activeLayout, areas: activeLayout.areas.map((item) => ({ ...item, zIndex: zById.get(item.id) ?? item.zIndex })) })
  }

  async function uploadBackground(file?: File | null) {
    if (!file || !activeLayout) return
    setUploadingBackground(true)
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId: props.campeonatoId })
      patchLayout({ backgroundType: 'image', backgroundUrl: url })
    } finally {
      setUploadingBackground(false)
    }
  }

  function patchSlices(patch: Partial<Pick<StreamOutputLayout, 'sliceCount' | 'sliceDirection' | 'sliceWidth' | 'sliceHeight'>>) {
    if (!activeLayout) return
    const sliceCount = Math.max(1, Math.min(8, Number(patch.sliceCount ?? activeLayout.sliceCount) || 1))
    const sliceDirection = patch.sliceDirection ?? activeLayout.sliceDirection
    const sliceWidth = Math.max(240, Math.min(7680, Number(patch.sliceWidth ?? activeLayout.sliceWidth) || 1080))
    const sliceHeight = Math.max(240, Math.min(7680, Number(patch.sliceHeight ?? activeLayout.sliceHeight) || 1350))
    const width = sliceDirection === 'horizontal' ? Math.min(16384, sliceWidth * sliceCount) : sliceWidth
    const height = sliceDirection === 'vertical' ? Math.min(16384, sliceHeight * sliceCount) : sliceHeight
    const oldDefaultWidth = Math.max(240, activeLayout.width - 120)
    const oldDefaultHeight = Math.max(180, Math.min(720, activeLayout.height - 160))
    const newDefaultWidth = Math.max(240, sliceWidth - 120)
    const newDefaultHeight = Math.max(180, Math.min(720, sliceHeight - 160))

    replaceLayout({
      ...activeLayout,
      ...patch,
      sliceCount,
      sliceDirection,
      sliceWidth,
      sliceHeight,
      width,
      height,
      areas: activeLayout.areas.map((area) => {
        const isOriginalFullBoardArea = area.x === 60
          && area.y === 80
          && area.width === oldDefaultWidth
          && area.height === oldDefaultHeight
        return isOriginalFullBoardArea
          ? { ...area, width: newDefaultWidth, height: newDefaultHeight }
          : area
      }),
    })
    setActiveSliceIndex((current) => current == null ? null : Math.min(current, sliceCount - 1))
  }

  function snapCoordinate(value: number, axis: 'x' | 'y') {
    if (!activeLayout || !snapEnabled) return value
    const guides = axis === 'x'
      ? [0, activeLayout.width, ...(activeLayout.sliceDirection === 'horizontal' ? Array.from({ length: activeLayout.sliceCount + 1 }, (_, index) => index * activeLayout.sliceWidth) : [])]
      : [0, activeLayout.height, ...(activeLayout.sliceDirection === 'vertical' ? Array.from({ length: activeLayout.sliceCount + 1 }, (_, index) => index * activeLayout.sliceHeight) : [])]
    const nearest = guides.reduce((best, guide) => Math.abs(guide - value) < Math.abs(best - value) ? guide : best, guides[0] ?? value)
    return Math.abs(nearest - value) <= 12 ? nearest : value
  }

  function beginAreaInteraction(event: ReactPointerEvent<HTMLElement>, area: StreamOutputArea, mode: 'move' | 'resize') {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      pointerId: event.pointerId,
      areaId: area.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      original: { ...area },
    }
  }

  function moveAreaInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId || !activeLayout) return
    const dx = (event.clientX - interaction.startClientX) / previewScale
    const dy = (event.clientY - interaction.startClientY) / previewScale
    const original = interaction.original
    if (interaction.mode === 'move') {
      const effective = streamOutputArtworkEffectiveSize(packForOutputArea(props.pack, streamOutputArtworkArea(original)), streamOutputArtworkArea(original))
      let x = original.x + dx
      let y = original.y + dy
      const snappedLeft = snapCoordinate(x, 'x')
      const snappedRight = snapCoordinate(x + effective.width, 'x') - effective.width
      const snappedTop = snapCoordinate(y, 'y')
      const snappedBottom = snapCoordinate(y + effective.height, 'y') - effective.height
      if (snapEnabled) {
        x = Math.abs(snappedLeft - x) <= Math.abs(snappedRight - x) ? snappedLeft : snappedRight
        y = Math.abs(snappedTop - y) <= Math.abs(snappedBottom - y) ? snappedTop : snappedBottom
      }
      patchArea(interaction.areaId, { x: Math.round(x), y: Math.round(y) })
      return
    }

    let width = Math.max(80, original.width + dx)
    if (snapEnabled) width = snapCoordinate(original.x + width, 'x') - original.x
    const next = { ...original, width: Math.max(80, Math.round(width)) }
    const effective = streamOutputArtworkEffectiveSize(packForOutputArea(props.pack, next), next)
    patchArea(interaction.areaId, { width: next.width, height: effective.height, lockAspect: true })
  }

  function endAreaInteraction(event: ReactPointerEvent<HTMLElement>) {
    if (interactionRef.current?.pointerId !== event.pointerId) return
    interactionRef.current = null
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!activeLayout || !activeArea) return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateArea(activeArea.id)
        return
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
      patchArea(activeArea.id, {
        x: activeArea.x + dx,
        y: activeArea.y + dy,
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeArea, activeLayout])

  const sortedAreas = useMemo(() => activeLayout ? [...activeLayout.areas].sort((a, b) => a.zIndex - b.zIndex) : [], [activeLayout])

  async function renderFinalBoard() {
    if (!activeLayout || !exportBoardRef.current) throw new Error('Prancha de exportação indisponível.')
    const entries = await Promise.all(activeLayout.areas.filter((area) => area.visible).map(async (area) => {
      const artArea = streamOutputArtworkArea(area)
      return {
        area: artArea,
        pack: packForOutputArea(props.pack, artArea),
        data: await loadStreamPackageRenderData(props.campeonatoId, artArea.overlayType),
      }
    }))
    return renderStreamOutputCanvas(activeLayout, entries)
  }

  async function exportBoard() {
    if (!activeLayout || exporting) return
    setExporting('board')
    setExportError('')
    try {
      const canvas = await renderFinalBoard()
      const blob = await streamOutputCanvasToBlob(canvas, activeLayout.outputFormat)
      const extension = activeLayout.outputFormat
      downloadStreamOutputBlob(blob, `${sanitizeStreamOutputFilename(activeLayout.name)}-prancha.${extension}`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Falha ao exportar a prancha.')
    } finally {
      setExporting(null)
    }
  }

  async function exportSlices() {
    if (!activeLayout || exporting) return
    setExporting('slices')
    setExportError('')
    try {
      const board = await renderFinalBoard()
      const baseName = sanitizeStreamOutputFilename(activeLayout.name)
      const extension = activeLayout.outputFormat
      if (activeLayout.sliceCount === 1) {
        const blob = await streamOutputCanvasToBlob(board, activeLayout.outputFormat)
        downloadStreamOutputBlob(blob, `${baseName}-01.${extension}`)
        return
      }
      const zip = new JSZip()
      for (let index = 0; index < activeLayout.sliceCount; index += 1) {
        const x = activeLayout.sliceDirection === 'horizontal' ? activeLayout.sliceWidth * index : 0
        const y = activeLayout.sliceDirection === 'vertical' ? activeLayout.sliceHeight * index : 0
        const slice = cropStreamOutputCanvas(board, x, y, activeLayout.sliceWidth, activeLayout.sliceHeight)
        const blob = await streamOutputCanvasToBlob(slice, activeLayout.outputFormat)
        zip.file(`${baseName}-${String(index + 1).padStart(2, '0')}.${extension}`, blob)
      }
      downloadStreamOutputBlob(await zip.generateAsync({ type: 'blob' }), `${baseName}-fatias.zip`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Falha ao exportar as fatias.')
    } finally {
      setExporting(null)
    }
  }

  if (!activeLayout) {
    return (
      <section className="stream-output-empty">
        <div><strong>Saídas para postagem</strong><p>Monte peças reutilizáveis com fundo próprio e quantas áreas de overlay precisar.</p></div>
        <button type="button" className="stream-primary-btn" onClick={addLayout}><Plus size={14} /> Criar primeira saída</button>
      </section>
    )
  }

  return (
    <div className="stream-output-editor">
      <aside className="stream-output-sidebar">
        <div className="stream-output-sidebar-head"><strong>Saídas salvas</strong><button type="button" onClick={addLayout} title="Nova saída"><Plus size={14} /></button></div>
        <div className="stream-output-layout-list">
          {props.layouts.map((layout) => (
            <button type="button" key={layout.id} className={layout.id === activeLayout.id ? 'active' : ''} onClick={() => { setActiveLayoutId(layout.id); setActiveAreaId(''); setActiveSliceIndex(null) }}>
              <b>{layout.name}</b><small>{layout.width} × {layout.height} · {layout.areas.length} área(s)</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="stream-output-controls">
        <div className="stream-output-tools-tabs" role="tablist" aria-label="Ferramentas da postagem">
          <button type="button" className={toolsTab === 'project' ? 'active' : ''} onClick={() => setToolsTab('project')}>Projeto</button>
          <button type="button" className={toolsTab === 'areas' ? 'active' : ''} onClick={() => setToolsTab('areas')}>Áreas</button>
          <button type="button" className={toolsTab === 'edit' ? 'active' : ''} disabled={!activeArea} onClick={() => setToolsTab('edit')}>Edição</button>
        </div>
        {toolsTab === 'project' ? <>
        <div className="stream-package-section-title"><div><small>Projeto de saída</small><h3>{activeLayout.name}</h3><p>Configure a imagem final sem alterar a cena usada na live.</p></div><button type="button" className="stream-package-link-btn danger" onClick={removeLayout}><Trash2 size={13} /> Excluir</button></div>
        <label>Nome<input value={activeLayout.name} onChange={(event) => patchLayout({ name: event.target.value })} /></label>
        <label>Tamanho de cada fatia<select value={`${activeLayout.sliceWidth}x${activeLayout.sliceHeight}`} onChange={(event) => {
          const preset = SIZE_PRESETS.find((item) => `${item.width}x${item.height}` === event.target.value)
          if (preset) patchSlices({ sliceWidth: preset.width, sliceHeight: preset.height })
        }}><option value={`${activeLayout.sliceWidth}x${activeLayout.sliceHeight}`}>Atual / personalizado</option>{SIZE_PRESETS.map((preset) => <option key={preset.label} value={`${preset.width}x${preset.height}`}>{preset.label}</option>)}</select></label>
        <div className="stream-package-quad-grid">
          <DraftNumberInput label="Largura da fatia" value={activeLayout.sliceWidth} min={240} max={7680} onCommit={(value) => patchSlices({ sliceWidth: value })} />
          <DraftNumberInput label="Altura da fatia" value={activeLayout.sliceHeight} min={240} max={7680} onCommit={(value) => patchSlices({ sliceHeight: value })} />
          <DraftNumberInput label="Quantidade" value={activeLayout.sliceCount} min={1} max={8} onCommit={(value) => patchSlices({ sliceCount: value })} />
          <label>Direção<select value={activeLayout.sliceDirection} onChange={(event) => patchSlices({ sliceDirection: event.target.value as StreamOutputLayout['sliceDirection'] })}><option value="horizontal">Carrossel horizontal</option><option value="vertical">Fatiamento vertical</option></select></label>
        </div>
        <div className="stream-output-board-summary"><span>Prancha total</span><strong>{activeLayout.width} × {activeLayout.height}</strong><small>{activeLayout.sliceCount} fatia(s) de {activeLayout.sliceWidth} × {activeLayout.sliceHeight}</small></div>
        <label>Fundo<select value={activeLayout.backgroundType} onChange={(event) => patchLayout({ backgroundType: event.target.value as StreamOutputLayout['backgroundType'] })}><option value="transparent">Transparente</option><option value="color">Cor sólida</option><option value="image">Imagem</option></select></label>
        {activeLayout.backgroundType === 'color' ? <label>Cor do fundo<input type="color" value={activeLayout.backgroundColor} onChange={(event) => patchLayout({ backgroundColor: event.target.value })} /></label> : null}
        <label className="stream-secondary-btn stream-output-background-upload">{uploadingBackground ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {activeLayout.backgroundUrl ? 'Trocar imagem de fundo' : 'Enviar imagem de fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadBackground(event.target.files?.[0])} /></label>
        {activeLayout.backgroundUrl ? <button type="button" className="stream-package-link-btn" onClick={() => patchLayout({ backgroundUrl: '', backgroundType: 'transparent' })}>Remover imagem de fundo</button> : null}
        <label>Formato final<select value={activeLayout.outputFormat} onChange={(event) => patchLayout({ outputFormat: event.target.value as StreamOutputLayout['outputFormat'] })}><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
        </> : null}

        {toolsTab === 'areas' ? <>
        <div className="stream-output-areas-head"><div><strong>Áreas da composição</strong><small>Use a mesma overlay quantas vezes quiser, mudando somente a faixa de dados.</small></div><button type="button" className="stream-secondary-btn" onClick={addArea}><Plus size={13} /> Adicionar área</button></div>
        <div className="stream-output-area-list">
          {sortedAreas.map((area, index) => (
            <article key={area.id} className={area.id === activeAreaId ? 'active' : ''}>
              <button type="button" className="stream-output-area-select" onClick={() => chooseArea(area.id)}><b>Área {index + 1}</b><span>{STREAM_SYSTEM_OVERLAY_META[area.overlayType].name}</span><small>Itens {area.dataStart}–{area.dataEnd}</small></button>
              <button type="button" className="stream-output-area-delete" onClick={() => removeArea(area.id)} aria-label={`Excluir área ${index + 1}`}><Trash2 size={12} /></button>
            </article>
          ))}
        </div>

        {activeArea ? (
          <div className="stream-output-area-config">
            <div className="stream-output-area-config-head"><strong>Área selecionada</strong><div><button type="button" title="Abrir ferramentas de edição" onClick={() => setToolsTab('edit')}>Editar</button><button type="button" title="Duplicar área" onClick={() => duplicateArea(activeArea.id)}><Copy size={12} /></button><button type="button" title="Mandar para trás" onClick={() => moveAreaLayer(activeArea.id, 'back')}><ArrowDownToLine size={12} /></button><button type="button" title="Trazer para frente" onClick={() => moveAreaLayer(activeArea.id, 'front')}><ArrowUpToLine size={12} /></button></div></div>
            <label>Overlay<select value={activeArea.overlayType} onChange={(event) => patchArea(activeArea.id, { overlayType: event.target.value as StreamOutputArea['overlayType'] })}>{STREAM_SYSTEM_OVERLAYS.map((type) => <option key={type} value={type}>{STREAM_SYSTEM_OVERLAY_META[type].name}</option>)}</select></label>
            <div className={`stream-output-inheritance${activeArea.inheritFromLive !== false ? ' is-inherited' : ' is-independent'}`}>
              <div><strong>Base visual desta postagem</strong><small>{activeArea.inheritFromLive !== false ? 'Herdando a overlay da live. Os ajustes abaixo continuam locais.' : 'Configuração própria. Mudanças na live não alteram esta postagem.'}</small></div>
              {activeArea.inheritFromLive !== false
                ? <button type="button" className="stream-secondary-btn" onClick={makeAreaIndependent}>Desvincular da live</button>
                : <button type="button" className="stream-secondary-btn" onClick={inheritAreaFromLive}>Voltar a herdar da live</button>}
            </div>
            <div className="stream-output-artwork-mode"><strong>Overlay 4K completa</strong><small>A postagem sempre usa a composição completa em 3840 × 2160. Não existe variante nem caixa de recorte da overlay.</small></div>
            <div className="stream-package-quad-grid">
              <DraftNumberInput label="Do item" value={activeArea.dataStart} min={1} onCommit={(value) => patchArea(activeArea.id, { dataStart: value, dataEnd: Math.max(value, activeArea.dataEnd) })} />
              <DraftNumberInput label="Até" value={activeArea.dataEnd} min={activeArea.dataStart} onCommit={(value) => patchArea(activeArea.id, { dataEnd: value })} />
            </div>
            <div className="stream-output-transform-grid">
              <DraftNumberInput label="X" value={activeArea.x} prominent onCommit={(value) => patchArea(activeArea.id, { x: value })} />
              <DraftNumberInput label="Y" value={activeArea.y} prominent onCommit={(value) => patchArea(activeArea.id, { y: value })} />
            </div>
            <DraftNumberInput
              label="Largura geral da overlay"
              value={activeArea.width}
              min={80}
              max={12000}
              prominent
              onCommit={(width) => {
                const next = streamOutputArtworkArea({ ...activeArea, width })
                const effective = streamOutputArtworkEffectiveSize(packForOutputArea(props.pack, next), next)
                patchArea(activeArea.id, { width, height: effective.height, lockAspect: true })
              }}
            />
            <small className="stream-output-scale-hint">X = 0 encosta o conteúdo visual da overlay na borda esquerda. A largura escala a overlay inteira; a altura acompanha automaticamente.</small>
            <small className="stream-output-shortcuts">A overlay é um elemento livre da arte: pode usar X/Y negativos e ultrapassar a prancha. Só a borda final da imagem faz o corte. Setas movem 1 px; Shift + seta move 10 px; Ctrl/Cmd + D duplica.</small>
          </div>
        ) : <div className="stream-output-tab-empty">Selecione uma área da composição para configurar.</div>}
        </> : null}

        {toolsTab === 'edit' ? (activeArea ? (
          <div className="stream-output-area-config stream-output-area-editor-tab">
            {activeAreaConfig && activeAreaTable && activeAreaLooseImage && activeAreaLooseText ? <div className="stream-output-local-editor">
              <div className="stream-output-local-editor-head"><div><strong>Editor desta postagem</strong><small>{activeArea.inheritFromLive !== false ? 'Ajustes locais sobre a base herdada da live.' : 'Edição própria desta postagem, independente da live.'}</small></div>{activeArea.overrides ? <button type="button" title={activeArea.inheritFromLive !== false ? 'Limpar ajustes locais e usar a live' : 'Limpar ajustes próprios'} onClick={() => patchArea(activeArea.id, { overrides: undefined })}>Restaurar</button> : null}</div>
              <div className="stream-output-selection-hint">Selecione o elemento no painel da direita. As ferramentas aparecem aqui.</div>

              {outputInspectorItem === 'table' ? <div className="stream-package-property-group"><b>Tabela</b><div className="stream-package-quad-grid"><DraftNumberInput label="Altura da linha" value={activeAreaTable.rowHeight} min={20} onCommit={(value) => patchAreaTable({ rowHeight: value })} /><DraftNumberInput label="Espaço entre linhas" value={activeAreaTable.rowGap} min={0} onCommit={(value) => patchAreaTable({ rowGap: value })} /><DraftNumberInput label="Gap das células" value={activeAreaTable.cellGap} min={0} onCommit={(value) => patchAreaTable({ cellGap: value })} /><DraftNumberInput label="Espaço entre blocos" value={activeAreaTable.panelGap} min={0} onCommit={(value) => patchAreaTable({ panelGap: value })} /></div><label>Blocos<select value={activeAreaConfig.tableMode || activeAreaTable.mode} onChange={(event) => patchAreaOverrides({ tableMode: event.target.value as 'single' | 'double' })}><option value="single">Uma coluna</option><option value="double">Duas colunas</option></select></label><div className="stream-output-column-toggles">{availableAreaColumns.map((column) => <label key={column}><input type="checkbox" checked={activeAreaColumns.includes(column)} onChange={(event) => { const columns = event.target.checked ? [...activeAreaColumns, column] : activeAreaColumns.filter((item) => item !== column); patchAreaOverrides({ columns }) }} />{STREAM_OVERLAY_COLUMN_META[column].label}</label>)}</div></div> : null}

              {outputInspectorItem === 'header' ? <div className="stream-package-property-group"><b>Legenda</b><label className="stream-package-switch-row"><span><b>Exibir legenda</b></span><input type="checkbox" checked={activeAreaTable.showHeaders} onChange={(event) => patchAreaTable({ showHeaders: event.target.checked })} /></label><DraftNumberInput label="Altura" value={activeAreaTable.headerHeight} min={16} onCommit={(value) => patchAreaTable({ headerHeight: value })} /><div className="stream-package-quad-grid"><label>Fonte<select value={activeAreaTable.headerFontFamily || 'Rajdhani'} onChange={(event) => patchAreaTable({ headerFontFamily: event.target.value })}>{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label><DraftNumberInput label="Tamanho" value={activeAreaTable.headerFontSize || 16} min={8} onCommit={(value) => patchAreaTable({ headerFontSize: value })} /><DraftNumberInput label="Peso" value={activeAreaTable.headerFontWeight || 700} min={100} max={900} onCommit={(value) => patchAreaTable({ headerFontWeight: value })} /><label>Cor<input type="color" value={activeAreaTable.headerColor || '#ffffff'} onChange={(event) => patchAreaTable({ headerColor: event.target.value })} /></label></div></div> : null}

              {outputInspectorItem === 'loose_image' ? <div className="stream-package-property-group"><b>Imagem</b><label className="stream-package-switch-row"><span><b>Exibir logo</b></span><input type="checkbox" checked={activeAreaLooseImage.show} onChange={(event) => patchAreaLoose('image', { show: event.target.checked })} /></label><label>Imagem<select value={activeAreaLooseImage.assetKey || 'event_logo'} onChange={(event) => patchAreaLoose('image', { assetKey: event.target.value as StreamPackageAssetKey })}>{ASSET_OPTIONS.map((asset) => <option key={asset.key} value={asset.key}>{asset.label}</option>)}</select></label><label className="stream-secondary-btn stream-package-inspector-upload">{uploadingOutputAsset ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} Trocar imagem<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadOutputAsset(activeAreaLooseImage.assetKey || 'event_logo', event.target.files?.[0])} /></label><div className="stream-package-quad-grid"><DraftNumberInput label="X" value={activeAreaLooseImage.x} onCommit={(value) => patchAreaLoose('image', { x: value })} /><DraftNumberInput label="Y" value={activeAreaLooseImage.y} onCommit={(value) => patchAreaLoose('image', { y: value })} /><DraftNumberInput label="Largura" value={activeAreaLooseImage.width} min={20} onCommit={(value) => patchAreaLoose('image', { width: value })} /><DraftNumberInput label="Altura" value={activeAreaLooseImage.height} min={20} onCommit={(value) => patchAreaLoose('image', { height: value })} /></div></div> : null}

              {outputInspectorItem === 'loose_text' ? <div className="stream-package-property-group"><b>Texto</b><label>Conteúdo<input value={activeAreaConfig.title || ''} placeholder="Título da postagem" onChange={(event) => patchAreaOverrides({ title: event.target.value })} /></label><label className="stream-package-switch-row"><span><b>Exibir título</b></span><input type="checkbox" checked={activeAreaLooseText.show} onChange={(event) => patchAreaLoose('text', { show: event.target.checked })} /></label><label>Fonte<select value={activeAreaLooseText.fontFamily} onChange={(event) => patchAreaLoose('text', { fontFamily: event.target.value })}>{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label><div className="stream-package-quad-grid"><DraftNumberInput label="X" value={activeAreaLooseText.x} onCommit={(value) => patchAreaLoose('text', { x: value })} /><DraftNumberInput label="Y" value={activeAreaLooseText.y} onCommit={(value) => patchAreaLoose('text', { y: value })} /><DraftNumberInput label="Largura" value={activeAreaLooseText.width} min={20} onCommit={(value) => patchAreaLoose('text', { width: value })} /><DraftNumberInput label="Tamanho" value={activeAreaLooseText.fontSize} min={8} onCommit={(value) => patchAreaLoose('text', { fontSize: value })} /><DraftNumberInput label="Peso" value={activeAreaLooseText.fontWeight} min={100} max={900} onCommit={(value) => patchAreaLoose('text', { fontWeight: value })} /><label>Cor<input type="color" value={activeAreaLooseText.color} onChange={(event) => patchAreaLoose('text', { color: event.target.value })} /></label></div></div> : null}

              {selectedOutputColumn && selectedOutputColumnKey ? (
                <div className="stream-package-property-group">
                  <b>{STREAM_OVERLAY_COLUMN_META[selectedOutputColumnKey]?.kind === 'image' ? 'Imagem e célula' : 'Texto e célula'}</b>
                  {STREAM_OVERLAY_COLUMN_META[selectedOutputColumnKey]?.kind !== 'image' ? (
                    <div className="stream-package-quad-grid">
                      <label>Fonte<select value={selectedOutputColumn.fontFamily} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { fontFamily: event.target.value })}>{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
                      <DraftNumberInput label="Tamanho" value={selectedOutputColumn.fontSize} min={8} onCommit={(value) => patchAreaColumn(selectedOutputColumnKey, { fontSize: value })} />
                      <DraftNumberInput label="Peso" value={selectedOutputColumn.fontWeight} min={100} max={900} onCommit={(value) => patchAreaColumn(selectedOutputColumnKey, { fontWeight: value })} />
                      <label>Cor<input type="color" value={selectedOutputColumn.color} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { color: event.target.value })} /></label>
                      <label>Inclinação<select value={selectedOutputColumn.fontStyle} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { fontStyle: event.target.value as 'normal' | 'italic' })}><option value="normal">Reta</option><option value="italic">Itálica</option></select></label>
                      <label>Alinhar<select value={selectedOutputColumn.align} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { align: event.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
                    </div>
                  ) : null}
                  <DraftOptionalNumberInput label="Largura da coluna" value={selectedOutputColumn.width} min={20} onCommit={(value) => patchAreaColumn(selectedOutputColumnKey, { width: value })} />
                  <label>Preenchimento<select value={selectedOutputColumn.backgroundType} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { backgroundType: event.target.value as 'solid' | 'gradient' | 'image' })}><option value="solid">Sólido</option><option value="gradient">Degradê</option><option value="image">Imagem</option></select></label>
                  {selectedOutputColumn.backgroundType === 'solid' ? <label>Cor<input type="color" value={selectedOutputColumn.backgroundColor} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { backgroundColor: event.target.value })} /></label> : null}
                  {selectedOutputColumn.backgroundType === 'gradient' ? <label>Degradê<input value={selectedOutputColumn.backgroundGradient} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { backgroundGradient: event.target.value })} /></label> : null}
                  {selectedOutputColumn.backgroundType === 'image' && selectedOutputColumn.assetKey ? <label className="stream-secondary-btn stream-package-inspector-upload">{uploadingOutputAsset ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} Trocar fundo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadOutputAsset(selectedOutputColumn.assetKey!, event.target.files?.[0])} /></label> : null}
                  <div className="stream-package-quad-grid">
                    <DraftNumberInput label="Margem X" value={selectedOutputColumn.paddingX || 0} min={0} onCommit={(value) => patchAreaColumn(selectedOutputColumnKey, { paddingX: value })} />
                    <DraftNumberInput label="Margem Y" value={selectedOutputColumn.paddingY || 0} min={0} onCommit={(value) => patchAreaColumn(selectedOutputColumnKey, { paddingY: value })} />
                    <label>Borda<input type="color" value={selectedOutputColumn.borderColor} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { borderColor: event.target.value })} /></label>
                    <DraftNumberInput label="Espessura" value={selectedOutputColumn.borderWidth} min={0} onCommit={(value) => patchAreaColumn(selectedOutputColumnKey, { borderWidth: value })} />
                    <DraftNumberInput label="Canto" value={selectedOutputColumn.borderRadius} min={0} onCommit={(value) => patchAreaColumn(selectedOutputColumnKey, { borderRadius: value })} />
                    <DraftNumberInput label="Opacidade" value={Math.round((selectedOutputColumn.opacity ?? 1) * 100)} min={0} max={100} onCommit={(value) => patchAreaColumn(selectedOutputColumnKey, { opacity: value / 100 })} />
                  </div>
                </div>
              ) : null}
            </div> : null}
          </div>
        ) : <div className="stream-output-tab-empty">Selecione uma área e abra a aba Edição.</div>) : null}
      </section>

      <aside className="stream-output-preview-column">
        <div className="stream-output-preview-head"><div><small>Prévia da prancha</small><strong>{activeLayout.width} × {activeLayout.height}</strong><em>{activeLayout.sliceCount} fatia(s) · {activeLayout.sliceWidth} × {activeLayout.sliceHeight}</em></div><span>{activeLayout.outputFormat.toUpperCase()}</span></div>
        <div className="stream-output-export-actions">
          {activeLayout.sliceCount === 1 ? <button type="button" className="stream-primary-btn" disabled={Boolean(exporting)} onClick={() => void exportBoard()}>{exporting === 'board' ? <Loader2 size={13} className="spin" /> : <Download size={13} />} Baixar imagem</button> : <button type="button" className="stream-primary-btn" disabled={Boolean(exporting)} onClick={() => void exportSlices()}>{exporting === 'slices' ? <Loader2 size={13} className="spin" /> : <Download size={13} />} Baixar {activeLayout.sliceCount} imagens (.zip)</button>}
          {activeLayout.sliceCount > 1 ? <button type="button" className="stream-secondary-btn" disabled={Boolean(exporting)} onClick={() => void exportBoard()}>{exporting === 'board' ? <Loader2 size={13} className="spin" /> : <Download size={13} />} Prévia completa</button> : null}
        </div>
        {exportError ? <p className="stream-output-export-error">{exportError}</p> : null}
        <div className="stream-output-preview-tools">
          <button type="button" className={activeSliceIndex == null ? 'active' : ''} onClick={() => setActiveSliceIndex(null)}>Prancha</button>
          {Array.from({ length: activeLayout.sliceCount }, (_, index) => <button type="button" key={`slice-tool-${index}`} className={activeSliceIndex === index ? 'active' : ''} onClick={() => setActiveSliceIndex(index)}>Fatia {index + 1}</button>)}
          <div className="stream-output-zoom-tools" aria-label="Zoom da prévia">
            <button type="button" title="Diminuir zoom" onClick={() => setPreviewZoom((current) => clampPreviewZoom(current / 1.2))}><Minus size={12} /></button>
            <button type="button" className="stream-output-zoom-value" title="Ajustar à tela" onClick={() => setPreviewZoom(1)}>{Math.round(previewZoom * 100)}%</button>
            <button type="button" title="Aumentar zoom" onClick={() => setPreviewZoom((current) => clampPreviewZoom(current * 1.2))}><Plus size={12} /></button>
            <button type="button" title="Ajustar à tela" onClick={() => setPreviewZoom(1)}><Maximize2 size={12} /></button>
          </div>
          <label><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Snap</label>
        </div>
        <div className="stream-output-preview-shell" onWheel={handlePreviewWheel} title="Use o scroll do mouse para aplicar zoom">
          <div className="stream-output-preview-viewport" style={{ width: viewWidth * previewScale, height: viewHeight * previewScale }}>
            <div
              className={`stream-output-canvas bg-${activeLayout.backgroundType}`}
              style={{
                width: activeLayout.width * previewScale,
                height: activeLayout.height * previewScale,
                left: -sliceOffsetX * previewScale,
                top: -sliceOffsetY * previewScale,
                backgroundColor: activeLayout.backgroundType === 'color' ? activeLayout.backgroundColor : undefined,
                backgroundImage: activeLayout.backgroundType === 'image' && activeLayout.backgroundUrl ? `url("${activeLayout.backgroundUrl.replaceAll('"', '%22')}")` : undefined,
              }}
            >
              {activeLayout.areas.filter((area) => area.visible).map((area) => (
                <OutputAreaPreview
                  key={area.id}
                  campeonatoId={props.campeonatoId}
                  pack={props.pack}
                  area={area}
                  scale={previewScale}
                  selected={area.id === activeAreaId}
                  onSelect={() => chooseArea(area.id)}
                  onPointerDown={(event, mode) => beginAreaInteraction(event, area, mode)}
                  onPointerMove={moveAreaInteraction}
                  onPointerUp={endAreaInteraction}
                />
              ))}
              {Array.from({ length: Math.max(0, activeLayout.sliceCount - 1) }, (_, index) => (
                <span
                  key={`slice-guide-${index + 1}`}
                  className={`stream-output-slice-guide is-${activeLayout.sliceDirection}`}
                  style={activeLayout.sliceDirection === 'horizontal'
                    ? { left: (activeLayout.sliceWidth * (index + 1)) * previewScale }
                    : { top: (activeLayout.sliceHeight * (index + 1)) * previewScale }}
                />
              ))}
              {Array.from({ length: activeLayout.sliceCount }, (_, index) => (
                <span
                  key={`slice-label-${index + 1}`}
                  className={`stream-output-slice-label${activeSliceIndex === index ? ' is-active' : ''}`}
                  style={activeLayout.sliceDirection === 'horizontal'
                    ? { left: ((activeLayout.sliceWidth * index) + 12) * previewScale, top: 12 * previewScale }
                    : { left: 12 * previewScale, top: ((activeLayout.sliceHeight * index) + 12) * previewScale }}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="stream-output-export-host" aria-hidden="true">
          <div
            ref={exportBoardRef}
            className="stream-output-export-canvas"
            style={{
              width: activeLayout.width,
              height: activeLayout.height,
              backgroundColor: activeLayout.backgroundType === 'color' ? activeLayout.backgroundColor : activeLayout.backgroundType === 'transparent' && activeLayout.outputFormat === 'jpg' ? '#ffffff' : 'transparent',
              backgroundImage: activeLayout.backgroundType === 'image' && activeLayout.backgroundUrl ? `url("${activeLayout.backgroundUrl.replaceAll('"', '%22')}")` : undefined,
            }}
          >
            {activeLayout.areas.filter((area) => area.visible).map((area) => (
              <OutputAreaPreview
                key={`export-${area.id}`}
                campeonatoId={props.campeonatoId}
                pack={props.pack}
                area={area}
                scale={1}
                selected={false}
                interactive={false}
                onSelect={() => undefined}
                onPointerDown={() => undefined}
                onPointerMove={() => undefined}
                onPointerUp={() => undefined}
              />
            ))}
          </div>
        </div>
        <p className="stream-hint">Clique numa área para editar diretamente no palco. O fundo continua único na prancha inteira; use as abas de fatia apenas para conferir cada corte do carrossel.</p>
      </aside>

      <aside className="stream-output-elements">
        <div className="stream-package-elements-head"><strong>Elementos da arte</strong><small>Selecione aqui; as ferramentas aparecem à esquerda.</small></div>
        {!activeArea ? (
          <div className="stream-output-elements-empty">Selecione uma área da overlay no palco ou na aba Áreas.</div>
        ) : (
          <div className="stream-package-element-list stream-output-element-list">
            <button type="button" className={outputInspectorItem === 'area' ? 'active' : ''} onClick={() => { setOutputInspectorItem('area'); setToolsTab('areas') }}><small>ÁREA</small><b>Posição da overlay</b></button>
            {STREAM_SYSTEM_OVERLAY_META[activeArea.overlayType].structure === 'table' ? <>
              <button type="button" className={outputInspectorItem === 'table' ? 'active' : ''} onClick={() => { setOutputInspectorItem('table'); setToolsTab('edit') }}><small>TABELA</small><b>Bloco da tabela</b></button>
              <button type="button" className={outputInspectorItem === 'header' ? 'active' : ''} onClick={() => { setOutputInspectorItem('header'); setToolsTab('edit') }}><small>LEGENDA</small><b>Legenda da tabela</b></button>
            </> : null}
            <button type="button" className={outputInspectorItem === 'loose_image' ? 'active' : ''} onClick={() => { setOutputInspectorItem('loose_image'); setToolsTab('edit') }}><small>IMAGEM</small><b>Imagem da overlay</b></button>
            <button type="button" className={outputInspectorItem === 'loose_text' ? 'active' : ''} onClick={() => { setOutputInspectorItem('loose_text'); setToolsTab('edit') }}><small>TÍTULO</small><b>Título da overlay</b></button>
            {activeAreaColumns.length ? <div className="stream-output-elements-group-label">Colunas</div> : null}
            {activeAreaColumns.map((column) => (
              <button type="button" key={column} className={outputInspectorItem === `column_${column}` ? 'active' : ''} onClick={() => { setOutputInspectorItem(`column_${column}` as OutputInspectorItem); setToolsTab('edit') }}>
                <small>COLUNA</small><b>{STREAM_OVERLAY_COLUMN_META[column].label}</b>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
