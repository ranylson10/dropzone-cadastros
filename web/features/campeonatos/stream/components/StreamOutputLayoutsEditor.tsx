'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Copy, Download, ImagePlus, Loader2, Maximize2, Minus, Plus, Trash2 } from 'lucide-react'
import JSZip from 'jszip'
import { StreamPackageStage } from './StreamPackageStage'
import { loadStreamPackageRenderData } from '../services/stream-package-data.service'
import { renderStreamOutputCanvas } from '../services/stream-output-canvas-renderer'
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
  STREAM_OUTPUT_PROFILES,
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
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
    profileId: 'live-hd',
    x,
    y,
    width: Math.max(240, layout.sliceWidth - 120),
    height: Math.max(180, Math.min(720, layout.sliceHeight - 160)),
    zIndex: index,
    dataStart: 1,
    dataEnd: 12,
    visible: true,
    contentMode: 'clean',
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

  const profile = STREAM_OUTPUT_PROFILES.find((item) => item.id === props.area.profileId) || STREAM_OUTPUT_PROFILES[0]
  const areaPack = useMemo(() => packForOutputArea(props.pack, props.area), [props.area, props.pack])
  const displayWidth = props.area.width * props.scale
  const displayHeight = props.area.height * props.scale
  const innerScale = Math.min(displayWidth / profile.width, displayHeight / profile.height)

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
      <div className="stream-output-area-stage" style={{ width: profile.width, height: profile.height, transform: `scale(${innerScale})` }}>
        <StreamPackageStage
          pack={areaPack}
          type={props.area.overlayType}
          data={data}
          preview
          canvasWidth={profile.width}
          canvasHeight={profile.height}
          outputProfileId={props.area.profileId}
          contentOnly={props.area.contentMode === 'clean'}
        />
      </div>
      {interactive ? <span className="stream-output-area-badge">{props.area.dataStart}–{props.area.dataEnd}</span> : null}
      {interactive && props.selected ? (
        <button
          type="button"
          className="stream-output-area-resize-handle"
          aria-label="Redimensionar área"
          onPointerDown={(event) => { event.stopPropagation(); props.onPointerDown(event, 'resize') }}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
          onPointerCancel={props.onPointerUp}
        />
      ) : null}
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
      ...(patch.show === true ? { contentMode: 'full' } : {}),
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
      x: clamp(source.x + 24, 0, Math.max(0, activeLayout.width - source.width)),
      y: clamp(source.y + 24, 0, Math.max(0, activeLayout.height - source.height)),
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
      let x = clamp(original.x + dx, 0, Math.max(0, activeLayout.width - original.width))
      let y = clamp(original.y + dy, 0, Math.max(0, activeLayout.height - original.height))
      const snappedLeft = snapCoordinate(x, 'x')
      const snappedRight = snapCoordinate(x + original.width, 'x') - original.width
      const snappedTop = snapCoordinate(y, 'y')
      const snappedBottom = snapCoordinate(y + original.height, 'y') - original.height
      if (snapEnabled) {
        x = Math.abs(snappedLeft - x) <= Math.abs(snappedRight - x) ? snappedLeft : snappedRight
        y = Math.abs(snappedTop - y) <= Math.abs(snappedBottom - y) ? snappedTop : snappedBottom
      }
      patchArea(interaction.areaId, { x: Math.round(x), y: Math.round(y) })
      return
    }

    let width = clamp(original.width + dx, 80, Math.max(80, activeLayout.width - original.x))
    let height = clamp(original.height + dy, 80, Math.max(80, activeLayout.height - original.y))
    if (original.lockAspect) {
      const ratio = original.width / Math.max(1, original.height)
      if (Math.abs(dx) >= Math.abs(dy)) height = width / ratio
      else width = height * ratio
      width = clamp(width, 80, Math.max(80, activeLayout.width - original.x))
      height = clamp(height, 80, Math.max(80, activeLayout.height - original.y))
    }
    if (snapEnabled) {
      width = snapCoordinate(original.x + width, 'x') - original.x
      height = snapCoordinate(original.y + height, 'y') - original.y
    }
    patchArea(interaction.areaId, { width: Math.max(80, Math.round(width)), height: Math.max(80, Math.round(height)) })
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
        x: clamp(activeArea.x + dx, 0, Math.max(0, activeLayout.width - activeArea.width)),
        y: clamp(activeArea.y + dy, 0, Math.max(0, activeLayout.height - activeArea.height)),
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeArea, activeLayout])

  const sortedAreas = useMemo(() => activeLayout ? [...activeLayout.areas].sort((a, b) => a.zIndex - b.zIndex) : [], [activeLayout])

  async function renderFinalBoard() {
    if (!activeLayout || !exportBoardRef.current) throw new Error('Prancha de exportação indisponível.')
    const entries = await Promise.all(activeLayout.areas.filter((area) => area.visible).map(async (area) => ({
      area,
      pack: packForOutputArea(props.pack, area),
      data: await loadStreamPackageRenderData(props.campeonatoId, area.overlayType),
    })))
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
          <label>Largura da fatia<input type="number" min={240} max={7680} value={activeLayout.sliceWidth} onChange={(event) => patchSlices({ sliceWidth: Math.max(240, Number(event.target.value) || 1080) })} /></label>
          <label>Altura da fatia<input type="number" min={240} max={7680} value={activeLayout.sliceHeight} onChange={(event) => patchSlices({ sliceHeight: Math.max(240, Number(event.target.value) || 1350) })} /></label>
          <label>Quantidade<input type="number" min={1} max={8} value={activeLayout.sliceCount} onChange={(event) => patchSlices({ sliceCount: Math.max(1, Math.min(8, Number(event.target.value) || 1)) })} /></label>
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
            <label>Variante visual<select value={activeArea.profileId} onChange={(event) => patchArea(activeArea.id, { profileId: event.target.value as StreamOutputArea['profileId'] })}>{STREAM_OUTPUT_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
            <label>Conteúdo da área<select value={activeArea.contentMode} onChange={(event) => patchArea(activeArea.id, { contentMode: event.target.value as StreamOutputArea['contentMode'] })}><option value="clean">Limpo · só conteúdo dinâmico</option><option value="full">Completo · inclui título/logo da cena</option></select></label>
            <div className="stream-package-quad-grid"><label>Do item<input type="number" min={1} value={activeArea.dataStart} onChange={(event) => patchArea(activeArea.id, { dataStart: Math.max(1, Number(event.target.value) || 1) })} /></label><label>Até<input type="number" min={activeArea.dataStart} value={activeArea.dataEnd} onChange={(event) => patchArea(activeArea.id, { dataEnd: Math.max(activeArea.dataStart, Number(event.target.value) || activeArea.dataStart) })} /></label></div>
            <div className="stream-package-quad-grid"><label>X<input type="number" value={activeArea.x} onChange={(event) => patchArea(activeArea.id, { x: Number(event.target.value) || 0 })} /></label><label>Y<input type="number" value={activeArea.y} onChange={(event) => patchArea(activeArea.id, { y: Number(event.target.value) || 0 })} /></label><label>Largura<input type="number" min={80} value={activeArea.width} onChange={(event) => patchArea(activeArea.id, { width: Math.max(80, Number(event.target.value) || 80) })} /></label><label>Altura<input type="number" min={80} value={activeArea.height} onChange={(event) => patchArea(activeArea.id, { height: Math.max(80, Number(event.target.value) || 80) })} /></label></div>
            <label className="stream-package-switch-row"><span><b>Manter proporção ao redimensionar</b></span><input type="checkbox" checked={activeArea.lockAspect} onChange={(event) => patchArea(activeArea.id, { lockAspect: event.target.checked })} /></label>
            <small className="stream-output-shortcuts">Arraste a área no palco. Use o canto inferior direito para redimensionar. Setas movem 1 px; Shift + seta move 10 px; Ctrl/Cmd + D duplica.</small>
          </div>
        ) : <div className="stream-output-tab-empty">Selecione uma área da composição para configurar.</div>}
        </> : null}

        {toolsTab === 'edit' ? (activeArea ? (
          <div className="stream-output-area-config stream-output-area-editor-tab">
            {activeAreaConfig && activeAreaTable && activeAreaLooseImage && activeAreaLooseText ? <div className="stream-output-local-editor">
              <div className="stream-output-local-editor-head"><div><strong>Editor desta postagem</strong><small>{activeArea.inheritFromLive !== false ? 'Ajustes locais sobre a base herdada da live.' : 'Edição própria desta postagem, independente da live.'}</small></div>{activeArea.overrides ? <button type="button" title={activeArea.inheritFromLive !== false ? 'Limpar ajustes locais e usar a live' : 'Limpar ajustes próprios'} onClick={() => patchArea(activeArea.id, { overrides: undefined })}>Restaurar</button> : null}</div>
              <div className="stream-output-selection-hint">Selecione o elemento no painel da direita. As ferramentas aparecem aqui.</div>

              {outputInspectorItem === 'table' ? <div className="stream-package-property-group"><b>Tabela</b><div className="stream-package-quad-grid"><label>Altura da linha<input type="number" min={20} value={activeAreaTable.rowHeight} onChange={(event) => patchAreaTable({ rowHeight: Math.max(20, Number(event.target.value) || 20) })} /></label><label>Espaço entre linhas<input type="number" min={0} value={activeAreaTable.rowGap} onChange={(event) => patchAreaTable({ rowGap: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Gap das células<input type="number" min={0} value={activeAreaTable.cellGap} onChange={(event) => patchAreaTable({ cellGap: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Espaço entre blocos<input type="number" min={0} value={activeAreaTable.panelGap} onChange={(event) => patchAreaTable({ panelGap: Math.max(0, Number(event.target.value) || 0) })} /></label></div><label>Blocos<select value={activeAreaConfig.tableMode || activeAreaTable.mode} onChange={(event) => patchAreaOverrides({ tableMode: event.target.value as 'single' | 'double' })}><option value="single">Uma coluna</option><option value="double">Duas colunas</option></select></label><div className="stream-output-column-toggles">{availableAreaColumns.map((column) => <label key={column}><input type="checkbox" checked={activeAreaColumns.includes(column)} onChange={(event) => { const columns = event.target.checked ? [...activeAreaColumns, column] : activeAreaColumns.filter((item) => item !== column); patchAreaOverrides({ columns }) }} />{STREAM_OVERLAY_COLUMN_META[column].label}</label>)}</div></div> : null}

              {outputInspectorItem === 'header' ? <div className="stream-package-property-group"><b>Legenda</b><label className="stream-package-switch-row"><span><b>Exibir legenda</b></span><input type="checkbox" checked={activeAreaTable.showHeaders} onChange={(event) => patchAreaTable({ showHeaders: event.target.checked })} /></label><label>Altura<input type="number" min={16} value={activeAreaTable.headerHeight} onChange={(event) => patchAreaTable({ headerHeight: Math.max(16, Number(event.target.value) || 16) })} /></label><div className="stream-package-quad-grid"><label>Fonte<select value={activeAreaTable.headerFontFamily || 'Rajdhani'} onChange={(event) => patchAreaTable({ headerFontFamily: event.target.value })}>{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label><label>Tamanho<input type="number" min={8} value={activeAreaTable.headerFontSize || 16} onChange={(event) => patchAreaTable({ headerFontSize: Math.max(8, Number(event.target.value) || 8) })} /></label><label>Peso<input type="number" min={100} max={900} step={100} value={activeAreaTable.headerFontWeight || 700} onChange={(event) => patchAreaTable({ headerFontWeight: Math.max(100, Number(event.target.value) || 100) })} /></label><label>Cor<input type="color" value={activeAreaTable.headerColor || '#ffffff'} onChange={(event) => patchAreaTable({ headerColor: event.target.value })} /></label></div></div> : null}

              {outputInspectorItem === 'loose_image' ? <div className="stream-package-property-group"><b>Imagem</b><label className="stream-package-switch-row"><span><b>Exibir logo</b></span><input type="checkbox" checked={activeAreaLooseImage.show} onChange={(event) => patchAreaLoose('image', { show: event.target.checked })} /></label><label>Imagem<select value={activeAreaLooseImage.assetKey || 'event_logo'} onChange={(event) => patchAreaLoose('image', { assetKey: event.target.value as StreamPackageAssetKey })}>{ASSET_OPTIONS.map((asset) => <option key={asset.key} value={asset.key}>{asset.label}</option>)}</select></label><label className="stream-secondary-btn stream-package-inspector-upload">{uploadingOutputAsset ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} Trocar imagem<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadOutputAsset(activeAreaLooseImage.assetKey || 'event_logo', event.target.files?.[0])} /></label><div className="stream-package-quad-grid"><label>X<input type="number" value={activeAreaLooseImage.x} onChange={(event) => patchAreaLoose('image', { x: Number(event.target.value) || 0 })} /></label><label>Y<input type="number" value={activeAreaLooseImage.y} onChange={(event) => patchAreaLoose('image', { y: Number(event.target.value) || 0 })} /></label><label>Largura<input type="number" min={20} value={activeAreaLooseImage.width} onChange={(event) => patchAreaLoose('image', { width: Math.max(20, Number(event.target.value) || 20) })} /></label><label>Altura<input type="number" min={20} value={activeAreaLooseImage.height} onChange={(event) => patchAreaLoose('image', { height: Math.max(20, Number(event.target.value) || 20) })} /></label></div></div> : null}

              {outputInspectorItem === 'loose_text' ? <div className="stream-package-property-group"><b>Texto</b><label>Conteúdo<input value={activeAreaConfig.title || ''} placeholder="Título da postagem" onChange={(event) => patchAreaOverrides({ title: event.target.value })} /></label><label className="stream-package-switch-row"><span><b>Exibir título</b></span><input type="checkbox" checked={activeAreaLooseText.show} onChange={(event) => patchAreaLoose('text', { show: event.target.checked })} /></label><label>Fonte<select value={activeAreaLooseText.fontFamily} onChange={(event) => patchAreaLoose('text', { fontFamily: event.target.value })}>{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label><div className="stream-package-quad-grid"><label>X<input type="number" value={activeAreaLooseText.x} onChange={(event) => patchAreaLoose('text', { x: Number(event.target.value) || 0 })} /></label><label>Y<input type="number" value={activeAreaLooseText.y} onChange={(event) => patchAreaLoose('text', { y: Number(event.target.value) || 0 })} /></label><label>Largura<input type="number" min={20} value={activeAreaLooseText.width} onChange={(event) => patchAreaLoose('text', { width: Math.max(20, Number(event.target.value) || 20) })} /></label><label>Tamanho<input type="number" min={8} value={activeAreaLooseText.fontSize} onChange={(event) => patchAreaLoose('text', { fontSize: Math.max(8, Number(event.target.value) || 8) })} /></label><label>Peso<input type="number" min={100} max={900} step={100} value={activeAreaLooseText.fontWeight} onChange={(event) => patchAreaLoose('text', { fontWeight: Math.max(100, Number(event.target.value) || 100) })} /></label><label>Cor<input type="color" value={activeAreaLooseText.color} onChange={(event) => patchAreaLoose('text', { color: event.target.value })} /></label></div></div> : null}

              {selectedOutputColumn && selectedOutputColumnKey ? <div className="stream-package-property-group"><b>{STREAM_OVERLAY_COLUMN_META[selectedOutputColumnKey]?.kind === 'image' ? 'Imagem e célula' : 'Texto e célula'}</b>{STREAM_OVERLAY_COLUMN_META[selectedOutputColumnKey]?.kind !== 'image' ? <div className="stream-package-quad-grid"><label>Fonte<select value={selectedOutputColumn.fontFamily} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { fontFamily: event.target.value })}>{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label><label>Tamanho<input type="number" min={8} value={selectedOutputColumn.fontSize} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { fontSize: Math.max(8, Number(event.target.value) || 8) })} /></label><label>Peso<input type="number" min={100} max={900} step={100} value={selectedOutputColumn.fontWeight} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { fontWeight: Math.max(100, Number(event.target.value) || 100) })} /></label><label>Cor<input type="color" value={selectedOutputColumn.color} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { color: event.target.value })} /></label><label>Inclinação<select value={selectedOutputColumn.fontStyle} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { fontStyle: event.target.value as 'normal' | 'italic' })}><option value="normal">Reta</option><option value="italic">Itálica</option></select></label><label>Alinhar<select value={selectedOutputColumn.align} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { align: event.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div> : null}<label>Largura da coluna<input type="number" min={20} value={selectedOutputColumn.width || ''} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { width: event.target.value ? Math.max(20, Number(event.target.value)) : null })} /></label><label>Preenchimento<select value={selectedOutputColumn.backgroundType} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { backgroundType: event.target.value as 'solid' | 'gradient' | 'image' })}><option value="solid">Sólido</option><option value="gradient">Degradê</option><option value="image">Imagem</option></select></label>{selectedOutputColumn.backgroundType === 'solid' ? <label>Cor<input type="color" value={selectedOutputColumn.backgroundColor} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { backgroundColor: event.target.value })} /></label> : null}{selectedOutputColumn.backgroundType === 'gradient' ? <label>Degradê<input value={selectedOutputColumn.backgroundGradient} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { backgroundGradient: event.target.value })} /></label> : null}{selectedOutputColumn.backgroundType === 'image' && selectedOutputColumn.assetKey ? <label className="stream-secondary-btn stream-package-inspector-upload">{uploadingOutputAsset ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} Trocar fundo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void uploadOutputAsset(selectedOutputColumn.assetKey!, event.target.files?.[0])} /></label> : null}<div className="stream-package-quad-grid"><label>Margem X<input type="number" min={0} value={selectedOutputColumn.paddingX || 0} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { paddingX: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Margem Y<input type="number" min={0} value={selectedOutputColumn.paddingY || 0} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { paddingY: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Borda<input type="color" value={selectedOutputColumn.borderColor} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { borderColor: event.target.value })} /></label><label>Espessura<input type="number" min={0} value={selectedOutputColumn.borderWidth} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { borderWidth: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Canto<input type="number" min={0} value={selectedOutputColumn.borderRadius} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { borderRadius: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Opacidade<input type="number" min={0} max={100} value={Math.round((selectedOutputColumn.opacity ?? 1) * 100)} onChange={(event) => patchAreaColumn(selectedOutputColumnKey, { opacity: Math.max(0, Math.min(1, (Number(event.target.value) || 0) / 100)) })} /></label></div></div> : null}

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
