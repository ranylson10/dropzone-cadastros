'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { Check, Grid3X3, ImagePlus, Loader2, Maximize2, Move, RefreshCw, Save, ZoomIn, ZoomOut } from 'lucide-react'
import { StreamPackageStage } from './StreamPackageStage'
import { StreamOutputLayoutsEditor } from './StreamOutputLayoutsEditor'
import type { StreamPackageRenderData } from '../types/stream-package.types'
import { loadStreamPackageRenderData } from '../services/stream-package-data.service'
import {
  normalizeStreamOverlayPackage,
  resolveStreamCardConfig,
  resolveStreamLayoutConfig,
  resolveStreamLooseImageConfig,
  resolveStreamLooseTextConfig,
  resolveStreamOverlayConfig,
  resolveStreamTableConfig,
} from '../services/stream-package-config'
import { supabase } from '@/lib/supabase-browser'
import { uploadPublicFile } from '@/lib/upload-public'
import {
  DEFAULT_STREAM_OVERLAY_CONFIGS,
  STREAM_OUTPUT_PROFILES,
  STREAM_CARD_PRESETS,
  STREAM_OVERLAY_COLUMN_META,
  STREAM_SYSTEM_OVERLAY_META,
  STREAM_SYSTEM_OVERLAYS,
  STREAM_TABLE_PRESETS,
  type StreamOutputProfileId,
  type StreamOverlayPackage,
  type StreamPackageAssetKey,
  type StreamPackageOutputVariantConfig,
  type StreamSystemOverlayType,
  type StreamTableColumnStyleKey,
} from '../types/stream-package.types'

type PreviewBackground = 'transparent' | 'dark' | 'light'

type EditorPanel = 'scene' | 'identity' | 'layout' | 'assets' | 'tables' | 'cards' | 'animation'

const EDITOR_PANELS: Array<{ id: EditorPanel; label: string; description: string }> = [
  { id: 'assets', label: 'Artes do pacote', description: 'Envie as artes que o pacote reutiliza nas overlays.' },
  { id: 'scene', label: 'Cena selecionada', description: 'Conteúdo e exceções apenas desta overlay.' },
  { id: 'identity', label: 'Identidade', description: 'Logo, título, cores e tipografia usadas pelo pacote inteiro.' },
  { id: 'layout', label: 'Layout', description: 'Posição e escala do bloco principal, compartilhadas por todos os perfis.' },
  { id: 'tables', label: 'Tabelas', description: 'Uma configuração visual para todas as tabelas.' },
  { id: 'cards', label: 'Cards', description: 'Uma configuração visual para todos os cards.' },
  { id: 'animation', label: 'Animação', description: 'Entrada e ritmo compartilhados pelo pacote.' },
]

type StreamPackageAssetUsage = 'all' | 'table' | 'cards'
type PackageInspectorItem = StreamPackageAssetKey | `column_${StreamTableColumnStyleKey}` | `scene_${string}` | 'event_title' | 'table_row' | 'table_header' | 'table_block' | 'card_block'

type StreamPackageAssetDefinition = {
  key: StreamPackageAssetKey
  label: string
  description: string
  group: 'Identidade' | 'Tabelas' | 'Cards'
  usage: StreamPackageAssetUsage
}

const PACKAGE_ASSETS: StreamPackageAssetDefinition[] = [
  { key: 'event_logo', label: 'Logo do campeonato', description: 'Marca principal exibida como imagem solta do pacote.', group: 'Identidade', usage: 'all' },
  { key: 'top_art', label: 'Arte superior', description: 'Moldura ou acabamento visual sobre a composição completa.', group: 'Identidade', usage: 'all' },
  { key: 'table_row_bg', label: 'Fundo da linha', description: 'Base compartilhada de cada linha de tabela.', group: 'Tabelas', usage: 'table' },
  { key: 'table_rank_bg', label: 'Fundo da posição', description: 'Fundo da célula de ranking/posição.', group: 'Tabelas', usage: 'table' },
  { key: 'table_logo_bg', label: 'Fundo da logo', description: 'Fundo da célula que recebe a logo da equipe.', group: 'Tabelas', usage: 'table' },
  { key: 'table_name_bg', label: 'Fundo do nome', description: 'Fundo do nome da equipe ou jogador.', group: 'Tabelas', usage: 'table' },
  { key: 'table_stat_bg', label: 'Fundo de estatística', description: 'Base única para abates, quedas, booyahs e demais stats.', group: 'Tabelas', usage: 'table' },
  { key: 'table_points_bg', label: 'Fundo de pontos', description: 'Destaque visual compartilhado da pontuação.', group: 'Tabelas', usage: 'table' },
  { key: 'card_bg', label: 'Fundo do card', description: 'Base visual comum dos cards do pacote.', group: 'Cards', usage: 'cards' },
  { key: 'card_stats_bg', label: 'Fundo da área de stats', description: 'Área compartilhada para os números e textos do card.', group: 'Cards', usage: 'cards' },
]

function assetUsageOverlays(asset: StreamPackageAssetDefinition): StreamSystemOverlayType[] {
  if (asset.usage === 'all') return [...STREAM_SYSTEM_OVERLAYS]
  return STREAM_SYSTEM_OVERLAYS.filter((type) => STREAM_SYSTEM_OVERLAY_META[type].structure === asset.usage)
}

async function authFetch(url: string, options?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Falha ao salvar pacote de overlays.')
  return json
}

