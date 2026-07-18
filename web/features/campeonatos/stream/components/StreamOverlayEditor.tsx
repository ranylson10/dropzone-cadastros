'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Plus,
  Save,
  Trash2,
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
import { BoxStyleEditor, FieldStyleEditor, TransitionEditor } from './editor/StylePanels'
import { CellPicker } from './editor/CellPicker'
import { CardLayerCanvas } from './CardLayerCanvas'
import { boxToCssSafe, fieldToCss } from '../utils/stream-style'
import type { PreviewMap, PreviewStanding } from './editor/OverlayPreview'
import '../stream.css'

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ov-${Date.now()}`
}

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
  const stageRef = useRef<HTMLDivElement>(null)

  const [overlay, setOverlay] = useState<StreamOverlay | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [openLayerMenu, setOpenLayerMenu] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'ferramentas' | 'camadas'>('camadas')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

  const [saved, setSaved] = useState(false)
  const [saveWarning, setSaveWarning] = useState('')
  const [standings, setStandings] = useState<PreviewStanding[]>([])
  const [mvpRows, setMvpRows] = useState<PreviewStanding[]>([])
  const [maps, setMaps] = useState<PreviewMap[]>([])
  const [sheets, setSheets] = useState<Partial<Record<StreamSheetId, StreamSheetRow[]>>>({})
  const [loadingData, setLoadingData] = useState(true)

  // Nova overlay: só nome, sem wizard
  useEffect(() => {
    if (props.isNew) {
      setOverlay({
        id: newId(),
        name: 'Nova overlay',
        template: 'custom',
        blocks: [],
        updatedAt: new Date().toISOString(),
      })
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
    })()
    return () => {
      cancelled = true
    }
  }, [props.campeonatoId, props.overlayId, props.isNew])

  const loadData = useCallback(async () => {
    setLoadingData(true)
    try {
      const ids: StreamSheetId[] = ['equipes', 'jogadores', 'classificacao', 'mvp', 'jogos', 'quedas']
      const loaded = await Promise.all(ids.map((id) => loadStreamSheet(props.campeonatoId, id).catch(() => [] as StreamSheetRow[])))
      const next: Partial<Record<StreamSheetId, StreamSheetRow[]>> = {}
      ids.forEach((id, i) => {
        next[id] = loaded[i]
      })
      setSheets(next)

      const classif = next.classificacao || []
      const mvp = next.mvp || []
      const standingRows: PreviewStanding[] = classif.map((row, i) => ({
        pos: Number(row.cells.colocacao) || i + 1,
        nome: row.cells.line || '—',
        booyah: row.cells.booyahs || '0',
        abates: row.cells.abates || '0',
        pts: row.cells.pontos || '0',
        delta: '0',
        quedas: '0',
        kd: '0',
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

  function updateBlock(blockId: string, updater: (b: StreamBlock) => StreamBlock) {
    setOverlay((prev) => {
      if (!prev) return prev
      return { ...prev, blocks: prev.blocks.map((b) => (b.id === blockId ? updater(b) : b)) }
    })
  }

  function addBlock(type: 'card' | 'table') {
    if (!overlay) return
    if (type === 'card') {
      const n = overlay.blocks.filter((b) => b.type === 'card').length + 1
      // pasta card pré-montada (5 itens) — usuário edita/apaga
      const card = createMapCardFolder(n, `MAPA ${n}`)
      card.name = `Card ${n}`
      setOverlay({ ...overlay, blocks: [...overlay.blocks, card] })
      setSelectedBlockId(card.id)
      setSelectedLayerId(null)
      setRightTab('camadas')
      return
    }
    const table: StreamTableBlock = {
      id: newBlockId(),
      type: 'table',
      name: `Tabela ${overlay.blocks.filter((b) => b.type === 'table').length + 1}`,
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
    setOverlay({ ...overlay, blocks: [...overlay.blocks, table] })
    setSelectedBlockId(table.id)
    setSelectedLayerId(null)
    setRightTab('ferramentas')
  }

  function removeBlock(id: string) {
    if (!overlay) return
    setOverlay({ ...overlay, blocks: overlay.blocks.filter((b) => b.id !== id) })
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
      const n = overlay.blocks.filter((b) => b.type === 'card').length + 1
      const copy = duplicateCardFolder(card, n)
      copy.name = `${card.name} cópia`
      setOverlay({ ...overlay, blocks: [...overlay.blocks, copy] })
      setSelectedBlockId(copy.id)
      return
    }
    const copy: StreamTableBlock = {
      ...block,
      id: newBlockId(),
      name: `${block.name} cópia`,
      data: { ...block.data },
    }
    setOverlay({ ...overlay, blocks: [...overlay.blocks, copy] })
    setSelectedBlockId(copy.id)
  }

  function addLayer(type: LayerContentType) {
    if (!selectedCard) return
    const layer = createDefaultLayer(type, 1)
    updateBlock(selectedCard.id, (b) => {
      if (b.type !== 'card') return b
      const c = ensureCardLayers(b)
      return { ...c, layers: [...c.layers, layer] }
    })
    setSelectedLayerId(layer.id)
    setOpenLayerMenu(layer.id)
    setRightTab('camadas')
  }

  function updateLayer(layerId: string, patch: Partial<StreamLayer>) {
    if (!selectedCard) return
    updateBlock(selectedCard.id, (b) => {
      if (b.type !== 'card') return b
      const c = ensureCardLayers(b)
      return { ...c, layers: c.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) }
    })
  }

  function removeLayer(layerId: string) {
    if (!selectedCard) return
    updateBlock(selectedCard.id, (b) => {
      if (b.type !== 'card') return b
      const c = ensureCardLayers(b)
      return { ...c, layers: c.layers.filter((l) => l.id !== layerId) }
    })
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

  // pan
  function onStagePointerDown(e: React.PointerEvent) {
    if (e.button !== 1 && !(e.button === 0 && e.altKey)) return
    e.preventDefault()
    setPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onStagePointerMove(e: React.PointerEvent) {
    if (!panning) return
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    })
  }
  function onStagePointerUp() {
    setPanning(false)
  }
  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setZoom((z) => Math.min(2.5, Math.max(0.35, z + (e.deltaY > 0 ? -0.08 : 0.08))))
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
          <button type="button" className="stream-primary-btn" onClick={() => void handleSave()}>
            <Save size={15} /> Salvar
          </button>
        </div>
      </header>
      {saveWarning ? <p className="stream-hint" style={{ margin: '0 0 8px' }}>{saveWarning}</p> : null}

      <div className="stream-gt-layout">
        {/* CANVAS CENTRO */}
        <main
          className="stream-gt-stage"
          ref={stageRef}
          onWheel={onWheel}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerLeave={onStagePointerUp}
        >
          <div className="stream-gt-zoombar">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.35, z - 0.1))} title="Zoom -"><ZoomOut size={16} /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} title="Zoom +"><ZoomIn size={16} /></button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Reset</button>
            <span className="stream-hint">Alt+arrastar ou botão do meio = mover</span>
          </div>

          <div
            className="stream-gt-world"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {!overlay.blocks.length ? (
              <div className="stream-gt-empty">
                <p>Overlay vazia</p>
                <p className="stream-hint">Use <strong>+</strong> no painel direito para adicionar um Card ou uma Tabela.</p>
              </div>
            ) : (
              <div className="stream-gt-blocks">
                {overlay.blocks.map((block) => {
                  const selected = selectedBlockId === block.id
                  if (block.type === 'card') {
                    const card = ensureCardLayers(block)
                    return (
                      <div
                        key={block.id}
                        className={`stream-gt-block ${selected ? 'is-selected' : ''}`}
                        style={{ width: card.canvasW }}
                        onClick={() => {
                          setSelectedBlockId(block.id)
                          setSelectedLayerId(null)
                          setRightTab('camadas')
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
                            setRightTab('camadas')
                          }}
                        />
                      </div>
                    )
                  }
                  // tabela
                  const box = boxToCssSafe(block.box)
                  const header = fieldToCss(block.data.headerStyle)
                  const rowStyle = fieldToCss(block.data.rowStyle)
                  const source = block.data.source === 'mvp' ? mvpRows : standings
                  const start = block.data.startRank || 1
                  const rows = source.filter((r) => r.pos >= start).slice(0, block.data.rows)
                  const rh = block.data.rowHeight ?? 36
                  const gap = block.data.rowGap ?? 0
                  return (
                    <div
                      key={block.id}
                      className={`stream-gt-block stream-gt-table-block ${selected ? 'is-selected' : ''}`}
                      style={{ minWidth: 360, ...box }}
                      onClick={() => {
                        setSelectedBlockId(block.id)
                        setSelectedLayerId(null)
                        setRightTab('ferramentas')
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
        </main>

        {/* PAINEL DIREITO */}
        <aside className="stream-gt-right stream-panel">
          <div className="stream-gt-add">
            <button type="button" className="stream-primary-btn" onClick={() => addBlock('card')}>
              <Plus size={15} /> Card
            </button>
            <button type="button" className="stream-primary-btn" onClick={() => addBlock('table')}>
              <Plus size={15} /> Tabela
            </button>
          </div>

          <nav className="stream-inner-tabs">
            <button type="button" className={rightTab === 'camadas' ? 'active' : ''} onClick={() => setRightTab('camadas')}>Camadas</button>
            <button type="button" className={rightTab === 'ferramentas' ? 'active' : ''} onClick={() => setRightTab('ferramentas')}>Ferramentas</button>
          </nav>

          {rightTab === 'camadas' ? (
            <div className="stream-gt-layers">
              {!selectedBlock ? (
                <p className="stream-hint">Selecione um card ou tabela no centro.</p>
              ) : selectedBlock.type === 'table' ? (
                <div className="stream-inspector-body">
                  <p className="stream-hint">Tabela não usa camadas de item — use <strong>Ferramentas</strong> (altura de linha, fonte, etc.).</p>
                  <label className="stream-field">
                    <span>Nome</span>
                    <input
                      value={selectedBlock.name}
                      onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, name: e.target.value }))}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="stream-gt-layer-head">
                    <strong>{selectedCard?.name || 'Card'}</strong>
                    <div className="stream-block-actions">
                      <button type="button" title="Duplicar" onClick={() => selectedCard && dupBlock(selectedCard.id)}><Copy size={14} /></button>
                      <button type="button" className="danger" title="Excluir" onClick={() => selectedCard && removeBlock(selectedCard.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="stream-add-layer-row">
                    {LAYER_TYPES.map((t) => (
                      <button key={t.id} type="button" onClick={() => addLayer(t.id)}>+ {t.label}</button>
                    ))}
                  </div>
                  <ul className="stream-gt-layer-list">
                    {(selectedCard?.layers || [])
                      .slice()
                      .sort((a, b) => b.z - a.z)
                      .map((layer) => {
                        const open = openLayerMenu === layer.id
                        const bound =
                          layer.data.source === 'cell'
                            ? layer.data.display || `${layer.data.sheetId}.${layer.data.colKey}#${layer.data.rowIndex}`
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
                                <label className="stream-field">
                                  <span>Texto fixo (opcional)</span>
                                  <input
                                    value={layer.data.source === 'fixed' ? layer.data.value : ''}
                                    placeholder="ou escolha célula abaixo"
                                    onChange={(e) => updateLayer(layer.id, { data: { source: 'fixed', value: e.target.value } })}
                                  />
                                </label>
                                <p className="stream-hint">Vincular à planilha — clique na célula:</p>
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
                                {(layer.type === 'text' || layer.type === 'number') ? (
                                  <FieldStyleEditor
                                    value={layer.style}
                                    onChange={(style) => updateLayer(layer.id, { style })}
                                  />
                                ) : null}
                                <button type="button" className="stream-secondary-btn" onClick={() => removeLayer(layer.id)}>
                                  <Trash2 size={14} /> Remover camada
                                </button>
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <div className="stream-inspector-body">
              {!selectedBlock ? (
                <p className="stream-hint">Selecione um bloco no canvas para ver ferramentas.</p>
              ) : (
                <>
                  <label className="stream-field">
                    <span>Nome do bloco</span>
                    <input
                      value={selectedBlock.name}
                      onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, name: e.target.value }))}
                    />
                  </label>

                  {/* comuns */}
                  <p className="stream-hint"><strong>Comuns</strong> — fundo, borda, animação</p>
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

                  {/* específicas card */}
                  {selectedBlock.type === 'card' ? (
                    <>
                      <p className="stream-hint"><strong>Card</strong> — tamanho da pasta</p>
                      <div className="stream-style-grid">
                        <label className="stream-style-field">
                          <span>Largura px</span>
                          <input
                            type="number"
                            value={ensureCardLayers(selectedBlock).canvasW}
                            onChange={(e) =>
                              updateBlock(selectedBlock.id, (b) =>
                                b.type === 'card' ? { ...ensureCardLayers(b), canvasW: Number(e.target.value) || 280 } : b,
                              )
                            }
                          />
                        </label>
                        <label className="stream-style-field">
                          <span>Altura px</span>
                          <input
                            type="number"
                            value={ensureCardLayers(selectedBlock).canvasH}
                            onChange={(e) =>
                              updateBlock(selectedBlock.id, (b) =>
                                b.type === 'card' ? { ...ensureCardLayers(b), canvasH: Number(e.target.value) || 220 } : b,
                              )
                            }
                          />
                        </label>
                      </div>
                    </>
                  ) : null}

                  {/* específicas tabela */}
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
          )}
        </aside>
      </div>
    </div>
  )
}
