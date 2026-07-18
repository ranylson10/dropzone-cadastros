'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Copy,
  CreditCard,
  Download,
  FolderOpen,
  LayoutTemplate,
  Plus,
  Save,
  Table2,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import {
  fetchOverlay,
  loadStreamSheet,
  saveOverlayRemote,
} from '../services/stream-data.service'
import { TEMPLATE_CATALOG, TEMPLATE_LABEL, createEmptyCard, createOverlayFromTemplate } from '../templates/stream-templates'
import type {
  LayerContentType,
  LayerDataSource,
  StreamBlock,
  StreamCardBlock,
  StreamLayer,
  StreamOverlay,
  StreamTableBlock,
  StreamTemplateId,
} from '../types/stream.types'
import { DEFAULT_BOX, DEFAULT_TRANSITION, newBlockId } from '../types/stream.types'
import { migrateOverlay } from '../utils/migrate-overlay'
import {
  createDefaultLayer,
  createMapCardFolder,
  duplicateCardFolder,
  ensureCardLayers,
} from '../utils/card-layers'
import {
  buildOverlayBrowserHtml,
  buildOverlayExportPayload,
  downloadHtml,
  downloadJson,
} from '../utils/export-overlay'
import { applyVisualPresetToBlock, applyVisualPresetToOverlayBlocks, VISUAL_PRESETS, type VisualPresetId } from '../utils/visual-presets'
import { BoxStyleEditor, FieldStyleEditor, TransitionEditor } from './editor/StylePanels'
import { OverlayPreview, type PreviewMap, type PreviewStanding } from './editor/OverlayPreview'
import '../stream.css'

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ov-${Date.now()}`
}

type InspectorTab = 'dados' | 'aparencia' | 'animacao'

const LAYER_TYPES: Array<{ id: LayerContentType; label: string }> = [
  { id: 'image', label: 'Imagem' },
  { id: 'logo', label: 'Logo' },
  { id: 'text', label: 'Texto' },
  { id: 'number', label: 'Número' },
]

export function StreamOverlayEditor(props: {
  campeonatoId: string
  overlayId?: string
  isNew?: boolean
}) {
  const router = useRouter()
  const [pickingTemplate, setPickingTemplate] = useState(Boolean(props.isNew))
  const [overlay, setOverlay] = useState<StreamOverlay | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [folderMode, setFolderMode] = useState(false)
  const [inspector, setInspector] = useState<InspectorTab>('dados')
  const [saved, setSaved] = useState(false)
  const [saveWarning, setSaveWarning] = useState('')
  const [standings, setStandings] = useState<PreviewStanding[]>([])
  const [mvpRows, setMvpRows] = useState<PreviewStanding[]>([])
  const [maps, setMaps] = useState<PreviewMap[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (props.isNew) {
      setPickingTemplate(true)
      setOverlay(null)
      return
    }
    if (!props.overlayId) return
    let cancelled = false
    ;(async () => {
      const raw = await fetchOverlay(props.campeonatoId, props.overlayId!)
      const migrated = migrateOverlay(raw)
      if (cancelled) return
      setOverlay(migrated)
      const first = migrated?.blocks[0]?.id || null
      setSelectedBlockId(first)
      setPickingTemplate(false)
      if (first) setExpanded({ [first]: true })
    })()
    return () => {
      cancelled = true
    }
  }, [props.campeonatoId, props.overlayId, props.isNew])

  const loadPreviewData = useCallback(async () => {
    setLoadingData(true)
    try {
      const [classif, equipes, mvp, quedas] = await Promise.all([
        loadStreamSheet(props.campeonatoId, 'classificacao').catch(() => []),
        loadStreamSheet(props.campeonatoId, 'equipes').catch(() => []),
        loadStreamSheet(props.campeonatoId, 'mvp').catch(() => []),
        loadStreamSheet(props.campeonatoId, 'quedas').catch(() => []),
      ])

      const standingRows: PreviewStanding[] = classif.map((row, i) => ({
        pos: Number(row.cells.colocacao) || i + 1,
        nome: row.cells.line || '—',
        booyah: row.cells.booyahs || '0',
        abates: row.cells.abates || '0',
        pts: row.cells.pontos || '0',
        delta: '0',
        quedas: '0',
        kd: row.cells.abates ? (Number(row.cells.abates) / 6).toFixed(1).replace('.', ',') : '0',
      }))

      const mvpPreview: PreviewStanding[] = mvp.map((row, i) => ({
        pos: Number(row.cells.colocacao) || i + 1,
        nome: row.cells.nick || '—',
        booyah: '0',
        abates: row.cells.abates || '0',
        pts: '0',
        delta: '0',
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
          const name = String(v.line_nome || v.campeonato_equipe?.line_nome || v.campeonato_equipe?.nome_exibicao || '')
          const logo = String(v.line_logo_url || v.campeonato_equipe?.line_logo_url || '')
          if (name && logo) byName.set(name.toLowerCase(), logo)
        }
        for (const s of standingRows) s.logo = byName.get(s.nome.toLowerCase())
      } catch {
        // ignore
      }

      setStandings(standingRows)
      setMvpRows(mvpPreview.length ? mvpPreview : standingRows)

      const fallbackMaps = ['BERMUDA 1', 'PURGATÓRIO 1', 'NOVA TERRA 1']
      const mapImages: Record<string, string> = {
        bermuda: '/images/maps/bermuda.png',
        purgatorio: '/images/maps/purgatorio.png',
        purgatório: '/images/maps/purgatorio.png',
        'nova terra': '/images/maps/nova-terra.png',
        kalahari: '/images/maps/kalahari.png',
      }
      const fromQuedas = quedas.slice(0, 6).map((q, i) => {
        const mapa = String(q.cells.mapa || fallbackMaps[i] || `MAPA ${i + 1}`)
        const key = mapa.toLowerCase()
        const imageUrl = Object.entries(mapImages).find(([k]) => key.includes(k))?.[1] || '/images/maps/bermuda.png'
        return {
          title: `${mapa}${q.cells.numero ? ` ${q.cells.numero}` : ''}`.toUpperCase(),
          imageUrl,
          logo: standingRows[i]?.logo,
          pts: standingRows[i]?.pts || '0',
          abates: standingRows[i]?.abates || '0',
          nome: standingRows[i]?.nome || equipes[i]?.cells?.line || '',
        }
      })
      setMaps(
        fromQuedas.length
          ? fromQuedas
          : fallbackMaps.map((title, i) => ({
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
    void loadPreviewData()
  }, [loadPreviewData])

  const selectedBlock = useMemo(
    () => overlay?.blocks.find((b) => b.id === selectedBlockId) || null,
    [overlay, selectedBlockId],
  )

  const selectedCard = selectedBlock?.type === 'card' ? ensureCardLayers(selectedBlock) : null
  const selectedLayer = selectedCard?.layers.find((l) => l.id === selectedLayerId) || null

  function pickTemplate(template: StreamTemplateId) {
    const draft = createOverlayFromTemplate(template)
    const full: StreamOverlay = {
      id: newId(),
      ...draft,
      updatedAt: new Date().toISOString(),
    }
    setOverlay(full)
    const first = full.blocks[0]?.id || null
    setSelectedBlockId(first)
    setSelectedLayerId(null)
    setFolderMode(Boolean(first))
    if (first) setExpanded({ [first]: true })
    setPickingTemplate(false)
  }

  function updateOverlay(patch: Partial<StreamOverlay>) {
    setOverlay((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  function updateBlock(blockId: string, updater: (b: StreamBlock) => StreamBlock) {
    setOverlay((prev) => {
      if (!prev) return prev
      return { ...prev, blocks: prev.blocks.map((b) => (b.id === blockId ? updater(b) : b)) }
    })
  }

  function openFolder(blockId: string) {
    setSelectedBlockId(blockId)
    setSelectedLayerId(null)
    setFolderMode(true)
    setExpanded((e) => ({ ...e, [blockId]: true }))
    setInspector('dados')
  }

  function addCardFolder() {
    const cards = overlay?.blocks.filter((b) => b.type === 'card').length || 0
    const card = createMapCardFolder(cards + 1, `MAPA ${cards + 1}`)
    setOverlay((prev) => (prev ? { ...prev, blocks: [...prev.blocks, card] } : prev))
    openFolder(card.id)
  }

  function addEmptyCard() {
    const card = createEmptyCard(`Card ${(overlay?.blocks.filter((b) => b.type === 'card').length || 0) + 1}`)
    setOverlay((prev) => (prev ? { ...prev, blocks: [...prev.blocks, card] } : prev))
    openFolder(card.id)
  }

  function addTableFolder() {
    const block: StreamTableBlock = {
      id: newBlockId(),
      type: 'table',
      name: `Tabela ${(overlay?.blocks.filter((b) => b.type === 'table').length || 0) + 1}`,
      box: { ...DEFAULT_BOX, padding: 0, fill: { mode: 'solid', color: '#1a1208' } },
      transition: { ...DEFAULT_TRANSITION, enter: 'slide-up' },
      data: {
        variant: 'standings',
        source: 'classificacao',
        rows: 10,
        startRank: 1,
        columns: ['pos', 'logo', 'nome', 'booyah', 'abates', 'pts'],
      },
    }
    setOverlay((prev) => (prev ? { ...prev, blocks: [...prev.blocks, block] } : prev))
    openFolder(block.id)
  }

  function removeBlock(blockId: string) {
    setOverlay((prev) => {
      if (!prev) return prev
      return { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) }
    })
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null)
      setSelectedLayerId(null)
      setFolderMode(false)
    }
  }

  function dupCard(blockId: string) {
    const card = overlay?.blocks.find((b) => b.id === blockId && b.type === 'card') as StreamCardBlock | undefined
    if (!card) return
    const ensured = ensureCardLayers(card)
    const nextSlot =
      Math.max(
        0,
        ...ensured.layers
          .map((l) => ('mapSlot' in l.data ? Number(l.data.mapSlot) : 0))
          .filter(Boolean),
      ) + 1 || (overlay?.blocks.filter((b) => b.type === 'card').length || 0) + 1
    const copy = duplicateCardFolder(ensured, nextSlot)
    setOverlay((prev) => (prev ? { ...prev, blocks: [...prev.blocks, copy] } : prev))
    openFolder(copy.id)
  }

  function addLayer(type: LayerContentType) {
    if (!selectedCard) return
    const mapSlot =
      selectedCard.layers.find((l) => 'mapSlot' in l.data)?.data &&
      'mapSlot' in (selectedCard.layers.find((l) => 'mapSlot' in l.data)!.data)
        ? Number((selectedCard.layers.find((l) => 'mapSlot' in l.data)!.data as any).mapSlot)
        : 1
    const layer = createDefaultLayer(type, mapSlot || 1)
    updateBlock(selectedCard.id, (b) => {
      if (b.type !== 'card') return b
      const c = ensureCardLayers(b)
      return { ...c, layers: [...c.layers, layer] }
    })
    setSelectedLayerId(layer.id)
    setInspector('dados')
  }

  function updateLayer(layerId: string, patch: Partial<StreamLayer>) {
    if (!selectedCard) return
    updateBlock(selectedCard.id, (b) => {
      if (b.type !== 'card') return b
      const c = ensureCardLayers(b)
      return {
        ...c,
        layers: c.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      }
    })
  }

  function updateLayerData(layerId: string, data: LayerDataSource) {
    updateLayer(layerId, { data })
  }

  function removeLayer(layerId: string) {
    if (!selectedCard) return
    updateBlock(selectedCard.id, (b) => {
      if (b.type !== 'card') return b
      const c = ensureCardLayers(b)
      return { ...c, layers: c.layers.filter((l) => l.id !== layerId) }
    })
    if (selectedLayerId === layerId) setSelectedLayerId(null)
  }

  function applyPreset(preset: VisualPresetId, scope: 'block' | 'all') {
    setOverlay((prev) => {
      if (!prev) return prev
      if (scope === 'all') return { ...prev, blocks: applyVisualPresetToOverlayBlocks(prev.blocks, preset) }
      if (!selectedBlockId) return prev
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === selectedBlockId ? applyVisualPresetToBlock(b, preset) : b)),
      }
    })
  }

  async function handleSave() {
    if (!overlay) return
    const next = { ...overlay, updatedAt: new Date().toISOString() }
    const isNew = Boolean(props.isNew) || next.id.startsWith('ov-') || !props.overlayId
    const result = await saveOverlayRemote(props.campeonatoId, next, { isNew })
    setOverlay(result.overlay)
    setSaveWarning(result.warning || '')
    setSaved(true)
    if (isNew || props.overlayId !== result.overlay.id) {
      router.replace(`/campeonatos/${props.campeonatoId}/stream/overlays/${result.overlay.id}`)
    }
    window.setTimeout(() => setSaved(false), 2500)
  }

  function handleExportJson() {
    if (!overlay) return
    downloadJson(
      `dropzone-stream-${overlay.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'overlay'}.json`,
      buildOverlayExportPayload(overlay, props.campeonatoId),
    )
  }

  function handleExportHtml() {
    if (!overlay) return
    downloadHtml(
      `dropzone-stream-${overlay.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'overlay'}.html`,
      buildOverlayBrowserHtml(overlay, {
        origin: typeof window !== 'undefined' ? window.location.origin : '',
        previewNote: overlay.share_token
          ? 'Redireciona para /stream/live (dados ao vivo).'
          : 'Salve no servidor para gerar link live.',
      }),
    )
  }

  if (pickingTemplate) {
    return (
      <div className="stream-editor">
        <header className="stream-workspace-header">
          <div className="stream-workspace-brand">
            <button type="button" className="stream-icon-btn" onClick={() => router.push(`/campeonatos/${props.campeonatoId}/stream`)}>
              <ArrowLeft size={16} /> Planilha
            </button>
            <div>
              <p className="eyebrow">Stream · pastas pré-montadas</p>
              <h1>Escolha um modelo</h1>
            </div>
          </div>
        </header>
        <div className="stream-template-grid">
          {TEMPLATE_CATALOG.map((item) => (
            <button key={item.id} type="button" className="stream-template-card" onClick={() => pickTemplate(item.id)}>
              <span className="stream-badge">{item.badge}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <span className="stream-template-cta">Usar modelo</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!overlay) {
    return (
      <div className="stream-editor">
        <p className="stream-hint" style={{ padding: 24 }}>Overlay não encontrada.</p>
      </div>
    )
  }

  return (
    <div className="stream-editor stream-cg">
      <header className="stream-workspace-header">
        <div className="stream-workspace-brand">
          <button type="button" className="stream-icon-btn" onClick={() => router.push(`/campeonatos/${props.campeonatoId}/stream`)}>
            <ArrowLeft size={16} /> Planilha
          </button>
          <div>
            <p className="eyebrow">Pastas · {TEMPLATE_LABEL[overlay.template]}</p>
            <input
              className="stream-name-input"
              value={overlay.name}
              onChange={(e) => updateOverlay({ name: e.target.value })}
              aria-label="Nome da overlay"
            />
          </div>
        </div>
        <div className="stream-panel-actions">
          {loadingData ? <span className="stream-badge">carregando…</span> : <span className="stream-badge">preview dados</span>}
          {saved ? <span className="stream-badge">salvo</span> : null}
          {overlay.share_token ? (
            <a className="stream-secondary-btn" href={`/stream/live/${overlay.share_token}`} target="_blank" rel="noopener noreferrer">
              Live
            </a>
          ) : null}
          <button type="button" className="stream-secondary-btn" onClick={handleExportJson}><Download size={15} /> JSON</button>
          <button type="button" className="stream-secondary-btn" onClick={handleExportHtml}><Download size={15} /> HTML</button>
          <button type="button" className="stream-secondary-btn" onClick={() => setPickingTemplate(true)}>
            <LayoutTemplate size={15} /> Modelo
          </button>
          <button type="button" className="stream-primary-btn" onClick={() => void handleSave()}>
            <Save size={15} /> Salvar
          </button>
        </div>
      </header>
      {saveWarning ? <p className="stream-hint" style={{ margin: '0 0 10px' }}>{saveWarning}</p> : null}

      <div className="stream-cg-layout">
        {/* Árvore de pastas */}
        <aside className="stream-cg-left stream-panel">
          <div className="stream-panel-title"><h4>Pastas</h4></div>
          <div className="stream-block-actions">
            <button type="button" className="stream-secondary-btn" onClick={addCardFolder} title="Card pré-montado (mapa)">
              <CreditCard size={14} /> Card
            </button>
            <button type="button" className="stream-secondary-btn" onClick={addEmptyCard} title="Card vazio">
              <Plus size={14} /> Vazio
            </button>
            <button type="button" className="stream-secondary-btn" onClick={addTableFolder}>
              <Table2 size={14} /> Tabela
            </button>
          </div>
          <ul className="stream-folder-tree">
            {overlay.blocks.map((block) => {
              const isOpen = expanded[block.id]
              const isSel = selectedBlockId === block.id
              const card = block.type === 'card' ? ensureCardLayers(block) : null
              return (
                <li key={block.id} className={isSel ? 'is-active' : ''}>
                  <div className="stream-folder-row">
                    <button
                      type="button"
                      className="stream-folder-toggle"
                      onClick={() => setExpanded((e) => ({ ...e, [block.id]: !e[block.id] }))}
                      aria-label="Expandir"
                    >
                      {isOpen ? '▾' : '▸'}
                    </button>
                    <button type="button" className="stream-folder-main" onClick={() => openFolder(block.id)}>
                      <FolderOpen size={14} />
                      <span>
                        <b>{block.type === 'card' ? 'CARD' : 'TABELA'}</b>
                        {block.name}
                      </span>
                    </button>
                    {block.type === 'card' ? (
                      <button type="button" title="Duplicar pasta" onClick={() => dupCard(block.id)}>
                        <Copy size={13} />
                      </button>
                    ) : null}
                    <button type="button" className="danger" title="Excluir" onClick={() => removeBlock(block.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {isOpen && card ? (
                    <ul className="stream-folder-items">
                      {card.layers
                        .slice()
                        .sort((a, b) => a.z - b.z)
                        .map((layer) => (
                          <li key={layer.id}>
                            <button
                              type="button"
                              className={selectedLayerId === layer.id ? 'active' : ''}
                              onClick={() => {
                                openFolder(card.id)
                                setSelectedLayerId(layer.id)
                              }}
                            >
                              <small>{layer.type}</small>
                              {layer.name}
                            </button>
                          </li>
                        ))}
                      <li>
                        <div className="stream-add-layer-row">
                          {LAYER_TYPES.map((t) => (
                            <button key={t.id} type="button" onClick={() => { openFolder(card.id); addLayer(t.id) }}>
                              + {t.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    </ul>
                  ) : null}
                  {isOpen && block.type === 'table' ? (
                    <ul className="stream-folder-items">
                      <li><span className="stream-hint">Fonte: {block.data.source} · {block.data.rows} linhas</span></li>
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Canvas da pasta aberta */}
        <main className="stream-cg-center">
          <div className="stream-canvas-toolbar">
            <button
              type="button"
              className={!folderMode ? 'active' : ''}
              onClick={() => setFolderMode(false)}
            >
              Cena completa
            </button>
            <button
              type="button"
              className={folderMode ? 'active' : ''}
              disabled={!selectedBlockId}
              onClick={() => selectedBlockId && setFolderMode(true)}
            >
              Pasta aberta
            </button>
            {selectedCard ? (
              <span className="stream-hint">Editando: <strong>{selectedCard.name}</strong> — clique em um item para ajustar</span>
            ) : null}
          </div>
          <OverlayPreview
            blocks={overlay.blocks.map((b) => (b.type === 'card' ? ensureCardLayers(b) : b))}
            selectedBlockId={selectedBlockId}
            selectedLayerId={selectedLayerId}
            onSelectBlock={(id) => openFolder(id)}
            onSelectLayer={setSelectedLayerId}
            standings={standings}
            mvp={mvpRows}
            maps={maps}
            layout={overlay.template}
            focusSelected={folderMode}
          />
        </main>

        {/* Propriedades */}
        <aside className="stream-cg-right stream-panel">
          {!selectedBlock ? (
            <p className="stream-hint">Selecione uma pasta (card ou tabela) à esquerda.</p>
          ) : (
            <>
              <div className="stream-panel-title">
                <h4>{selectedBlock.type === 'card' ? 'Pasta card' : 'Pasta tabela'}</h4>
              </div>
              <nav className="stream-inner-tabs">
                {(['dados', 'aparencia', 'animacao'] as InspectorTab[]).map((tab) => (
                  <button key={tab} type="button" className={inspector === tab ? 'active' : ''} onClick={() => setInspector(tab)}>
                    {tab === 'dados' ? 'Dados' : tab === 'aparencia' ? 'Aparência' : 'Animação'}
                  </button>
                ))}
              </nav>

              {inspector === 'dados' && selectedCard ? (
                <div className="stream-inspector-body">
                  <label className="stream-field">
                    <span>Nome da pasta</span>
                    <input
                      value={selectedCard.name}
                      onChange={(e) => updateBlock(selectedCard.id, (b) => ({ ...b, name: e.target.value }))}
                    />
                  </label>

                  {selectedLayer ? (
                    <>
                      <p className="stream-hint">Item selecionado</p>
                      <label className="stream-field">
                        <span>Nome do item</span>
                        <input value={selectedLayer.name} onChange={(e) => updateLayer(selectedLayer.id, { name: e.target.value })} />
                      </label>
                      <label className="stream-field">
                        <span>Tipo</span>
                        <select
                          value={selectedLayer.type}
                          onChange={(e) => updateLayer(selectedLayer.id, { type: e.target.value as LayerContentType })}
                        >
                          {LAYER_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>
                      </label>
                      <LayerDataEditor
                        layer={selectedLayer}
                        onChange={(data) => updateLayerData(selectedLayer.id, data)}
                      />
                      <div className="stream-style-grid">
                        {(['x', 'y', 'w', 'h', 'z'] as const).map((key) => (
                          <label key={key} className="stream-style-field">
                            <span>{key.toUpperCase()} %</span>
                            <input
                              type="number"
                              min={key === 'z' ? 0 : 0}
                              max={key === 'z' ? 99 : 100}
                              value={selectedLayer[key]}
                              onChange={(e) => updateLayer(selectedLayer.id, { [key]: Number(e.target.value) || 0 })}
                            />
                          </label>
                        ))}
                      </div>
                      {(selectedLayer.type === 'image' || selectedLayer.type === 'logo') ? (
                        <label className="stream-field">
                          <span>Encaixe da imagem</span>
                          <select
                            value={selectedLayer.objectFit || 'cover'}
                            onChange={(e) => updateLayer(selectedLayer.id, { objectFit: e.target.value as 'cover' | 'contain' })}
                          >
                            <option value="cover">Cobrir</option>
                            <option value="contain">Conter</option>
                          </select>
                        </label>
                      ) : null}
                      <button type="button" className="stream-secondary-btn" onClick={() => removeLayer(selectedLayer.id)}>
                        <Trash2 size={14} /> Remover item
                      </button>
                    </>
                  ) : (
                    <p className="stream-hint">Clique em um item na pasta ou no canvas para editar posição, tamanho e dado.</p>
                  )}
                </div>
              ) : null}

              {inspector === 'dados' && selectedBlock.type === 'table' ? (
                <div className="stream-inspector-body">
                  <label className="stream-field">
                    <span>Nome da pasta</span>
                    <input
                      value={selectedBlock.name}
                      onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, name: e.target.value }))}
                    />
                  </label>
                  <label className="stream-field">
                    <span>Fonte</span>
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
                  <label className="stream-field">
                    <span>Linhas</span>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={selectedBlock.data.rows}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'table' ? { ...b, data: { ...b.data, rows: Number(e.target.value) || 10 } } : b,
                        )
                      }
                    />
                  </label>
                  <label className="stream-field">
                    <span>Começa no rank</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={selectedBlock.data.startRank}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'table' ? { ...b, data: { ...b.data, startRank: Number(e.target.value) || 1 } } : b,
                        )
                      }
                    />
                  </label>
                </div>
              ) : null}

              {inspector === 'aparencia' ? (
                <div className="stream-inspector-body">
                  <p className="stream-hint">Preset da pasta</p>
                  <div className="stream-preset-row">
                    {VISUAL_PRESETS.map((p) => (
                      <button key={p.id} type="button" title={p.hint} onClick={() => applyPreset(p.id, 'block')}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="stream-hint">Fundo / borda da pasta</p>
                  <BoxStyleEditor
                    allowImage={selectedBlock.type === 'card'}
                    value={selectedBlock.box}
                    onChange={(box) => updateBlock(selectedBlock.id, (b) => ({ ...b, box }))}
                  />
                  {selectedLayer && (selectedLayer.type === 'text' || selectedLayer.type === 'number') ? (
                    <>
                      <p className="stream-hint">Estilo do item</p>
                      <FieldStyleEditor
                        value={selectedLayer.style}
                        onChange={(style) => updateLayer(selectedLayer.id, { style })}
                      />
                    </>
                  ) : null}
                  {selectedBlock.type === 'table' ? (
                    <>
                      <p className="stream-hint">Cabeçalho / linhas</p>
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
                </div>
              ) : null}

              {inspector === 'animacao' ? (
                <div className="stream-inspector-body">
                  <TransitionEditor
                    mode={selectedBlock.type === 'card' ? 'card' : 'table'}
                    value={selectedBlock.transition}
                    onChange={(transition) => updateBlock(selectedBlock.id, (b) => ({ ...b, transition }))}
                  />
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function LayerDataEditor(props: {
  layer: StreamLayer
  onChange: (data: LayerDataSource) => void
}) {
  const d = props.layer.data
  const source = d.source

  return (
    <>
      <label className="stream-field">
        <span>Conteúdo / dado</span>
        <select
          value={source}
          onChange={(e) => {
            const s = e.target.value
            if (s === 'fixed') props.onChange({ source: 'fixed', value: '' })
            else if (s === 'map_image') props.onChange({ source: 'map_image', mapSlot: 1 })
            else if (s === 'map_name') props.onChange({ source: 'map_name', mapSlot: 1 })
            else if (s === 'map_logo') props.onChange({ source: 'map_logo', mapSlot: 1 })
            else if (s === 'map_pts') props.onChange({ source: 'map_pts', mapSlot: 1 })
            else if (s === 'map_abates') props.onChange({ source: 'map_abates', mapSlot: 1 })
            else if (s === 'standing') props.onChange({ source: 'standing', rank: 1, field: 'nome' })
            else if (s === 'mvp') props.onChange({ source: 'mvp', rank: 1, field: 'nome' })
          }}
        >
          <option value="fixed">Texto fixo</option>
          <option value="map_image">Imagem do mapa (queda N)</option>
          <option value="map_name">Nome do mapa (queda N)</option>
          <option value="map_logo">Logo top da queda N</option>
          <option value="map_pts">Pontos da queda N</option>
          <option value="map_abates">Abates da queda N</option>
          <option value="standing">Classificação (posição)</option>
          <option value="mvp">MVP (posição)</option>
        </select>
      </label>

      {source === 'fixed' ? (
        <label className="stream-field">
          <span>Valor</span>
          <input
            value={d.source === 'fixed' ? d.value : ''}
            onChange={(e) => props.onChange({ source: 'fixed', value: e.target.value })}
          />
        </label>
      ) : null}

      {'mapSlot' in d ? (
        <label className="stream-field">
          <span>Queda / mapa nº</span>
          <input
            type="number"
            min={1}
            max={12}
            value={d.mapSlot}
            onChange={(e) => props.onChange({ ...d, mapSlot: Number(e.target.value) || 1 })}
          />
        </label>
      ) : null}

      {d.source === 'standing' ? (
        <>
          <label className="stream-field">
            <span>Posição</span>
            <input
              type="number"
              min={1}
              value={d.rank}
              onChange={(e) => props.onChange({ ...d, rank: Number(e.target.value) || 1 })}
            />
          </label>
          <label className="stream-field">
            <span>Campo</span>
            <select value={d.field} onChange={(e) => props.onChange({ ...d, field: e.target.value as any })}>
              <option value="nome">Nome</option>
              <option value="logo">Logo</option>
              <option value="pts">Pontos</option>
              <option value="abates">Abates</option>
              <option value="booyah">Booyah</option>
              <option value="delta">Delta</option>
            </select>
          </label>
        </>
      ) : null}

      {d.source === 'mvp' ? (
        <>
          <label className="stream-field">
            <span>Posição MVP</span>
            <input
              type="number"
              min={1}
              value={d.rank}
              onChange={(e) => props.onChange({ ...d, rank: Number(e.target.value) || 1 })}
            />
          </label>
          <label className="stream-field">
            <span>Campo</span>
            <select value={d.field} onChange={(e) => props.onChange({ ...d, field: e.target.value as any })}>
              <option value="nome">Nick</option>
              <option value="logo">Foto/logo</option>
              <option value="abates">Abates</option>
              <option value="kd">K.D</option>
              <option value="quedas">Quedas</option>
            </select>
          </label>
        </>
      ) : null}
    </>
  )
}