export function StreamPackageEditor(props: { campeonatoId: string }) {
  const [pack, setPack] = useState<StreamOverlayPackage>(() => normalizeStreamOverlayPackage(props.campeonatoId, {}))
  const [activeType, setActiveType] = useState<StreamSystemOverlayType>('standings_general')
  const [workspaceMode, setWorkspaceMode] = useState<'overlays' | 'outputs'>('overlays')
  const [activePanel, setActivePanel] = useState<EditorPanel>('assets')
  const [selectedInspectorItem, setSelectedInspectorItem] = useState<PackageInspectorItem>('event_logo')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<StreamPackageAssetKey | null>(null)
  const [feedback, setFeedback] = useState('')
  const [needsSql, setNeedsSql] = useState(false)
  const [renderData, setRenderData] = useState<StreamPackageRenderData>({ items: [] })
  const [renderDataLoading, setRenderDataLoading] = useState(false)
  const [renderDataError, setRenderDataError] = useState('')
  const [renderDataVersion, setRenderDataVersion] = useState(0)
  const [canvasProfileId, setCanvasProfileId] = useState<StreamOutputProfileId>('live-hd')
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>('transparent')
  const [showGrid, setShowGrid] = useState(false)
  const [showSafeArea, setShowSafeArea] = useState(false)
  const [zoom, setZoom] = useState(.5)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null)
  const canvasProfile = useMemo(
    () => STREAM_OUTPUT_PROFILES.find((profile) => profile.id === canvasProfileId) || STREAM_OUTPUT_PROFILES[0],
    [canvasProfileId],
  )

  const fitPreview = useCallback(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    const availableWidth = Math.max(160, workspace.clientWidth - 64)
    const availableHeight = Math.max(160, workspace.clientHeight - 64)
    const next = Math.min(1, availableWidth / canvasProfile.width, availableHeight / canvasProfile.height)
    setZoom(Math.max(.05, Math.min(4, next)))
    setPan({ x: 0, y: 0 })
  }, [canvasProfile.height, canvasProfile.width])

  useEffect(() => {
    fitPreview()
    const workspace = workspaceRef.current
    if (!workspace || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => fitPreview())
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [fitPreview])

  function clampZoom(value: number) {
    return Math.max(.05, Math.min(4, value))
  }

  function handleWorkspaceWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const workspace = workspaceRef.current
    if (!workspace) return
    const rect = workspace.getBoundingClientRect()
    const pointerX = event.clientX - rect.left - rect.width / 2
    const pointerY = event.clientY - rect.top - rect.height / 2
    const previous = zoom
    const next = clampZoom(previous * (event.deltaY < 0 ? 1.1 : .9))
    if (next === previous) return
    const ratio = next / previous
    setPan((current) => ({
      x: pointerX - (pointerX - current.x) * ratio,
      y: pointerY - (pointerY - current.y) * ratio,
    }))
    setZoom(next)
  }

  function startWorkspacePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 1 && !(event.button === 0 && event.altKey)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
  }

  function moveWorkspacePan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setPan({ x: drag.panX + event.clientX - drag.x, y: drag.panY + event.clientY - drag.y })
  }

  function stopWorkspacePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const json = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/pack`)
        if (!mounted) return
        setPack(normalizeStreamOverlayPackage(props.campeonatoId, json.pack || {}))
        setNeedsSql(Boolean(json.needs_package_sql))
      } catch (error: any) {
        if (mounted) setFeedback(error?.message || 'Erro ao carregar pacote.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [props.campeonatoId])

  const activeConfig = useMemo(
    () => resolveStreamOverlayConfig(pack, activeType, canvasProfileId),
    [activeType, canvasProfileId, pack.overlay_configs],
  )
  const activeOutputVariant = canvasProfileId === 'live-hd'
    ? undefined
    : pack.overlay_configs[activeType]?.outputVariants?.[canvasProfileId]
  const editingOutputVariant = canvasProfileId !== 'live-hd'
  const activeMeta = STREAM_SYSTEM_OVERLAY_META[activeType]
  const activeStructure = (editingOutputVariant ? activeOutputVariant?.structureOverrides : activeConfig.structureOverrides) || {}
  const activeLoose = (editingOutputVariant ? activeOutputVariant?.looseOverrides : activeConfig.looseOverrides) || {}
  const activeAssetOverrides = (editingOutputVariant ? activeOutputVariant?.assetOverrides : activeConfig.assetOverrides) || {}
  const activeLooseImage = resolveStreamLooseImageConfig(pack, activeType, canvasProfileId)
  const activeLooseText = resolveStreamLooseTextConfig(pack, activeType, canvasProfileId)
  const looseOverrideCount = Object.values(activeLoose as Record<string, object | undefined>).reduce<number>((total, section) => total + Object.keys(section || {}).length, 0)
  const activeLayout = resolveStreamLayoutConfig(pack, activeType, canvasProfileId)
  const activeTable = resolveStreamTableConfig(pack, activeType, canvasProfileId)
  const activeCard = resolveStreamCardConfig(pack, activeType, canvasProfileId)
  const structureOverrideCount = Object.values(activeStructure as Record<string, object | undefined>).reduce<number>((total, section) => total + Object.keys(section || {}).length, 0)
  const activeEnabled = pack.enabled_overlay_types.includes(activeType)
  const enabledCount = pack.enabled_overlay_types.length
  const selectedAsset = PACKAGE_ASSETS.find((asset) => asset.key === selectedInspectorItem)
  const selectedSceneItem = typeof selectedInspectorItem === 'string' && selectedInspectorItem.startsWith('scene_')
    ? (activeConfig.sceneItems || []).find((item) => item.id === selectedInspectorItem.slice(6))
    : undefined
  const selectedColumnStyleKey = typeof selectedInspectorItem === 'string' && selectedInspectorItem.startsWith('column_')
    ? selectedInspectorItem.slice(7) as StreamTableColumnStyleKey
    : null
  const selectedColumnStyle = selectedColumnStyleKey ? pack.shared_config.table.columnStyles[selectedColumnStyleKey] : null
  const headerSlot = typeof document === 'undefined' ? null : document.getElementById('stream-package-header-slot')

  useEffect(() => {
    let mounted = true
    setRenderDataLoading(true)
    setRenderDataError('')
    ;(async () => {
      try {
        const data = await loadStreamPackageRenderData(props.campeonatoId, activeType)
        if (mounted) setRenderData(data)
      } catch (error: any) {
        if (!mounted) return
        setRenderData({ items: [], emptyMessage: 'Não foi possível carregar os dados reais desta overlay.' })
        setRenderDataError(error?.message || 'Falha ao carregar dados reais da overlay.')
      } finally {
        if (mounted) setRenderDataLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [props.campeonatoId, activeType, renderDataVersion])

  function setOverlayEnabled(type: StreamSystemOverlayType, enabled: boolean) {
    setPack((prev) => ({
      ...prev,
      enabled_overlay_types: enabled
        ? Array.from(new Set([...prev.enabled_overlay_types, type]))
        : prev.enabled_overlay_types.filter((item) => item !== type),
    }))
  }

  function chooseOverlay(type: StreamSystemOverlayType) {
    setActiveType(type)
    setActivePanel('scene')
  }

  function patchActiveConfig(patch: Partial<StreamPackageOutputVariantConfig>) {
    setPack((prev) => {
      const stored = prev.overlay_configs[activeType] || structuredClone(DEFAULT_STREAM_OVERLAY_CONFIGS[activeType])
      if (canvasProfileId === 'live-hd') {
        return {
          ...prev,
          overlay_configs: {
            ...prev.overlay_configs,
            [activeType]: { ...stored, ...patch },
          },
        }
      }
      const variants = { ...(stored.outputVariants || {}) }
      variants[canvasProfileId] = { ...(variants[canvasProfileId] || {}), ...patch }
      return {
        ...prev,
        overlay_configs: {
          ...prev.overlay_configs,
          [activeType]: { ...stored, outputVariants: variants },
        },
      }
    })
  }

  function addSceneItem(type: 'text' | 'image' | 'timer' | 'round_counter') {
    const id = `${type}-${Date.now()}`
    const item = { id, type, show: true, x: 120, y: 120, width: type === 'round_counter' ? 620 : 300, height: type === 'round_counter' ? 90 : 90, text: type === 'text' ? 'Texto livre' : type === 'timer' ? '00:00' : '', color: '#ffffff', fontSize: 38, fontWeight: 800, currentRound: 1, totalRounds: 12 }
    patchActiveConfig({ sceneItems: [...(activeConfig.sceneItems || []), item] })
    setSelectedInspectorItem(`scene_${id}`)
    setActivePanel('assets')
  }

  function patchSceneItem(id: string, patch: Record<string, unknown>) {
    patchActiveConfig({ sceneItems: (activeConfig.sceneItems || []).map((item) => item.id === id ? { ...item, ...patch } : item) })
  }

  function removeSceneItem(id: string) {
    patchActiveConfig({ sceneItems: (activeConfig.sceneItems || []).filter((item) => item.id !== id) })
    setSelectedInspectorItem('event_logo')
  }

  async function uploadSceneItemImage(id: string, field: 'imageUrl' | 'backgroundUrl' | 'pastUrl' | 'currentUrl' | 'nextUrl', file?: File | null) {
    if (!file) return
    try { patchSceneItem(id, { [field]: await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId: props.campeonatoId }) }) }
    catch (error: any) { setFeedback(error?.message || 'Erro ao enviar imagem.') }
  }

  function createActiveOutputVariant() {
    if (canvasProfileId === 'live-hd' || activeOutputVariant) return
    setPack((prev) => {
      const stored = prev.overlay_configs[activeType] || structuredClone(DEFAULT_STREAM_OVERLAY_CONFIGS[activeType])
      return {
        ...prev,
        overlay_configs: {
          ...prev.overlay_configs,
          [activeType]: {
            ...stored,
            outputVariants: { ...(stored.outputVariants || {}), [canvasProfileId]: {} },
          },
        },
      }
    })
  }

  function clearActiveOutputVariant() {
    if (canvasProfileId === 'live-hd') return
    setPack((prev) => {
      const stored = prev.overlay_configs[activeType] || structuredClone(DEFAULT_STREAM_OVERLAY_CONFIGS[activeType])
      const variants = { ...(stored.outputVariants || {}) }
      delete variants[canvasProfileId]
      return {
        ...prev,
        overlay_configs: {
          ...prev.overlay_configs,
          [activeType]: { ...stored, outputVariants: Object.keys(variants).length ? variants : undefined },
        },
      }
    })
  }

  function patchActiveStructure<K extends 'layout' | 'table' | 'card'>(
    section: K,
    patch: Partial<StreamOverlayPackage['shared_config'][K]>,
  ) {
    const current = (editingOutputVariant ? activeOutputVariant?.structureOverrides : activeConfig.structureOverrides) || {}
    patchActiveConfig({
      structureOverrides: {
        ...current,
        [section]: { ...(current[section] || {}), ...patch },
      },
    })
  }

  function clearActiveStructure(section?: 'layout' | 'table' | 'card') {
    if (!section) {
      patchActiveConfig({ structureOverrides: undefined })
      return
    }
    const next = { ...((editingOutputVariant ? activeOutputVariant?.structureOverrides : activeConfig.structureOverrides) || {}) }
    delete next[section]
    patchActiveConfig({ structureOverrides: Object.keys(next).length ? next : undefined })
  }

  function patchActiveLoose<K extends 'image' | 'text'>(
    section: K,
    patch: Partial<K extends 'image' ? StreamOverlayPackage['shared_config']['looseImage'] : StreamOverlayPackage['shared_config']['looseText']>,
  ) {
    const current = (editingOutputVariant ? activeOutputVariant?.looseOverrides : activeConfig.looseOverrides) || {}
    patchActiveConfig({
      looseOverrides: {
        ...current,
        [section]: { ...(current[section] || {}), ...patch },
      },
    })
  }

  function clearActiveLoose(section?: 'image' | 'text') {
    if (!section) {
      patchActiveConfig({ looseOverrides: undefined })
      return
    }
    const next = { ...((editingOutputVariant ? activeOutputVariant?.looseOverrides : activeConfig.looseOverrides) || {}) }
    delete next[section]
    patchActiveConfig({ looseOverrides: Object.keys(next).length ? next : undefined })
  }

  function restoreActiveSceneDefaults() {
    if (canvasProfileId !== 'live-hd') {
      clearActiveOutputVariant()
      return
    }
    setPack((prev) => ({
      ...prev,
      overlay_configs: {
        ...prev.overlay_configs,
        [activeType]: {
          ...structuredClone(DEFAULT_STREAM_OVERLAY_CONFIGS[activeType]),
          outputVariants: prev.overlay_configs[activeType]?.outputVariants,
        },
      },
    }))
  }

  function patchIdentity(patch: Partial<StreamOverlayPackage['shared_config']['identity']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, identity: { ...prev.shared_config.identity, ...patch } } }))
  }

  function patchLooseImage(patch: Partial<StreamOverlayPackage['shared_config']['looseImage']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, looseImage: { ...prev.shared_config.looseImage, ...patch } } }))
  }

  function patchLooseText(patch: Partial<StreamOverlayPackage['shared_config']['looseText']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, looseText: { ...prev.shared_config.looseText, ...patch } } }))
  }

  function patchLayout(patch: Partial<StreamOverlayPackage['shared_config']['layout']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, layout: { ...prev.shared_config.layout, ...patch } } }))
  }

  function patchTable(patch: Partial<StreamOverlayPackage['shared_config']['table']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, table: { ...prev.shared_config.table, ...patch } } }))
  }

  function patchColumnStyle(key: StreamTableColumnStyleKey, patch: Partial<StreamOverlayPackage['shared_config']['table']['columnStyles'][StreamTableColumnStyleKey]>) {
    const current = pack.shared_config.table.columnStyles[key]
    patchTable({ columnStyles: { ...pack.shared_config.table.columnStyles, [key]: { ...current, ...patch } } })
  }

  function patchCard(patch: Partial<StreamOverlayPackage['shared_config']['card']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, card: { ...prev.shared_config.card, ...patch } } }))
  }

  function patchAnimation(patch: Partial<StreamOverlayPackage['shared_config']['animation']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, animation: { ...prev.shared_config.animation, ...patch } } }))
  }

  function applyTablePreset(preset: (typeof STREAM_TABLE_PRESETS)[number]) {
    setPack((prev) => ({
      ...prev,
      shared_config: { ...prev.shared_config, table: { ...structuredClone(preset.values), columnStyles: prev.shared_config.table.columnStyles } },
    }))
  }

  function applyCardPreset(preset: (typeof STREAM_CARD_PRESETS)[number]) {
    setPack((prev) => ({
      ...prev,
      shared_config: { ...prev.shared_config, card: structuredClone(preset.values) },
    }))
  }

  async function uploadAsset(key: StreamPackageAssetKey, file?: File | null) {
    if (!file) return
    setUploading(key)
    setFeedback('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId: props.campeonatoId })
      setPack((prev) => ({ ...prev, assets: { ...prev.assets, [key]: url } }))
    } catch (error: any) {
      setFeedback(error?.message || 'Erro ao enviar imagem.')
    } finally {
      setUploading(null)
    }
  }

  function removeAsset(key: StreamPackageAssetKey) {
    setPack((prev) => {
      const assets = { ...prev.assets }
      delete assets[key]
      return { ...prev, assets }
    })
  }

  async function uploadSceneAsset(key: StreamPackageAssetKey, file?: File | null) {
    if (!file) return
    setUploading(key)
    setFeedback('')
    try {
      const url = await uploadPublicFile(file, 'campeonato', 'produtora', { campeonatoId: props.campeonatoId })
      patchActiveConfig({
        assetOverrides: { ...((editingOutputVariant ? activeOutputVariant?.assetOverrides : activeConfig.assetOverrides) || {}), [key]: url },
      })
    } catch (error: any) {
      setFeedback(error?.message || 'Erro ao enviar exceção visual.')
    } finally {
      setUploading(null)
    }
  }

  function removeSceneAssetOverride(key: StreamPackageAssetKey) {
    const next = { ...((editingOutputVariant ? activeOutputVariant?.assetOverrides : activeConfig.assetOverrides) || {}) }
    delete next[key]
    patchActiveConfig({ assetOverrides: next })
  }

  const activeSceneAssets = PACKAGE_ASSETS.filter((asset) =>
    asset.usage === 'all' || asset.usage === activeMeta.structure,
  )

  async function savePackage() {
    setSaving(true)
    setFeedback('')
    try {
      const json = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/pack`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled_overlay_types: pack.enabled_overlay_types,
          assets: pack.assets,
          shared_config: pack.shared_config,
          overlay_configs: pack.overlay_configs,
          output_layouts: pack.output_layouts,
          schema_version: 3,
        }),
      })
      setPack((prev) => ({ ...prev, updated_at: json.pack?.updated_at || prev.updated_at }))
      setNeedsSql(Boolean(json.needs_package_sql))
      setFeedback('Pacote salvo. Overlays, variantes e saídas para postagem foram atualizadas.')
    } catch (error: any) {
      setFeedback(error?.message || 'Erro ao salvar pacote.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <section className="stream-panel stream-package-loading"><Loader2 className="spin" size={22} /> Carregando pacote…</section>
  }

  return (
    <section className="stream-package-editor stream-package-editor-v2" aria-label="Editor do pacote de overlays">
      {headerSlot ? createPortal(<div className="stream-package-header-controls">
        <div className="stream-package-header-tabs"><button type="button" className={workspaceMode === 'overlays' ? 'active' : ''} onClick={() => setWorkspaceMode('overlays')}>Overlays</button><button type="button" className={workspaceMode === 'outputs' ? 'active' : ''} onClick={() => setWorkspaceMode('outputs')}>Postagens</button></div>
        <span className="stream-package-count"><b>{enabledCount}</b>/{STREAM_SYSTEM_OVERLAYS.length}</span>
        <button type="button" className="stream-primary-btn" onClick={() => void savePackage()} disabled={saving || needsSql}>{saving ? <Loader2 className="spin" size={15} /> : <Save size={15} />} Salvar</button>
      </div>, headerSlot) : null}

      {needsSql ? <div className="stream-error">Rode as migrations pendentes do pacote antes de salvar. Para saídas/postagens: <code>database/migrations/20260811_stream_output_layouts.sql</code>.</div> : null}
      {feedback ? <p className="stream-hint stream-package-feedback">{feedback}</p> : null}

      {workspaceMode === 'outputs' ? (
        <StreamOutputLayoutsEditor
          campeonatoId={props.campeonatoId}
          pack={pack}
          layouts={pack.output_layouts}
          onChange={(outputLayouts) => setPack((current) => ({ ...current, output_layouts: outputLayouts }))}
        />
      ) : (
      <div className="stream-package-workbench">
        <aside className="stream-package-scenes">
          <div className="stream-package-scenes-head">
            <strong>Overlays do pacote</strong>
            <small>Marque as que serão usadas na transmissão.</small>
          </div>
          <div className="stream-package-overlay-list">
            {STREAM_SYSTEM_OVERLAYS.map((type) => {
              const meta = STREAM_SYSTEM_OVERLAY_META[type]
              const enabled = pack.enabled_overlay_types.includes(type)
              return (
                <div key={type} className={`stream-package-overlay-item${activeType === type ? ' active' : ''}${enabled ? ' enabled' : ''}`}>
                  <button type="button" className="stream-package-overlay-main" onClick={() => chooseOverlay(type)}>
                    <span><b>{meta.name}</b><small>{meta.description}</small></span>
                  </button>
                  <button
                    type="button"
                    className={`stream-package-scene-toggle${enabled ? ' checked' : ''}`}
                    aria-label={`${enabled ? 'Desativar' : 'Ativar'} ${meta.name}`}
                    aria-pressed={enabled}
                    onClick={() => setOverlayEnabled(type, !enabled)}
                  >
                    {enabled ? <Check size={13} /> : null}
                  </button>
                </div>
              )
            })}
          </div>
        </aside>

        <main className="stream-package-main">
          <div className="stream-package-editor-grid">
            <div className="stream-package-controls">
              {activePanel === 'scene' ? (
                <section className="stream-package-section stream-package-control-card">
                  <div className="stream-package-section-title">
                    <div>
                      <small>Configuração individual</small>
                      <h3>{activeMeta.name}</h3>
                      <p>Somente regras que realmente mudam nesta cena. Visual, fontes e fundos continuam herdados do pacote.</p>
                    </div>
                    <button type="button" className="stream-secondary-btn" onClick={restoreActiveSceneDefaults}>{editingOutputVariant ? 'Herdar cena base' : 'Restaurar padrão'}</button>
                  </div>

                  {editingOutputVariant ? (
                    <div className={`stream-package-output-variant${activeOutputVariant ? ' is-custom' : ''}`}>
                      <div>
                        <strong>{canvasProfile.label}</strong>
                        <small>{activeOutputVariant
                          ? 'Variante própria desta cena. Só os campos alterados aqui deixam de herdar a base da live.'
                          : 'Herdando a cena base da live. Ao alterar um campo, o sistema cria somente a exceção deste formato.'}</small>
                      </div>
                      {activeOutputVariant
                        ? <button type="button" className="stream-package-link-btn" onClick={clearActiveOutputVariant}>Remover variante</button>
                        : <button type="button" className="stream-package-link-btn" onClick={createActiveOutputVariant}>Criar variante</button>}
                    </div>
                  ) : (
                    <div className="stream-package-output-variant is-base">
                      <div><strong>Base da live</strong><small>Esta é a configuração principal herdada pelos demais formatos quando não existe uma variante.</small></div>
                    </div>
                  )}

                  <label className="stream-package-switch-row">
                    <span><b>Usar esta overlay</b><small>{activeEnabled ? 'Disponível no controlador da transmissão.' : 'Fora do pacote e indisponível no controlador.'}</small></span>
                    <input type="checkbox" checked={activeEnabled} onChange={(e) => setOverlayEnabled(activeType, e.target.checked)} />
                  </label>

                  <label>Título desta overlay
                    <input value={activeConfig.title || ''} onChange={(e) => patchActiveConfig({ title: e.target.value })} />
                  </label>
                  <label>Máximo de itens
                    <input type="number" min={1} max={48} value={activeConfig.maxItems || 1} onChange={(e) => patchActiveConfig({ maxItems: Number(e.target.value) || 1 })} />
                  </label>

                  {activeMeta.structure === 'table' ? (
                    <label>Distribuição desta tabela
                      <select value={activeConfig.tableMode || pack.shared_config.table.mode} onChange={(e) => patchActiveConfig({ tableMode: e.target.value as 'single' | 'double' })}>
                        <option value="single">1 coluna</option>
                        <option value="double">2 colunas</option>
                      </select>
                    </label>
                  ) : null}

                  {DEFAULT_STREAM_OVERLAY_CONFIGS[activeType].columns?.length ? (
                    <div className="stream-package-fields-block">
                      <b>Campos exibidos</b>
                      <small>O template define quais campos existem; você apenas liga ou desliga o que quer mostrar.</small>
                      <div className="stream-package-column-options">
                        {DEFAULT_STREAM_OVERLAY_CONFIGS[activeType].columns?.map((column) => {
                          const selected = activeConfig.columns?.includes(column) ?? false
                          return (
                            <label key={column} className={`stream-package-column-option${selected ? ' is-on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  const current = activeConfig.columns || []
                                  patchActiveConfig({ columns: selected ? current.filter((item) => item !== column) : [...current, column] })
                                }}
                              />
                              <span>{STREAM_OVERLAY_COLUMN_META[column]?.label || column}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="stream-package-kit-callout">
                    <div>
                      <b>Artes e fundos são compartilhados</b>
                      <small>Logo do campeonato, fundos de linha e cards são enviados uma vez e reaproveitados automaticamente.</small>
                    </div>
                    <button type="button" className="stream-secondary-btn" onClick={() => setActivePanel('assets')}>Abrir artes do pacote</button>
                  </div>

                  <details className="stream-package-advanced-section stream-package-scene-structure">
                    <summary>
                      <span><b>Imagem e título desta cena</b><small>Logo e título herdam o padrão do pacote. Abra apenas se precisar de uma exceção.</small></span>
                      <em>{looseOverrideCount ? `${looseOverrideCount} ajustes ativos` : 'Opcional'}</em>
                    </summary>
                    <div className="stream-package-advanced-section-body">
                    <div className="stream-package-scene-assets-head">
                      <div><b>Imagem e título soltos</b><small>Logo e título herdam posição e estilo do pacote. Abra exceção apenas para esta cena quando necessário.</small></div>
                      <span>{looseOverrideCount} ajustes</span>
                    </div>

                    <div className="stream-package-subsection">
                      <div className="stream-package-subsection-head"><strong>Imagem solta</strong>{activeLoose.image ? <button type="button" className="stream-package-link-btn" onClick={() => clearActiveLoose('image')}>Herdar imagem</button> : null}</div>
                      <label className="stream-package-switch-row"><span><b>Exibir nesta cena</b></span><input type="checkbox" checked={activeLooseImage.show} onChange={(e) => patchActiveLoose('image', { show: e.target.checked })} /></label>
                      <div className="stream-package-quad-grid">
                        <label>X<input type="number" value={activeLooseImage.x} onChange={(e) => patchActiveLoose('image', { x: Number(e.target.value) || 0 })} /></label>
                        <label>Y<input type="number" value={activeLooseImage.y} onChange={(e) => patchActiveLoose('image', { y: Number(e.target.value) || 0 })} /></label>
                        <label>Largura<input type="number" min={1} value={activeLooseImage.width} onChange={(e) => patchActiveLoose('image', { width: Number(e.target.value) || pack.shared_config.looseImage.width })} /></label>
                        <label>Altura<input type="number" min={1} value={activeLooseImage.height} onChange={(e) => patchActiveLoose('image', { height: Number(e.target.value) || pack.shared_config.looseImage.height })} /></label>
                      </div>
                    </div>

                    <div className="stream-package-subsection">
                      <div className="stream-package-subsection-head"><strong>Título solto</strong>{activeLoose.text ? <button type="button" className="stream-package-link-btn" onClick={() => clearActiveLoose('text')}>Herdar título</button> : null}</div>
                      <label className="stream-package-switch-row"><span><b>Exibir nesta cena</b></span><input type="checkbox" checked={activeLooseText.show} onChange={(e) => patchActiveLoose('text', { show: e.target.checked })} /></label>
                      <div className="stream-package-quad-grid">
                        <label>X<input type="number" value={activeLooseText.x} onChange={(e) => patchActiveLoose('text', { x: Number(e.target.value) || 0 })} /></label>
                        <label>Y<input type="number" value={activeLooseText.y} onChange={(e) => patchActiveLoose('text', { y: Number(e.target.value) || 0 })} /></label>
                        <label>Largura<input type="number" min={1} value={activeLooseText.width} onChange={(e) => patchActiveLoose('text', { width: Number(e.target.value) || pack.shared_config.looseText.width })} /></label>
                        <label>Fonte<input type="number" min={8} max={240} value={activeLooseText.fontSize} onChange={(e) => patchActiveLoose('text', { fontSize: Number(e.target.value) || pack.shared_config.looseText.fontSize })} /></label>
                      </div>
                      <div className="stream-package-color-grid">
                        <label>Cor<input type="color" value={activeLooseText.color} onChange={(e) => patchActiveLoose('text', { color: e.target.value })} /></label>
                        <label>Alinhamento<select value={activeLooseText.align} onChange={(e) => patchActiveLoose('text', { align: e.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
                      </div>
                    </div>
                    </div>
                  </details>

                  <details className="stream-package-advanced-section stream-package-scene-structure">
                    <summary>
                      <span><b>Ajustes de layout desta cena</b><small>Use apenas se esta overlay precisar fugir do padrão do pacote.</small></span>
                      <em>{structureOverrideCount ? `${structureOverrideCount} ajustes ativos` : 'Opcional'}</em>
                    </summary>
                    <div className="stream-package-advanced-section-body">
                    <div className="stream-package-scene-assets-head">
                      <div><b>Exceções estruturais</b><small>Posição, tabela e cards herdam o pacote. Altere somente o campo que esta overlay realmente precisa.</small></div>
                      <span>{structureOverrideCount} ajustes</span>
                    </div>

                    <div className="stream-package-subsection">
                      <div className="stream-package-subsection-head"><strong>Bloco principal</strong>{activeStructure.layout ? <button type="button" className="stream-package-link-btn" onClick={() => clearActiveStructure('layout')}>Herdar layout</button> : null}</div>
                      <div className="stream-package-quad-grid">
                        <label>X<input type="number" value={activeLayout.offsetX} onChange={(e) => patchActiveStructure('layout', { offsetX: Number(e.target.value) || 0 })} /></label>
                        <label>Y<input type="number" value={activeLayout.offsetY} onChange={(e) => patchActiveStructure('layout', { offsetY: Number(e.target.value) || 0 })} /></label>
                        <label>Largura %<input type="number" min={50} max={150} value={Math.round(activeLayout.widthScale * 100)} onChange={(e) => patchActiveStructure('layout', { widthScale: Math.max(.5, Math.min(1.5, (Number(e.target.value) || 100) / 100)) })} /></label>
                        <label>Altura %<input type="number" min={50} max={150} value={Math.round(activeLayout.heightScale * 100)} onChange={(e) => patchActiveStructure('layout', { heightScale: Math.max(.5, Math.min(1.5, (Number(e.target.value) || 100) / 100)) })} /></label>
                      </div>
                    </div>

                    {activeMeta.structure === 'table' ? (
                      <div className="stream-package-subsection">
                        <div className="stream-package-subsection-head"><strong>Tabela desta cena</strong>{activeStructure.table ? <button type="button" className="stream-package-link-btn" onClick={() => clearActiveStructure('table')}>Herdar tabela</button> : null}</div>
                        <div className="stream-package-quad-grid">
                          <label>Altura linha<input type="number" min={30} max={180} value={activeTable.rowHeight} onChange={(e) => patchActiveStructure('table', { rowHeight: Number(e.target.value) || pack.shared_config.table.rowHeight })} /></label>
                          <label>Cabeçalho<input type="number" min={24} max={100} value={activeTable.headerHeight} onChange={(e) => patchActiveStructure('table', { headerHeight: Number(e.target.value) || pack.shared_config.table.headerHeight })} /></label>
                          <label>Logo<input type="number" min={50} max={220} value={activeTable.logoWidth} onChange={(e) => patchActiveStructure('table', { logoWidth: Number(e.target.value) || pack.shared_config.table.logoWidth })} /></label>
                          <label>Gap linhas<input type="number" min={0} max={80} value={activeTable.rowGap} onChange={(e) => patchActiveStructure('table', { rowGap: Number(e.target.value) || 0 })} /></label>
                        </div>
                      </div>
                    ) : null}

                    {activeMeta.structure === 'cards' ? (
                      <div className="stream-package-subsection">
                        <div className="stream-package-subsection-head"><strong>Cards desta cena</strong>{activeStructure.card ? <button type="button" className="stream-package-link-btn" onClick={() => clearActiveStructure('card')}>Herdar cards</button> : null}</div>
                        <div className="stream-package-quad-grid">
                          <label>Largura<input type="number" min={180} max={700} value={activeCard.width} onChange={(e) => patchActiveStructure('card', { width: Number(e.target.value) || pack.shared_config.card.width })} /></label>
                          <label>Altura<input type="number" min={180} max={800} value={activeCard.height} onChange={(e) => patchActiveStructure('card', { height: Number(e.target.value) || pack.shared_config.card.height })} /></label>
                          <label>Colunas<input type="number" min={1} max={8} value={activeCard.columns} onChange={(e) => patchActiveStructure('card', { columns: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} /></label>
                          <label>Gap<input type="number" min={0} max={80} value={activeCard.gap} onChange={(e) => patchActiveStructure('card', { gap: Number(e.target.value) || 0 })} /></label>
                        </div>
                      </div>
                    ) : null}
                    </div>
                  </details>

                  <details className="stream-package-advanced-section stream-package-scene-assets">
                    <summary>
                      <span><b>Usar uma arte diferente nesta cena</b><small>Por padrão, todas as artes vêm do kit visual compartilhado.</small></span>
                      <em>{Object.keys(activeAssetOverrides).length ? `${Object.keys(activeAssetOverrides).length} exceções ativas` : 'Opcional'}</em>
                    </summary>
                    <div className="stream-package-advanced-section-body">
                    <div className="stream-package-scene-assets-head">
                      <div><b>Exceções do kit visual</b><small>Por padrão esta overlay herda os mesmos arquivos do pacote. Crie exceção somente quando esta cena realmente precisar de uma arte diferente.</small></div>
                      <span>{Object.keys(activeAssetOverrides).length} exceções</span>
                    </div>
                    <div className="stream-package-scene-asset-list">
                      {activeSceneAssets.map((asset) => {
                        const overrideUrl = activeAssetOverrides[asset.key]
                        const inheritedUrl = pack.assets[asset.key]
                        return (
                          <article key={asset.key} className={`stream-package-scene-asset${overrideUrl ? ' is-override' : ''}`}>
                            <div>
                              <b>{asset.label}</b>
                              <small>{overrideUrl ? 'Exceção desta overlay' : inheritedUrl ? 'Herdando do kit visual' : 'Sem arte no kit visual'}</small>
                            </div>
                            <div className="stream-package-scene-asset-actions">
                              <label className="stream-secondary-btn">
                                {uploading === asset.key ? <Loader2 className="spin" size={13} /> : <ImagePlus size={13} />}
                                {overrideUrl ? 'Trocar exceção' : 'Usar arte própria'}
                                <input type="file" accept="image/*" hidden onChange={(event) => void uploadSceneAsset(asset.key, event.target.files?.[0])} />
                              </label>
                              {overrideUrl ? <button type="button" className="stream-package-link-btn" onClick={() => removeSceneAssetOverride(asset.key)}>Voltar ao padrão</button> : null}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                    </div>
                  </details>
                </section>
              ) : null}

              {activePanel === 'identity' ? (
                <section className="stream-package-section stream-package-control-card">
                  <div className="stream-package-section-title"><div><strong>Identidade compartilhada</strong><p>Estas definições aparecem em todas as overlays do pacote.</p></div></div>
                  <label>Nome do evento
                    <input value={pack.shared_config.identity.eventName} onChange={(e) => patchIdentity({ eventName: e.target.value })} />
                  </label>
                  <label>Fonte principal
                    <input value={pack.shared_config.identity.fontFamily} onChange={(e) => patchIdentity({ fontFamily: e.target.value })} />
                  </label>
                  <div className="stream-package-color-grid">
                    <label>Cor principal<input type="color" value={pack.shared_config.identity.primaryColor} onChange={(e) => patchIdentity({ primaryColor: e.target.value })} /></label>
                    <label>Cor secundária<input type="color" value={pack.shared_config.identity.secondaryColor} onChange={(e) => patchIdentity({ secondaryColor: e.target.value })} /></label>
                  </div>

                  <div className="stream-package-subsection">
                    <strong>Logo / imagem solta</strong>
                    <p>Usa o asset “Logo do campeonato” em todas as cenas.</p>
                    <label className="stream-package-switch-row"><span><b>Exibir logo</b></span><input type="checkbox" checked={pack.shared_config.looseImage.show} onChange={(e) => patchLooseImage({ show: e.target.checked })} /></label>
                    <div className="stream-package-quad-grid">
                      <label>X<input type="number" value={pack.shared_config.looseImage.x} onChange={(e) => patchLooseImage({ x: Number(e.target.value) || 0 })} /></label>
                      <label>Y<input type="number" value={pack.shared_config.looseImage.y} onChange={(e) => patchLooseImage({ y: Number(e.target.value) || 0 })} /></label>
                      <label>Largura<input type="number" min={1} value={pack.shared_config.looseImage.width} onChange={(e) => patchLooseImage({ width: Number(e.target.value) || 1 })} /></label>
                      <label>Altura<input type="number" min={1} value={pack.shared_config.looseImage.height} onChange={(e) => patchLooseImage({ height: Number(e.target.value) || 1 })} /></label>
                    </div>
                  </div>

                  <div className="stream-package-subsection">
                    <strong>Título solto</strong>
                    <p>A posição e o estilo são globais; o texto vem da cena selecionada.</p>
                    <label className="stream-package-switch-row"><span><b>Exibir título</b></span><input type="checkbox" checked={pack.shared_config.looseText.show} onChange={(e) => patchLooseText({ show: e.target.checked })} /></label>
                    <div className="stream-package-quad-grid">
                      <label>X<input type="number" value={pack.shared_config.looseText.x} onChange={(e) => patchLooseText({ x: Number(e.target.value) || 0 })} /></label>
                      <label>Y<input type="number" value={pack.shared_config.looseText.y} onChange={(e) => patchLooseText({ y: Number(e.target.value) || 0 })} /></label>
                      <label>Largura<input type="number" min={1} value={pack.shared_config.looseText.width} onChange={(e) => patchLooseText({ width: Number(e.target.value) || 1 })} /></label>
                      <label>Fonte<input type="number" min={8} max={240} value={pack.shared_config.looseText.fontSize} onChange={(e) => patchLooseText({ fontSize: Number(e.target.value) || 8 })} /></label>
                    </div>
                    <label>Cor do título<input type="color" value={pack.shared_config.looseText.color} onChange={(e) => patchLooseText({ color: e.target.value })} /></label>
                  </div>
                </section>
              ) : null}

              {activePanel === 'layout' ? (
                <section className="stream-package-section stream-package-control-card">
                  <div className="stream-package-section-title"><div><strong>Bloco principal compartilhado</strong><p>O template continua definindo a posição-base de cada tipo. Estes valores apenas deslocam ou escalam o bloco sem quebrar o perfil estrutural.</p></div></div>
                  <div className="stream-package-quad-grid">
                    <label>Deslocamento X<input type="number" min={-900} max={900} value={pack.shared_config.layout.offsetX} onChange={(e) => patchLayout({ offsetX: Number(e.target.value) || 0 })} /></label>
                    <label>Deslocamento Y<input type="number" min={-500} max={500} value={pack.shared_config.layout.offsetY} onChange={(e) => patchLayout({ offsetY: Number(e.target.value) || 0 })} /></label>
                    <label>Largura (%)<input type="number" min={50} max={140} value={Math.round(pack.shared_config.layout.widthScale * 100)} onChange={(e) => patchLayout({ widthScale: Math.max(.5, Math.min(1.4, (Number(e.target.value) || 100) / 100)) })} /></label>
                    <label>Altura (%)<input type="number" min={50} max={140} value={Math.round(pack.shared_config.layout.heightScale * 100)} onChange={(e) => patchLayout({ heightScale: Math.max(.5, Math.min(1.4, (Number(e.target.value) || 100) / 100)) })} /></label>
                  </div>
                  <div className="stream-package-shared-note">Cada overlay mantém seu perfil de sistema (tabela, ranking, cards ou hero). Aqui você faz somente o ajuste global do bloco principal do pacote.</div>
                </section>
              ) : null}

              {activePanel === 'assets' ? (
                <section className="stream-package-section stream-package-control-card stream-package-properties-card">
                  {selectedInspectorItem === 'table_row' ? (
                    <><div className="stream-package-section-title"><div><small>Elemento de tabela</small><strong>Linha</strong><p>Altura e fundo de todas as linhas desta tabela.</p></div></div><div className="stream-package-property-group"><b>Linha</b><label>Altura<input type="number" min={30} max={180} value={pack.shared_config.table.rowHeight} onChange={(e) => patchTable({ rowHeight: Number(e.target.value) || 76 })} /></label><div className="stream-package-selected-asset">{pack.assets.table_row_bg ? <img src={pack.assets.table_row_bg} alt="" /> : <span>Sem imagem</span>}<div><b>Fundo da linha</b><small>Reutilizado nas linhas desta tabela.</small></div></div><label className="stream-secondary-btn stream-package-inspector-upload">{uploading === 'table_row_bg' ? <Loader2 className="spin" size={14} /> : <ImagePlus size={14} />} Trocar imagem da linha<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadAsset('table_row_bg', e.target.files?.[0])} /></label></div></>
                  ) : selectedInspectorItem === 'table_header' ? (
                    <><div className="stream-package-section-title"><div><small>Elemento de tabela</small><strong>Legenda da tabela</strong><p>Texto exibido acima de cada coluna.</p></div></div><div className="stream-package-property-group"><b>Texto da legenda</b><label className="stream-package-switch-row"><span><b>Exibir legenda</b></span><input type="checkbox" checked={pack.shared_config.table.showHeaders} onChange={(e) => patchTable({ showHeaders: e.target.checked })} /></label><div className="stream-package-quad-grid"><label>Fonte<input value={pack.shared_config.table.headerFontFamily || 'Rajdhani'} onChange={(e) => patchTable({ headerFontFamily: e.target.value })} /></label><label>Cor<input type="color" value={pack.shared_config.table.headerColor || '#ffffff'} onChange={(e) => patchTable({ headerColor: e.target.value })} /></label><label>Tamanho<input type="number" min={8} max={120} value={pack.shared_config.table.headerFontSize || 16} onChange={(e) => patchTable({ headerFontSize: Number(e.target.value) || 16 })} /></label><label>Peso<input type="number" min={100} max={900} step={100} value={pack.shared_config.table.headerFontWeight || 800} onChange={(e) => patchTable({ headerFontWeight: Number(e.target.value) || 800 })} /></label></div><label>Altura<input type="number" min={24} max={100} value={pack.shared_config.table.headerHeight} onChange={(e) => patchTable({ headerHeight: Number(e.target.value) || 38 })} /></label>{(activeConfig.columns || []).map((column) => <div className="stream-package-header-column" key={column}><input value={activeConfig.columnLabels?.[column] ?? STREAM_OVERLAY_COLUMN_META[column]?.label ?? column} onChange={(e) => patchActiveConfig({ columnLabels: { ...(activeConfig.columnLabels || {}), [column]: e.target.value } })} /><label><input type="checkbox" checked={!activeConfig.hiddenHeaders?.includes(column)} onChange={(e) => patchActiveConfig({ hiddenHeaders: e.target.checked ? (activeConfig.hiddenHeaders || []).filter((item) => item !== column) : [...(activeConfig.hiddenHeaders || []), column] })} /> Exibir</label></div>)}</div></>
                  ) : selectedColumnStyle && selectedColumnStyleKey ? (
                    <>
                      <div className="stream-package-section-title"><div><small>Estilo de coluna</small><strong>{STREAM_OVERLAY_COLUMN_META[selectedColumnStyleKey]?.label || selectedColumnStyleKey}</strong></div></div>
                      <div className="stream-package-property-group"><b>Texto</b><label>Fonte<input value={selectedColumnStyle.fontFamily} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { fontFamily: e.target.value })} /></label><div className="stream-package-quad-grid"><label>Tamanho<input type="number" min={8} max={160} value={selectedColumnStyle.fontSize} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { fontSize: Number(e.target.value) || 8 })} /></label><label>Peso<input type="number" min={100} max={900} step={100} value={selectedColumnStyle.fontWeight} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { fontWeight: Number(e.target.value) || 400 })} /></label><label>Cor<input type="color" value={selectedColumnStyle.color} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { color: e.target.value })} /></label><label>Inclinação<select value={selectedColumnStyle.fontStyle} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { fontStyle: e.target.value as 'normal' | 'italic' })}><option value="normal">Reta</option><option value="italic">Itálica</option></select></label></div></div>
                      <div className="stream-package-property-group"><b>Célula</b><label>Largura (vazio = automática)<input type="number" min={20} value={selectedColumnStyle.width || ''} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { width: e.target.value ? Number(e.target.value) : null })} /></label><label>Preenchimento<select value={selectedColumnStyle.backgroundType} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { backgroundType: e.target.value as 'solid' | 'gradient' | 'image' })}><option value="solid">Cor sólida</option><option value="gradient">Degradê</option><option value="image">Imagem</option></select></label>{selectedColumnStyle.backgroundType === 'solid' ? <label>Cor<input type="color" value={selectedColumnStyle.backgroundColor} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { backgroundColor: e.target.value })} /></label> : null}{selectedColumnStyle.backgroundType === 'gradient' ? <label>Degradê CSS<input value={selectedColumnStyle.backgroundGradient} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { backgroundGradient: e.target.value })} /></label> : null}{selectedColumnStyle.backgroundType === 'image' && selectedColumnStyle.assetKey ? <><div className="stream-package-selected-asset">{pack.assets[selectedColumnStyle.assetKey] ? <img src={pack.assets[selectedColumnStyle.assetKey]} alt="" /> : <span>Sem imagem</span>}<div><b>{PACKAGE_ASSETS.find((asset) => asset.key === selectedColumnStyle.assetKey)?.label || 'Fundo da coluna'}</b><small>Este é o único fundo usado por esta coluna.</small></div></div><label className="stream-secondary-btn stream-package-inspector-upload">{uploading === selectedColumnStyle.assetKey ? <Loader2 className="spin" size={14} /> : <ImagePlus size={14} />} Trocar imagem desta coluna<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadAsset(selectedColumnStyle.assetKey!, e.target.files?.[0])} /></label></> : null}<div className="stream-package-quad-grid"><label>Cor da borda<input type="color" value={selectedColumnStyle.borderColor} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { borderColor: e.target.value })} /></label><label>Espessura<input type="number" min={0} max={30} value={selectedColumnStyle.borderWidth} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { borderWidth: Number(e.target.value) || 0 })} /></label><label>Canto<input type="number" min={0} max={100} value={selectedColumnStyle.borderRadius} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { borderRadius: Number(e.target.value) || 0 })} /></label><label>Alinhamento<select value={selectedColumnStyle.align} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { align: e.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></div></div>
                      <div className="stream-package-property-group stream-package-cell-spacing"><b>Margem interna</b><p>Cria respiro para logo, imagem, texto ou número dentro da célula.</p><div className="stream-package-quad-grid"><label>Margem lateral<input type="number" min={0} max={160} value={selectedColumnStyle.paddingX ?? 12} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { paddingX: Math.max(0, Number(e.target.value) || 0) })} /></label><label>Margem vertical<input type="number" min={0} max={160} value={selectedColumnStyle.paddingY ?? 6} onChange={(e) => patchColumnStyle(selectedColumnStyleKey, { paddingY: Math.max(0, Number(e.target.value) || 0) })} /></label></div></div>
                    </>
                  ) : selectedSceneItem ? (
                    <><div className="stream-package-section-title"><div><small>Item da cena</small><strong>{selectedSceneItem.type === 'text' ? 'Texto livre' : selectedSceneItem.type === 'image' ? 'Imagem livre' : selectedSceneItem.type === 'timer' ? 'Cronômetro' : 'Contador de quedas'}</strong><p>Este item existe somente nesta overlay.</p></div><button type="button" className="stream-package-link-btn" onClick={() => removeSceneItem(selectedSceneItem.id)}>Remover</button></div><div className="stream-package-property-group"><b>Posição</b><div className="stream-package-quad-grid"><label>X<input type="number" value={selectedSceneItem.x} onChange={(e) => patchSceneItem(selectedSceneItem.id, { x: Number(e.target.value) || 0 })} /></label><label>Y<input type="number" value={selectedSceneItem.y} onChange={(e) => patchSceneItem(selectedSceneItem.id, { y: Number(e.target.value) || 0 })} /></label><label>Largura<input type="number" min={40} value={selectedSceneItem.width} onChange={(e) => patchSceneItem(selectedSceneItem.id, { width: Number(e.target.value) || 40 })} /></label><label>Altura<input type="number" min={24} value={selectedSceneItem.height} onChange={(e) => patchSceneItem(selectedSceneItem.id, { height: Number(e.target.value) || 24 })} /></label></div></div>{selectedSceneItem.type !== 'image' && selectedSceneItem.type !== 'round_counter' ? <div className="stream-package-property-group"><b>Texto</b><label>Conteúdo<input value={selectedSceneItem.text || ''} onChange={(e) => patchSceneItem(selectedSceneItem.id, { text: e.target.value })} /></label><div className="stream-package-quad-grid"><label>Tamanho<input type="number" min={8} value={selectedSceneItem.fontSize || 36} onChange={(e) => patchSceneItem(selectedSceneItem.id, { fontSize: Number(e.target.value) || 8 })} /></label><label>Cor<input type="color" value={selectedSceneItem.color || '#ffffff'} onChange={(e) => patchSceneItem(selectedSceneItem.id, { color: e.target.value })} /></label></div></div> : null}{selectedSceneItem.type === 'image' ? <label className="stream-primary-btn stream-package-inspector-upload">Enviar imagem<input type="file" accept="image/*" onChange={(e) => void uploadSceneItemImage(selectedSceneItem.id, 'imageUrl', e.target.files?.[0])} /></label> : null}{selectedSceneItem.type === 'round_counter' ? <div className="stream-package-property-group"><b>Quedas</b><div className="stream-package-quad-grid"><label>Atual<input type="number" min={1} value={selectedSceneItem.currentRound || 1} onChange={(e) => patchSceneItem(selectedSceneItem.id, { currentRound: Number(e.target.value) || 1 })} /></label><label>Total<input type="number" min={1} value={selectedSceneItem.totalRounds || 12} onChange={(e) => patchSceneItem(selectedSceneItem.id, { totalRounds: Number(e.target.value) || 1 })} /></label></div>{(['backgroundUrl', 'pastUrl', 'currentUrl', 'nextUrl'] as const).map((field) => <label key={field}>{({ backgroundUrl: 'Fundo', pastUrl: 'Queda concluída', currentUrl: 'Queda atual', nextUrl: 'Próxima queda' }[field])}<input type="file" accept="image/*" onChange={(e) => void uploadSceneItemImage(selectedSceneItem.id, field, e.target.files?.[0])} /></label>)}</div> : null}</>
                  ) : selectedAsset ? (
                    <>
                      <div className="stream-package-section-title"><div><small>Imagem compartilhada</small><strong>{selectedAsset.label}</strong><p>{selectedAsset.description}</p></div></div>
                      <div className="stream-package-inspector-media">{pack.assets[selectedAsset.key] ? <img src={pack.assets[selectedAsset.key]} alt="" /> : <span>Sem imagem</span>}</div>
                      <label className="stream-primary-btn stream-package-inspector-upload">
                        {uploading === selectedAsset.key ? <Loader2 className="spin" size={15} /> : <ImagePlus size={15} />}
                        {pack.assets[selectedAsset.key] ? 'Trocar imagem' : 'Adicionar imagem'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadAsset(selectedAsset.key, event.target.files?.[0])} />
                      </label>
                      {pack.assets[selectedAsset.key] ? <button type="button" className="stream-package-link-btn" onClick={() => removeAsset(selectedAsset.key)}>Remover imagem</button> : null}
                      {selectedAsset.key === 'event_logo' ? <div className="stream-package-property-group"><b>Posição do logo</b><label className="stream-package-switch-row"><span><b>Exibir logo</b></span><input type="checkbox" checked={pack.shared_config.looseImage.show} onChange={(e) => patchLooseImage({ show: e.target.checked })} /></label><div className="stream-package-quad-grid"><label>X<input type="number" value={pack.shared_config.looseImage.x} onChange={(e) => patchLooseImage({ x: Number(e.target.value) || 0 })} /></label><label>Y<input type="number" value={pack.shared_config.looseImage.y} onChange={(e) => patchLooseImage({ y: Number(e.target.value) || 0 })} /></label><label>Largura<input type="number" min={1} value={pack.shared_config.looseImage.width} onChange={(e) => patchLooseImage({ width: Number(e.target.value) || 1 })} /></label><label>Altura<input type="number" min={1} value={pack.shared_config.looseImage.height} onChange={(e) => patchLooseImage({ height: Number(e.target.value) || 1 })} /></label></div></div> : null}
                      <div className="stream-package-shared-note">Esta arte é compartilhada por {assetUsageOverlays(selectedAsset).length} overlays.</div>
                    </>
                  ) : selectedInspectorItem === 'event_title' ? (
                    <>
                      <div className="stream-package-section-title"><div><small>Texto compartilhado</small><strong>Título do campeonato</strong><p>Fonte, cor, tamanho e posição.</p></div></div>
                      <label>Nome do evento<input value={pack.shared_config.identity.eventName} onChange={(e) => patchIdentity({ eventName: e.target.value })} /></label>
                      <label>Fonte<input value={pack.shared_config.identity.fontFamily} onChange={(e) => patchIdentity({ fontFamily: e.target.value })} /></label>
                      <div className="stream-package-quad-grid"><label>Posição X<input type="number" value={pack.shared_config.looseText.x} onChange={(e) => patchLooseText({ x: Number(e.target.value) || 0 })} /></label><label>Posição Y<input type="number" value={pack.shared_config.looseText.y} onChange={(e) => patchLooseText({ y: Number(e.target.value) || 0 })} /></label><label>Tamanho<input type="number" min={8} max={240} value={pack.shared_config.looseText.fontSize} onChange={(e) => patchLooseText({ fontSize: Number(e.target.value) || 8 })} /></label><label>Cor<input type="color" value={pack.shared_config.looseText.color} onChange={(e) => patchLooseText({ color: e.target.value })} /></label></div>
                    </>
                  ) : selectedInspectorItem === 'table_block' ? (
                    <>
                      <div className="stream-package-section-title"><div><small>Bloco desta cena</small><strong>Tabela</strong><p>Mova ou redimensione a tabela sem alterar as demais overlays.</p></div></div>
                      <div className="stream-package-property-group"><b>Posição e escala</b><div className="stream-package-quad-grid"><label>Posição X<input type="number" min={-900} max={900} value={activeLayout.offsetX} onChange={(e) => patchActiveStructure('layout', { offsetX: Number(e.target.value) || 0 })} /></label><label>Posição Y<input type="number" min={-500} max={500} value={activeLayout.offsetY} onChange={(e) => patchActiveStructure('layout', { offsetY: Number(e.target.value) || 0 })} /></label><label>Largura (%)<input type="number" min={50} max={140} value={Math.round(activeLayout.widthScale * 100)} onChange={(e) => patchActiveStructure('layout', { widthScale: Math.max(.5, Math.min(1.4, (Number(e.target.value) || 100) / 100)) })} /></label><label>Altura (%)<input type="number" min={50} max={140} value={Math.round(activeLayout.heightScale * 100)} onChange={(e) => patchActiveStructure('layout', { heightScale: Math.max(.5, Math.min(1.4, (Number(e.target.value) || 100) / 100)) })} /></label></div></div>
                      <div className="stream-package-property-group"><b>Medidas compartilhadas</b><div className="stream-package-quad-grid"><label>Altura da linha<input type="number" min={30} max={180} value={pack.shared_config.table.rowHeight} onChange={(e) => patchTable({ rowHeight: Number(e.target.value) || 76 })} /></label><label>Gap das linhas<input type="number" min={0} max={80} value={pack.shared_config.table.rowGap} onChange={(e) => patchTable({ rowGap: Number(e.target.value) || 0 })} /></label><label>Largura da logo<input type="number" min={50} max={220} value={pack.shared_config.table.logoWidth} onChange={(e) => patchTable({ logoWidth: Number(e.target.value) || 90 })} /></label><label>Coluna de pontos<input type="number" min={60} max={260} value={pack.shared_config.table.pointsWidth} onChange={(e) => patchTable({ pointsWidth: Number(e.target.value) || 118 })} /></label></div></div>
                    </>
                  ) : (
                    <>
                      <div className="stream-package-section-title"><div><small>Bloco compartilhado</small><strong>Cards</strong><p>Medidas e distribuição dos cards.</p></div></div>
                      <div className="stream-package-quad-grid"><label>Largura<input type="number" min={120} max={900} value={pack.shared_config.card.width} onChange={(e) => patchCard({ width: Number(e.target.value) || 360 })} /></label><label>Altura<input type="number" min={120} max={1000} value={pack.shared_config.card.height} onChange={(e) => patchCard({ height: Number(e.target.value) || 470 })} /></label><label>Colunas<input type="number" min={1} max={8} value={pack.shared_config.card.columns} onChange={(e) => patchCard({ columns: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} /></label><label>Espaço<input type="number" min={0} max={100} value={pack.shared_config.card.gap} onChange={(e) => patchCard({ gap: Number(e.target.value) || 0 })} /></label></div>
                    </>
                  )}
                </section>
              ) : null}

              {false ? (
                <section className="stream-package-section stream-package-control-card">
                  <div className="stream-package-section-title"><div><strong>Kit visual compartilhado</strong><p>Envie cada arte uma única vez. O pacote mostra exatamente quais overlays reutilizam o mesmo arquivo.</p></div></div>
                  <div className="stream-package-asset-summary">
                    <span><b>{PACKAGE_ASSETS.filter((asset) => Boolean(pack.assets[asset.key])).length}</b> de {PACKAGE_ASSETS.length} papéis com arte</span>
                    <span><b>{enabledCount}</b> overlays ativas reutilizando o kit</span>
                  </div>
                  {(['Identidade', 'Tabelas', 'Cards'] as const).map((group) => (
                    <div className="stream-package-asset-group" key={group}>
                      <div className="stream-package-asset-group-head">
                        <h4>{group}</h4>
                        <small>{group === 'Identidade' ? 'Compartilhado pelo pacote inteiro.' : group === 'Tabelas' ? 'Um conjunto de fundos para todas as tabelas.' : 'Um conjunto de fundos para todas as cenas de cards.'}</small>
                      </div>
                      <div className="stream-package-assets stream-package-assets-kit">
                        {PACKAGE_ASSETS.filter((asset) => asset.group === group).map((asset) => {
                          const usedBy = assetUsageOverlays(asset)
                          const activeUsedBy = usedBy.filter((type) => pack.enabled_overlay_types.includes(type))
                          return (
                            <article className="stream-package-asset stream-package-asset-kit" key={asset.key}>
                              <div className="stream-package-asset-preview">
                                {pack.assets[asset.key] ? <img src={pack.assets[asset.key]} alt="" /> : <span className="stream-package-asset-empty">Sem imagem</span>}
                              </div>
                              <div className="stream-package-asset-copy">
                                <div><b>{asset.label}</b><p>{asset.description}</p></div>
                                <div className="stream-package-asset-usage">
                                  <small>Usado por {usedBy.length} overlays · {activeUsedBy.length} ativas</small>
                                  <div className="stream-package-asset-usage-list">
                                    {usedBy.map((type) => (
                                      <button
                                        type="button"
                                        key={type}
                                        className={pack.enabled_overlay_types.includes(type) ? 'is-active' : ''}
                                        onClick={() => chooseOverlay(type)}
                                        title={`Abrir ${STREAM_SYSTEM_OVERLAY_META[type].name}`}
                                      >
                                        {STREAM_SYSTEM_OVERLAY_META[type].name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="stream-package-asset-actions">
                                <label className="stream-secondary-btn stream-package-upload-btn">
                                  {uploading === asset.key ? <Loader2 className="spin" size={14} /> : <ImagePlus size={14} />} {pack.assets[asset.key] ? 'Trocar arte' : 'Enviar arte'}
                                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadAsset(asset.key, event.target.files?.[0])} />
                                </label>
                                {pack.assets[asset.key] ? <button type="button" className="stream-package-link-btn" onClick={() => removeAsset(asset.key)}>Remover</button> : null}
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="stream-package-shared-note">Trocar um asset aqui atualiza todas as overlays que usam esse papel. Nenhuma overlay cria cópia própria do arquivo.</div>
                </section>
              ) : null}

              {activePanel === 'tables' ? (
                <section className="stream-package-section stream-package-control-card">
                  <div className="stream-package-section-title"><div><strong>Tabelas compartilhadas</strong><p>Altura, espaçamentos e cabeçalho são definidos uma vez para toda overlay com estrutura de tabela.</p></div></div>
                  <div className="stream-package-presets" aria-label="Presets de tabela">
                    <div className="stream-package-presets-head"><strong>Presets estruturais</strong><small>Escolha uma base pronta e ajuste somente se precisar.</small></div>
                    <div className="stream-package-preset-grid">
                      {STREAM_TABLE_PRESETS.map((preset) => (
                        <button type="button" key={preset.key} className="stream-package-preset-card" onClick={() => applyTablePreset(preset)}>
                          <b>{preset.name}</b><span>{preset.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>Layout padrão
                    <select value={pack.shared_config.table.mode} onChange={(e) => patchTable({ mode: e.target.value as 'single' | 'double' })}>
                      <option value="single">1 coluna</option><option value="double">2 colunas</option>
                    </select>
                  </label>
                  <label className="stream-package-switch-row"><span><b>Exibir cabeçalhos</b></span><input type="checkbox" checked={pack.shared_config.table.showHeaders} onChange={(e) => patchTable({ showHeaders: e.target.checked })} /></label>
                  <label>Altura da linha<input type="number" min={30} max={180} value={pack.shared_config.table.rowHeight} onChange={(e) => patchTable({ rowHeight: Number(e.target.value) || 76 })} /></label>
                  <label>Espaço entre linhas<input type="number" min={0} max={80} value={pack.shared_config.table.rowGap} onChange={(e) => patchTable({ rowGap: Number(e.target.value) || 0 })} /></label>
                  <label>Espaço entre células<input type="number" min={0} max={80} value={pack.shared_config.table.cellGap} onChange={(e) => patchTable({ cellGap: Number(e.target.value) || 0 })} /></label>
                  <label>Gap entre painéis<input type="number" min={0} max={300} value={pack.shared_config.table.panelGap} onChange={(e) => patchTable({ panelGap: Number(e.target.value) || 0 })} /></label>
                  <div className="stream-package-subsection">
                    <strong>Proporções das células</strong>
                    <p>Estas larguras são reutilizadas em todas as tabelas. O campo de nome ocupa automaticamente o espaço restante.</p>
                    <div className="stream-package-quad-grid">
                      <label>Logo<input type="number" min={50} max={220} value={pack.shared_config.table.logoWidth} onChange={(e) => patchTable({ logoWidth: Number(e.target.value) || 90 })} /></label>
                      <label>Estatística<input type="number" min={60} max={240} value={pack.shared_config.table.statWidth} onChange={(e) => patchTable({ statWidth: Number(e.target.value) || 108 })} /></label>
                      <label>Pontos<input type="number" min={60} max={260} value={pack.shared_config.table.pointsWidth} onChange={(e) => patchTable({ pointsWidth: Number(e.target.value) || 118 })} /></label>
                      <label>Cabeçalho<input type="number" min={24} max={100} value={pack.shared_config.table.headerHeight} onChange={(e) => patchTable({ headerHeight: Number(e.target.value) || 38 })} /></label>
                    </div>
                    <label>Alinhamento do nome
                      <select value={pack.shared_config.table.nameAlign} onChange={(e) => patchTable({ nameAlign: e.target.value as 'left' | 'center' | 'right' })}>
                        <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                      </select>
                    </label>
                  </div>
                  <div className="stream-package-shared-note">Fundos de linha, posição, logo, nome, estatísticas e pontos ficam em <button type="button" onClick={() => setActivePanel('assets')}>Kit visual</button> e são reutilizados por todas as tabelas.</div>
                </section>
              ) : null}

              {activePanel === 'cards' ? (
                <section className="stream-package-section stream-package-control-card">
                  <div className="stream-package-section-title"><div><strong>Cards compartilhados</strong><p>Tamanho e composição base valem para MVP, booyahs e outras overlays de cards.</p></div></div>
                  <div className="stream-package-presets" aria-label="Presets de cards">
                    <div className="stream-package-presets-head"><strong>Presets estruturais</strong><small>Um clique aplica tamanho, distribuição e proporções do card.</small></div>
                    <div className="stream-package-preset-grid">
                      {STREAM_CARD_PRESETS.map((preset) => (
                        <button type="button" key={preset.key} className="stream-package-preset-card" onClick={() => applyCardPreset(preset)}>
                          <b>{preset.name}</b><span>{preset.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>Largura do card<input type="number" min={120} max={900} value={pack.shared_config.card.width} onChange={(e) => patchCard({ width: Number(e.target.value) || 360 })} /></label>
                  <label>Altura do card<input type="number" min={120} max={1000} value={pack.shared_config.card.height} onChange={(e) => patchCard({ height: Number(e.target.value) || 470 })} /></label>
                  <label>Altura da imagem<input type="number" min={40} max={700} value={pack.shared_config.card.imageHeight} onChange={(e) => patchCard({ imageHeight: Number(e.target.value) || 220 })} /></label>
                  <label>Gap entre cards<input type="number" min={0} max={100} value={pack.shared_config.card.gap} onChange={(e) => patchCard({ gap: Number(e.target.value) || 0 })} /></label>
                  <label>Raio dos cantos<input type="number" min={0} max={100} value={pack.shared_config.card.radius} onChange={(e) => patchCard({ radius: Number(e.target.value) || 0 })} /></label>
                  <label>Máximo de cards por linha<input type="number" min={1} max={8} value={pack.shared_config.card.columns} onChange={(e) => patchCard({ columns: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} /></label>
                  <label>Alinhamento dos cards
                    <select value={pack.shared_config.card.align} onChange={(e) => patchCard({ align: e.target.value as 'start' | 'center' | 'end' })}>
                      <option value="start">Esquerda</option><option value="center">Centro</option><option value="end">Direita</option>
                    </select>
                  </label>
                  <label>Escala da logo (%)<input type="number" min={40} max={150} value={Math.round(pack.shared_config.card.logoScale * 100)} onChange={(e) => patchCard({ logoScale: Math.max(.4, Math.min(1.5, (Number(e.target.value) || 100) / 100)) })} /></label>
                  <div className="stream-package-shared-note">Fundo do card e fundo da área de stats ficam em <button type="button" onClick={() => setActivePanel('assets')}>Kit visual</button> e são enviados apenas uma vez.</div>
                </section>
              ) : null}

              {activePanel === 'animation' ? (
                <section className="stream-package-section stream-package-control-card">
                  <div className="stream-package-section-title"><div><strong>Animação compartilhada</strong><p>Um único comportamento de entrada mantém o pacote visualmente consistente.</p></div></div>
                  <label>Entrada
                    <select value={pack.shared_config.animation.enter} onChange={(e) => patchAnimation({ enter: e.target.value as 'none' | 'fade' | 'slide' })}>
                      <option value="none">Sem animação</option><option value="fade">Fade</option><option value="slide">Slide</option>
                    </select>
                  </label>
                  <label>Duração (ms)<input type="number" min={0} max={5000} value={pack.shared_config.animation.durationMs} onChange={(e) => patchAnimation({ durationMs: Number(e.target.value) || 0 })} /></label>
                  <label>Distância do slide<input type="number" min={0} max={1000} value={pack.shared_config.animation.distancePx} onChange={(e) => patchAnimation({ distancePx: Number(e.target.value) || 0 })} /></label>
                  <label>Atraso entre itens (ms)<input type="number" min={0} max={1000} value={pack.shared_config.animation.staggerMs} onChange={(e) => patchAnimation({ staggerMs: Number(e.target.value) || 0 })} /></label>
                </section>
              ) : null}
            </div>

            <aside className="stream-package-preview-column">
              <section className="stream-package-section stream-package-preview-section">
                <div className="stream-package-preview-toolbar" aria-label="Ferramentas do palco">
                  <div className="stream-package-preview-title"><span className={`stream-package-status-dot${activeEnabled ? ' on' : ''}`} /><strong>{activeMeta.name}</strong>{renderDataError ? <small className="stream-error">Falha ao atualizar dados</small> : null}</div>
                  <label>Formato
                    <select value={canvasProfileId} onChange={(event) => setCanvasProfileId(event.target.value as StreamOutputProfileId)}>
                      {STREAM_OUTPUT_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                    </select>
                  </label>
                  <div className="stream-package-preview-toolgroup">
                    <button type="button" title="Diminuir zoom" onClick={() => setZoom((value) => clampZoom(value / 1.2))}><ZoomOut size={14} /></button>
                    <button type="button" className="is-zoom" title="Zoom atual" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
                    <button type="button" title="Aumentar zoom" onClick={() => setZoom((value) => clampZoom(value * 1.2))}><ZoomIn size={14} /></button>
                    <button type="button" title="Ajustar palco à área" onClick={fitPreview}><Maximize2 size={14} /> Ajustar</button>
                  </div>
                  <div className="stream-package-preview-toolgroup">
                    <button type="button" className={showGrid ? 'active' : ''} onClick={() => setShowGrid((value) => !value)} title="Mostrar grid"><Grid3X3 size={14} /> Grid</button>
                    <button type="button" className={showSafeArea ? 'active' : ''} onClick={() => setShowSafeArea((value) => !value)} title="Mostrar área segura">Safe</button>
                  </div>
                  <label>Fundo
                    <select value={previewBackground} onChange={(event) => setPreviewBackground(event.target.value as PreviewBackground)}>
                      <option value="transparent">Transparente</option>
                      <option value="dark">Escuro</option>
                      <option value="light">Claro</option>
                    </select>
                  </label>
                  <button type="button" className="stream-package-refresh-btn" title="Atualizar dados da prévia" onClick={() => setRenderDataVersion((value) => value + 1)} disabled={renderDataLoading}>
                    {renderDataLoading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />} Dados
                  </button>
                </div>
                <div
                  ref={workspaceRef}
                  className={`stream-package-preview-workspace bg-${previewBackground}${showGrid ? ' show-grid' : ''}`}
                  onWheel={handleWorkspaceWheel}
                  onPointerDown={startWorkspacePan}
                  onPointerMove={moveWorkspacePan}
                  onPointerUp={stopWorkspacePan}
                  onPointerCancel={stopWorkspacePan}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className="stream-package-preview-pan-hint"><Move size={13} /> Scroll: zoom · botão do meio ou Alt + arrastar: mover</div>
                  <div
                    className="stream-package-preview-canvas"
                    aria-label={`Quadro de sa\u00edda ${canvasProfile.width} por ${canvasProfile.height}`}
                    style={{
                      width: canvasProfile.width,
                      height: canvasProfile.height,
                      // O ponto de ancoragem do palco é o centro da área de preview.
                      // Sem este deslocamento, o canto superior esquerdo do canvas fica no
                      // centro e apenas uma parte da saída aparece, parecendo esticada.
                      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    }}
                  >
                    <StreamPackageStage
                      pack={pack}
                      type={activeType}
                      data={renderData}
                      preview
                      canvasWidth={canvasProfile.width}
                      canvasHeight={canvasProfile.height}
                      outputProfileId={canvasProfileId}
                    />
                    {showSafeArea ? <div className="stream-package-preview-safe-area" aria-hidden /> : null}
                  </div>
                </div>
              </section>
            </aside>
            <aside className="stream-package-elements">
              <div className="stream-package-elements-head"><strong>Elementos da cena</strong><small>Selecione um bloco para editar.</small></div>
              <div className="stream-package-element-list">
                <button type="button" className={selectedInspectorItem === 'event_logo' ? 'active' : ''} onClick={() => { setSelectedInspectorItem('event_logo'); setActivePanel('assets') }}><span>Imagem</span><b>Logo do campeonato</b></button>
                <button type="button" className={selectedInspectorItem === 'event_title' ? 'active' : ''} onClick={() => { setSelectedInspectorItem('event_title'); setActivePanel('assets') }}><span>Texto</span><b>Texto livre</b></button>
                <div className="stream-package-element-group"><small>Itens adicionados</small><div className="stream-package-add-items"><button type="button" onClick={() => addSceneItem('text')}>+ Texto</button><button type="button" onClick={() => addSceneItem('image')}>+ Imagem</button><button type="button" onClick={() => addSceneItem('timer')}>+ Cronômetro</button><button type="button" onClick={() => addSceneItem('round_counter')}>+ Quedas</button></div>{(activeConfig.sceneItems || []).map((item) => <button type="button" key={item.id} className={selectedInspectorItem === `scene_${item.id}` ? 'active' : ''} onClick={() => { setSelectedInspectorItem(`scene_${item.id}`); setActivePanel('assets') }}><span>{item.type === 'image' ? 'Imagem' : item.type === 'round_counter' ? 'Quedas' : item.type === 'timer' ? 'Timer' : 'Texto'}</span><b>{item.type === 'text' || item.type === 'timer' ? (item.text || 'Texto livre') : item.type === 'image' ? 'Imagem livre' : 'Contador de quedas'}</b></button>)}</div>
                {activeMeta.structure === 'table' ? <div className="stream-package-element-group"><small>Tabela</small><button type="button" className={selectedInspectorItem === 'table_block' ? 'active' : ''} onClick={() => { setSelectedInspectorItem('table_block'); setActivePanel('assets') }}><span>Bloco</span><b>Posição da tabela</b></button><button type="button" className={selectedInspectorItem === 'table_row' ? 'active' : ''} onClick={() => { setSelectedInspectorItem('table_row'); setActivePanel('assets') }}><span>Linha</span><b>Linha</b></button><button type="button" className={selectedInspectorItem === 'table_header' ? 'active' : ''} onClick={() => { setSelectedInspectorItem('table_header'); setActivePanel('assets') }}><span>Legenda</span><b>Legenda da tabela</b></button><small>Colunas de {activeMeta.name}</small>{(activeConfig.columns || []).map((styleKey) => <button type="button" key={styleKey} className={selectedInspectorItem === `column_${styleKey}` ? 'active' : ''} onClick={() => { setSelectedInspectorItem(`column_${styleKey}` as PackageInspectorItem); setActivePanel('assets') }}><span>Coluna</span><b>{STREAM_OVERLAY_COLUMN_META[styleKey]?.label || styleKey}</b></button>)}</div> : null}
              </div>
            </aside>
          </div>
        </main>
      </div>
      )}
    </section>
  )
}
