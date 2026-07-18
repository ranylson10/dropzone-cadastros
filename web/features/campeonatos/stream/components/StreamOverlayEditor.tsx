'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, LayoutTemplate, Save, Table2, CreditCard, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import {
  getLocalOverlay,
  upsertLocalOverlay,
  loadStreamSheet,
} from '../services/stream-data.service'
import { TEMPLATE_CATALOG, TEMPLATE_LABEL, createOverlayFromTemplate } from '../templates/stream-templates'
import type {
  CardFieldKey,
  StreamBlock,
  StreamCardBlock,
  StreamOverlay,
  StreamTableBlock,
  StreamTemplateId,
} from '../types/stream.types'
import { DEFAULT_BOX, DEFAULT_TRANSITION, newBlockId } from '../types/stream.types'
import { migrateOverlay } from '../utils/migrate-overlay'
import {
  buildOverlayBrowserHtml,
  buildOverlayExportPayload,
  downloadHtml,
  downloadJson,
} from '../utils/export-overlay'
import { BoxStyleEditor, FieldStyleEditor, TransitionEditor } from './editor/StylePanels'
import { OverlayPreview, type PreviewMap, type PreviewStanding } from './editor/OverlayPreview'
import '../stream.css'

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ov-${Date.now()}`
}

type InspectorTab = 'dados' | 'aparencia' | 'animacao'

const CARD_FIELDS: Array<{ key: CardFieldKey; label: string }> = [
  { key: 'title', label: 'Título' },
  { key: 'metric_primary', label: 'Métrica 1' },
  { key: 'metric_secondary', label: 'Métrica 2' },
  { key: 'metric_tertiary', label: 'Métrica 3' },
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
  const [inspector, setInspector] = useState<InspectorTab>('dados')
  const [fieldKey, setFieldKey] = useState<CardFieldKey>('title')
  const [saved, setSaved] = useState(false)
  const [standings, setStandings] = useState<PreviewStanding[]>([])
  const [mvpRows, setMvpRows] = useState<PreviewStanding[]>([])
  const [maps, setMaps] = useState<PreviewMap[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (props.isNew) {
      setPickingTemplate(true)
      setOverlay(null)
      return
    }
    if (!props.overlayId) return
    const raw = getLocalOverlay(props.campeonatoId, props.overlayId)
    const migrated = migrateOverlay(raw)
    setOverlay(migrated)
    setSelectedBlockId(migrated?.blocks[0]?.id || null)
    setPickingTemplate(false)
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
        for (const s of standingRows) {
          s.logo = byName.get(s.nome.toLowerCase())
        }
      } catch {
        // ignore logo enrichment
      }

      setStandings(standingRows)
      setMvpRows(mvpPreview.length ? mvpPreview : standingRows)

      const fallbackMaps = ['BERMUDA 1', 'PURGATÓRIO 1', 'NOVA TERRA 1']
      const mapImages: Record<string, string> = {
        bermuda: '/images/maps/bermuda.png',
        purgatorio: '/images/maps/purgatorio.png',
        purgatório: '/images/maps/purgatorio.png',
        'nova terra': '/images/maps/nova-terra.png',
        'nova-terra': '/images/maps/nova-terra.png',
        kalahari: '/images/maps/kalahari.png',
        alpine: '/images/maps/alpine.png',
        solara: '/images/maps/solara.png',
      }
      const fromQuedas = quedas.slice(0, 6).map((q, i) => {
        const mapa = String(q.cells.mapa || fallbackMaps[i] || `MAPA ${i + 1}`)
        const key = mapa.toLowerCase()
        const imageUrl =
          Object.entries(mapImages).find(([k]) => key.includes(k))?.[1] || '/images/maps/bermuda.png'
        return {
          title: `${mapa}${q.cells.numero ? ` ${q.cells.numero}` : ''}`.toUpperCase(),
          imageUrl,
          logo: standingRows[i]?.logo,
          pts: standingRows[i]?.pts || '0',
          abates: standingRows[i]?.abates || '0',
          nome: standingRows[i]?.nome || equipes[i]?.cells?.line || '',
        }
      })
      const mapRows: PreviewMap[] =
        fromQuedas.length > 0
          ? fromQuedas
          : fallbackMaps.map((title, i) => ({
              title,
              imageUrl: Object.values(mapImages)[i] || '/images/maps/bermuda.png',
              logo: standingRows[i]?.logo,
              pts: standingRows[i]?.pts || '0',
              abates: standingRows[i]?.abates || '0',
              nome: standingRows[i]?.nome || equipes[i]?.cells?.line || '',
            }))
      setMaps(mapRows)
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

  function pickTemplate(template: StreamTemplateId) {
    const draft = createOverlayFromTemplate(template)
    const full: StreamOverlay = {
      id: newId(),
      ...draft,
      updatedAt: new Date().toISOString(),
    }
    setOverlay(full)
    setSelectedBlockId(full.blocks[0]?.id || null)
    setPickingTemplate(false)
  }

  function updateOverlay(patch: Partial<StreamOverlay>) {
    setOverlay((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  function updateBlock(blockId: string, updater: (b: StreamBlock) => StreamBlock) {
    setOverlay((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === blockId ? updater(b) : b)),
      }
    })
  }

  function addCard() {
    const block: StreamCardBlock = {
      id: newBlockId(),
      type: 'card',
      name: `Card ${(overlay?.blocks.filter((b) => b.type === 'card').length || 0) + 1}`,
      box: { ...DEFAULT_BOX },
      transition: { ...DEFAULT_TRANSITION, enter: 'scale' },
      data: {
        variant: 'map_result',
        mapSlot: 1,
        titleFixed: 'NOVO CARD',
        metrics: ['pts', 'abates'],
        fieldStyles: {},
      },
    }
    setOverlay((prev) => (prev ? { ...prev, blocks: [...prev.blocks, block] } : prev))
    setSelectedBlockId(block.id)
  }

  function addTable() {
    const block: StreamTableBlock = {
      id: newBlockId(),
      type: 'table',
      name: `Tabela ${(overlay?.blocks.filter((b) => b.type === 'table').length || 0) + 1}`,
      box: { ...DEFAULT_BOX },
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
    setSelectedBlockId(block.id)
  }

  function removeBlock(blockId: string) {
    setOverlay((prev) => {
      if (!prev) return prev
      const blocks = prev.blocks.filter((b) => b.id !== blockId)
      return { ...prev, blocks }
    })
    if (selectedBlockId === blockId) setSelectedBlockId(null)
  }

  function handleSave() {
    if (!overlay) return
    const next = { ...overlay, updatedAt: new Date().toISOString() }
    upsertLocalOverlay(props.campeonatoId, next)
    setOverlay(next)
    setSaved(true)
    if (props.isNew || props.overlayId !== next.id) {
      router.replace(`/campeonatos/${props.campeonatoId}/stream/overlays/${next.id}`)
    }
    window.setTimeout(() => setSaved(false), 2000)
  }

  function handleExportJson() {
    if (!overlay) return
    const payload = buildOverlayExportPayload(overlay, props.campeonatoId)
    const slug = overlay.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'overlay'
    downloadJson(`dropzone-stream-${slug}.json`, payload)
  }

  function handleExportHtml() {
    if (!overlay) return
    const html = buildOverlayBrowserHtml(
      overlay,
      'DropZone Stream · Browser Source (estrutura). Conecte dados ao vivo na próxima etapa.',
    )
    const slug = overlay.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'overlay'
    downloadHtml(`dropzone-stream-${slug}.html`, html)
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
              <p className="eyebrow">Stream · nova overlay</p>
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
            <p className="eyebrow">Character generator · {TEMPLATE_LABEL[overlay.template]}</p>
            <input
              className="stream-name-input"
              value={overlay.name}
              onChange={(e) => updateOverlay({ name: e.target.value })}
              aria-label="Nome da overlay"
            />
          </div>
        </div>
        <div className="stream-panel-actions">
          {loadingData ? <span className="stream-badge">carregando dados…</span> : <span className="stream-badge">preview ao vivo</span>}
          {saved ? <span className="stream-badge">salvo</span> : null}
          <button type="button" className="stream-secondary-btn" onClick={handleExportJson} title="Exportar JSON">
            <Download size={15} /> JSON
          </button>
          <button type="button" className="stream-secondary-btn" onClick={handleExportHtml} title="Exportar HTML (Browser Source)">
            <Download size={15} /> HTML
          </button>
          <button type="button" className="stream-secondary-btn" onClick={() => setPickingTemplate(true)}>
            <LayoutTemplate size={15} /> Modelo
          </button>
          <button type="button" className="stream-primary-btn" onClick={handleSave}>
            <Save size={15} /> Salvar
          </button>
        </div>
      </header>

      <div className="stream-cg-layout">
        <aside className="stream-cg-left stream-panel">
          <div className="stream-panel-title">
            <h4>Blocos</h4>
          </div>
          <div className="stream-block-actions">
            <button type="button" className="stream-secondary-btn" onClick={addCard}><CreditCard size={14} /> Card</button>
            <button type="button" className="stream-secondary-btn" onClick={addTable}><Table2 size={14} /> Tabela</button>
          </div>
          <ul className="stream-block-list">
            {overlay.blocks.map((block) => (
              <li key={block.id}>
                <button
                  type="button"
                  className={selectedBlockId === block.id ? 'active' : ''}
                  onClick={() => setSelectedBlockId(block.id)}
                >
                  <b>{block.type === 'card' ? 'Card' : 'Tabela'}</b>
                  <span>{block.name}</span>
                </button>
                <button type="button" className="danger" title="Remover" onClick={() => removeBlock(block.id)}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="stream-cg-center">
          <OverlayPreview
            blocks={overlay.blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            standings={standings}
            mvp={mvpRows}
            maps={maps}
            layout={overlay.template}
          />
        </main>

        <aside className="stream-cg-right stream-panel">
          {!selectedBlock ? (
            <p className="stream-hint">Selecione um card ou tabela no preview (ou na lista) para editar.</p>
          ) : (
            <>
              <div className="stream-panel-title">
                <h4>{selectedBlock.type === 'card' ? 'Card' : 'Tabela'}</h4>
              </div>
              <nav className="stream-inner-tabs">
                {(['dados', 'aparencia', 'animacao'] as InspectorTab[]).map((tab) => (
                  <button key={tab} type="button" className={inspector === tab ? 'active' : ''} onClick={() => setInspector(tab)}>
                    {tab === 'dados' ? 'Dados' : tab === 'aparencia' ? 'Aparência' : 'Animação'}
                  </button>
                ))}
              </nav>

              {inspector === 'dados' && selectedBlock.type === 'card' ? (
                <div className="stream-inspector-body">
                  <label className="stream-field">
                    <span>Nome do bloco</span>
                    <input
                      value={selectedBlock.name}
                      onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, name: e.target.value }))}
                    />
                  </label>
                  <label className="stream-field">
                    <span>Variante</span>
                    <select
                      value={selectedBlock.data.variant}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'card'
                            ? { ...b, data: { ...b.data, variant: e.target.value as StreamCardBlock['data']['variant'] } }
                            : b,
                        )
                      }
                    >
                      <option value="map_result">Resultado de mapa</option>
                      <option value="mvp_hero">MVP destaque</option>
                      <option value="team">Time</option>
                    </select>
                  </label>
                  <label className="stream-field">
                    <span>Título fixo</span>
                    <input
                      value={selectedBlock.data.titleFixed || ''}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'card' ? { ...b, data: { ...b.data, titleFixed: e.target.value } } : b,
                        )
                      }
                    />
                  </label>
                  <label className="stream-field">
                    <span>Slot do mapa (1–3)</span>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={selectedBlock.data.mapSlot || 1}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'card' ? { ...b, data: { ...b.data, mapSlot: Number(e.target.value) || 1 } } : b,
                        )
                      }
                    />
                  </label>
                  <label className="stream-field">
                    <span>Campo de texto p/ estilo</span>
                    <select value={fieldKey} onChange={(e) => setFieldKey(e.target.value as CardFieldKey)}>
                      {CARD_FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {inspector === 'dados' && selectedBlock.type === 'table' ? (
                <div className="stream-inspector-body">
                  <label className="stream-field">
                    <span>Nome do bloco</span>
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

              {inspector === 'aparencia' && selectedBlock.type === 'card' ? (
                <div className="stream-inspector-body">
                  <p className="stream-hint">Container do card</p>
                  <BoxStyleEditor
                    allowImage
                    value={selectedBlock.box}
                    onChange={(box) => updateBlock(selectedBlock.id, (b) => ({ ...b, box }))}
                  />
                  <p className="stream-hint">Campo: {CARD_FIELDS.find((f) => f.key === fieldKey)?.label}</p>
                  <FieldStyleEditor
                    value={selectedBlock.data.fieldStyles?.[fieldKey]}
                    onChange={(style) =>
                      updateBlock(selectedBlock.id, (b) =>
                        b.type === 'card'
                          ? {
                              ...b,
                              data: {
                                ...b.data,
                                fieldStyles: { ...b.data.fieldStyles, [fieldKey]: style },
                              },
                            }
                          : b,
                      )
                    }
                  />
                </div>
              ) : null}

              {inspector === 'aparencia' && selectedBlock.type === 'table' ? (
                <div className="stream-inspector-body">
                  <p className="stream-hint">Container da tabela</p>
                  <BoxStyleEditor
                    allowImage={false}
                    value={selectedBlock.box}
                    onChange={(box) => updateBlock(selectedBlock.id, (b) => ({ ...b, box }))}
                  />
                  <p className="stream-hint">Cabeçalho</p>
                  <FieldStyleEditor
                    value={selectedBlock.data.headerStyle}
                    onChange={(headerStyle) =>
                      updateBlock(selectedBlock.id, (b) =>
                        b.type === 'table' ? { ...b, data: { ...b.data, headerStyle } } : b,
                      )
                    }
                  />
                  <p className="stream-hint">Linhas</p>
                  <FieldStyleEditor
                    value={selectedBlock.data.rowStyle}
                    onChange={(rowStyle) =>
                      updateBlock(selectedBlock.id, (b) =>
                        b.type === 'table' ? { ...b, data: { ...b.data, rowStyle } } : b,
                      )
                    }
                  />
                  <label className="stream-field">
                    <span>Cor linha alternada</span>
                    <input
                      type="color"
                      value={(selectedBlock.data.altRowFill || '#b71c1c').slice(0, 7)}
                      onChange={(e) =>
                        updateBlock(selectedBlock.id, (b) =>
                          b.type === 'table' ? { ...b, data: { ...b.data, altRowFill: e.target.value } } : b,
                        )
                      }
                    />
                  </label>
                </div>
              ) : null}

              {inspector === 'animacao' ? (
                <div className="stream-inspector-body">
                  <TransitionEditor
                    mode={selectedBlock.type}
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
