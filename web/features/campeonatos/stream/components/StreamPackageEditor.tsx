'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [activePanel, setActivePanel] = useState<EditorPanel>('scene')
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

  function patchCard(patch: Partial<StreamOverlayPackage['shared_config']['card']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, card: { ...prev.shared_config.card, ...patch } } }))
  }

  function patchAnimation(patch: Partial<StreamOverlayPackage['shared_config']['animation']>) {
    setPack((prev) => ({ ...prev, shared_config: { ...prev.shared_config, animation: { ...prev.shared_config.animation, ...patch } } }))
  }

  function applyTablePreset(preset: (typeof STREAM_TABLE_PRESETS)[number]) {
    setPack((prev) => ({
      ...prev,
      shared_config: { ...prev.shared_config, table: structuredClone(preset.values) },
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
      <div className="stream-package-topbar">
        <div>
          <p className="eyebrow">Pacote visual do campeonato</p>
          <h2>Editor de transmissão</h2>
          <p className="stream-hint">Escolha as overlays do pacote e edite os elementos compartilhados uma única vez.</p>
        </div>
        <div className="stream-package-topbar-actions">
          <span className="stream-package-count"><b>{enabledCount}</b> de {STREAM_SYSTEM_OVERLAYS.length} overlays ativas</span>
          <button type="button" className="stream-primary-btn" onClick={() => void savePackage()} disabled={saving || needsSql}>
            {saving ? <Loader2 className="spin" size={15} /> : <Save size={15} />} Salvar pacote
          </button>
        </div>
      </div>

      {needsSql ? <div className="stream-error">Rode as migrations pendentes do pacote antes de salvar. Para saídas/postagens: <code>database/migrations/20260811_stream_output_layouts.sql</code>.</div> : null}
      {feedback ? <p className="stream-hint stream-package-feedback">{feedback}</p> : null}

      <div className="stream-package-mode-tabs" role="tablist" aria-label="Área de trabalho do pacote">
        <button type="button" className={workspaceMode === 'overlays' ? 'active' : ''} onClick={() => setWorkspaceMode('overlays')}>Overlays / Live</button>
        <button type="button" className={workspaceMode === 'outputs' ? 'active' : ''} onClick={() => setWorkspaceMode('outputs')}>Saídas / Postagens</button>
      </div>

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
          <nav className="stream-package-panel-tabs" aria-label="Configurações do pacote">
            {EDITOR_PANELS.map((panel) => (
              <button
                type="button"
                key={panel.id}
                className={activePanel === panel.id ? 'active' : ''}
                onClick={() => setActivePanel(panel.id)}
                title={panel.description}
              >
                {panel.label}
              </button>
            ))}
          </nav>

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
                <div className="stream-package-section-title">
                  <div>
                    <small>Preview ao vivo do editor</small>
                    <strong>{activeMeta.name}</strong>
                    <p>Dados reais do campeonato. Alterações visuais aparecem aqui antes de salvar.</p>
                    {renderData.source ? <small>Fonte: {renderData.source}</small> : null}
                    {renderDataError ? <small className="stream-error">{renderDataError}</small> : null}
                  </div>
                  <button type="button" className="stream-secondary-btn" onClick={() => setRenderDataVersion((value) => value + 1)} disabled={renderDataLoading}>
                    {renderDataLoading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />} Atualizar dados
                  </button>
                </div>
                <div className="stream-package-preview-toolbar" aria-label="Ferramentas do palco">
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
                <div className="stream-package-preview-footer">
                  <span className={`stream-package-status-dot${activeEnabled ? ' on' : ''}`} />
                  <span>{activeEnabled ? 'Ativa no pacote' : 'Prévia apenas — overlay desativada'}</span>
                  <span>{canvasProfile.width} × {canvasProfile.height} · {canvasProfile.kind === 'stream' ? 'Stream' : canvasProfile.kind === 'social' ? 'Social' : 'PNG transparente'}</span>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>
      )}
    </section>
  )
}
