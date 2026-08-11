'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChevronDown, Eye, EyeOff, ExternalLink, Keyboard, MonitorOff, Radio } from 'lucide-react'
import '@/features/broadcast/broadcast.css'
import '@/features/campeonatos/stream/stream.css'

type OverlayItem = {
  id: string
  name: string
  type?: string
  structure?: 'table' | 'cards' | 'hero'
}

type LiveItem = {
  id: string
  campeonato_id: string
  display_name: string
  campeonato?: { id: string; nome: string; logo_url?: string } | null
}

export default function BroadcastControlPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [lives, setLives] = useState<LiveItem[]>([])
  const [overlays, setOverlays] = useState<OverlayItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeChampId, setActiveChampId] = useState<string | null>(null)
  const [champName, setChampName] = useState('')
  const [error, setError] = useState('')
  const [packConfigured, setPackConfigured] = useState(false)
  const [pendingOverlay, setPendingOverlay] = useState(false)
  const [pendingLive, setPendingLive] = useState(false)
  const [liveMenuOpen, setLiveMenuOpen] = useState(false)
  const [obsToken, setObsToken] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const holdActiveUntil = useRef(0)
  const holdChampUntil = useRef(0)
  const liveMenuRef = useRef<HTMLDivElement | null>(null)

  const activeLive = useMemo(
    () => lives.find((live) => live.campeonato_id === activeChampId) || null,
    [lives, activeChampId],
  )
  const activeOverlay = useMemo(
    () => overlays.find((overlay) => overlay.id === activeId) || null,
    [overlays, activeId],
  )

  const liveLabel = activeLive?.display_name
    || champName
    || (activeChampId ? 'Live selecionada' : 'Selecionar live…')
  const liveSub = activeLive?.campeonato?.nome || champName || ''
  const sceneLabel = activeOverlay?.name || 'Tela limpa'
  const activeSceneNumber = activeId ? overlays.findIndex((overlay) => overlay.id === activeId) + 1 : 0
  const activeStructureLabel = activeOverlay?.structure === 'table'
    ? 'Tabela'
    : activeOverlay?.structure === 'cards'
      ? 'Cards'
      : activeOverlay
        ? 'Cena destaque'
        : 'Sem overlay'
  const busy = pendingOverlay || pendingLive
  const outputStatus = pendingLive ? 'Trocando live…' : pendingOverlay ? 'Trocando cena…' : activeChampId ? 'Saída confirmada' : 'Aguardando seleção'
  const obsPreviewUrl = obsToken ? `/broadcast/obs/${encodeURIComponent(obsToken)}` : ''

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!token) return
    try {
      const res = await fetch(`/api/broadcast/control/${encodeURIComponent(token)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha')
      setLives(json.lives || [])
      setOverlays(json.overlays || [])
      setPackConfigured(Boolean(json.pack))
      setChampName(json.campeonato?.nome || '')
      setObsToken(String(json.session?.obs_token || ''))

      const now = Date.now()
      if (!opts?.soft || now > holdActiveUntil.current) {
        setActiveId(json.session?.active_overlay_type || null)
      }
      if (!opts?.soft || now > holdChampUntil.current) {
        setActiveChampId(json.session?.campeonato_id || null)
      }
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Erro')
    }
  }, [token])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load({ soft: true }), 5000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!liveMenuOpen) return
    function onDoc(e: MouseEvent) {
      if (!liveMenuRef.current?.contains(e.target as Node)) setLiveMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLiveMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [liveMenuOpen])

  async function selectLive(campeonatoId: string | null) {
    if (busy || campeonatoId === activeChampId) {
      setLiveMenuOpen(false)
      return
    }
    holdChampUntil.current = Date.now() + 2500
    holdActiveUntil.current = Date.now() + 2500
    setActiveChampId(campeonatoId)
    setActiveId(null)
    setPendingLive(true)
    setLiveMenuOpen(false)
    setError('')
    try {
      const res = await fetch(`/api/broadcast/control/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campeonato_id: campeonatoId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha')
      setActiveChampId(json.session?.campeonato_id || null)
      setActiveId(json.session?.active_overlay_type || null)
      setOverlays(json.overlays || [])
      setChampName(json.campeonato?.nome || '')
      setPackConfigured(Boolean(json.pack))
    } catch (e: any) {
      setError(e?.message || 'Erro ao trocar live')
      await load()
    } finally {
      setPendingLive(false)
    }
  }

  async function selectOverlay(id: string | null) {
    if (busy || !activeChampId || id === activeId) return
    holdActiveUntil.current = Date.now() + 2500
    setActiveId(id)
    setPendingOverlay(true)
    setError('')
    try {
      const res = await fetch(`/api/broadcast/control/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_overlay_type: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha')
      setActiveId(json.session?.active_overlay_type || null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao trocar cena')
      await load()
    } finally {
      setPendingOverlay(false)
    }
  }

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if (liveMenuOpen || busy || !activeChampId || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === '0') {
        event.preventDefault()
        void selectOverlay(null)
        return
      }
      if (!/^[1-9]$/.test(event.key)) return
      const overlay = overlays[Number(event.key) - 1]
      if (!overlay) return
      event.preventDefault()
      void selectOverlay(overlay.id)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [activeChampId, busy, liveMenuOpen, overlays])

  return (
    <div className="broadcast-control" aria-busy={busy}>
      <header className="broadcast-control-head">
        <div className="broadcast-control-head-text">
          <p className="broadcast-control-kicker">STREAM · CONTROLADOR</p>
          <h1>Mesa de live</h1>
          <p className="broadcast-control-hint">
            Troque a live e coloque as cenas no ar sem voltar ao editor.
          </p>
        </div>

        <div className="broadcast-live-select" ref={liveMenuRef}>
          <span className="broadcast-live-select-label">Live</span>
          {!lives.length ? (
            <div className="broadcast-live-select-empty">
              Nenhuma live na lista. Resgate a chave no painel Stream.
            </div>
          ) : (
            <>
              <button
                type="button"
                className={`broadcast-live-select-trigger${liveMenuOpen ? ' is-open' : ''}${activeChampId ? ' has-value' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={liveMenuOpen}
                disabled={busy}
                onClick={() => setLiveMenuOpen((value) => !value)}
              >
                <span className="broadcast-live-select-icon" aria-hidden><Radio size={16} /></span>
                <span className="broadcast-live-select-value">
                  <strong>{liveLabel}</strong>
                  {liveSub && liveSub !== liveLabel ? <small>{liveSub}</small> : null}
                </span>
                <ChevronDown size={18} className="broadcast-live-select-chevron" aria-hidden />
              </button>

              {liveMenuOpen ? (
                <ul className="broadcast-live-select-menu" role="listbox">
                  {lives.map((live) => {
                    const active = activeChampId === live.campeonato_id
                    return (
                      <li key={live.id} role="option" aria-selected={active}>
                        <button
                          type="button"
                          className={`broadcast-live-select-option${active ? ' is-active' : ''}`}
                          disabled={busy || active}
                          onClick={() => void selectLive(live.campeonato_id)}
                        >
                          <span className="broadcast-live-select-option-text">
                            <strong>{live.display_name}</strong>
                            <small>{live.campeonato?.nome || live.campeonato_id.slice(0, 8)}</small>
                          </span>
                          {active ? <span className="broadcast-live-select-badge">atual</span> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </header>

      {error ? <p className="broadcast-control-error">{error}</p> : null}

      <section className={`broadcast-onair${activeChampId ? ' is-ready' : ''}`} aria-live="polite">
        <span className="broadcast-onair-dot" aria-hidden />
        <div className="broadcast-onair-copy">
          <span>{activeChampId ? 'SAÍDA OBS' : 'AGUARDANDO LIVE'}</span>
          <strong>{activeChampId ? sceneLabel : 'Nenhuma live selecionada'}</strong>
          {activeChampId ? <small>{liveLabel}{busy ? ' · enviando…' : ''}</small> : null}
        </div>
        <div className="broadcast-onair-status">
          <span className={`broadcast-output-state${busy ? ' is-pending' : ''}`}>{outputStatus}</span>
          {activeChampId ? <span className="broadcast-onair-badge">NO AR</span> : null}
        </div>
      </section>

      <section className="broadcast-output-preview" aria-label="Prévia da saída OBS">
        <div className="broadcast-output-preview-head">
          <div>
            <p className="broadcast-control-section-label">Prévia da saída</p>
            <small>Espelha o mesmo Browser Source usado no OBS. É uma referência visual, não um status de conexão do OBS.</small>
          </div>
          <div className="broadcast-output-preview-actions">
            {obsPreviewUrl ? (
              <a href={obsPreviewUrl} target="_blank" rel="noopener noreferrer" className="broadcast-output-preview-link">
                <ExternalLink size={14} /> Abrir saída
              </a>
            ) : null}
            <button
              type="button"
              className="broadcast-output-preview-toggle"
              disabled={!obsPreviewUrl}
              aria-expanded={previewOpen}
              onClick={() => setPreviewOpen((value) => !value)}
            >
              {previewOpen ? <EyeOff size={14} /> : <Eye size={14} />}
              {previewOpen ? 'Ocultar prévia' : 'Ver prévia'}
            </button>
          </div>
        </div>

        {previewOpen && obsPreviewUrl ? (
          <div className="broadcast-output-preview-frame">
            <iframe
              src={obsPreviewUrl}
              title="Prévia da saída OBS"
              className="broadcast-output-preview-iframe"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="broadcast-output-preview-placeholder">
            {obsPreviewUrl ? 'Abra a prévia quando precisar conferir a composição que está saindo.' : 'Saída OBS indisponível para esta mesa.'}
          </div>
        )}
      </section>

      <section className="broadcast-scenes-section">
        <div className="broadcast-scenes-head">
          <div>
            <p className="broadcast-control-section-label">Cenas{packConfigured ? ' · pacote oficial' : ''}</p>
            {activeChampId ? (
              <p className="broadcast-shortcuts"><Keyboard size={13} /> 0 limpa · 1–9 cenas · Esc fecha menus</p>
            ) : null}
          </div>
          {activeChampId ? (
            <div className="broadcast-scenes-summary">
              <span className="broadcast-scenes-current">
                {activeId ? `Cena ${activeSceneNumber}/${overlays.length}` : 'Tela limpa'} · {activeStructureLabel}
              </span>
              <span className="broadcast-scenes-count">{overlays.length} cena{overlays.length === 1 ? '' : 's'}</span>
            </div>
          ) : null}
        </div>

        {!activeChampId ? (
          <div className="broadcast-scenes-empty">Selecione uma live no menu acima para carregar as cenas.</div>
        ) : (
          <ul className="broadcast-scene-list">
            <li>
              <button
                type="button"
                className={`broadcast-scene-row${!activeId ? ' is-active' : ''}`}
                disabled={busy || !activeId}
                aria-current={!activeId ? 'true' : undefined}
                onClick={() => void selectOverlay(null)}
              >
                <span className="broadcast-scene-index is-clear"><MonitorOff size={15} /></span>
                <span className="broadcast-scene-meta">
                  <strong>Tela limpa</strong>
                  <small>Atalho 0 · remove a overlay</small>
                </span>
                {!activeId ? <span className="broadcast-scene-onair">NO AR</span> : null}
              </button>
            </li>
            {overlays.map((overlay, index) => {
              const onAir = activeId === overlay.id
              const shortcut = index < 9 ? String(index + 1) : null
              return (
                <li key={overlay.id}>
                  <button
                    type="button"
                    className={`broadcast-scene-row${onAir ? ' is-active' : ''}`}
                    disabled={busy || onAir}
                    aria-current={onAir ? 'true' : undefined}
                    onClick={() => void selectOverlay(overlay.id)}
                  >
                    <span className="broadcast-scene-index">{shortcut || index + 1}</span>
                    <span className="broadcast-scene-meta">
                      <strong>{overlay.name}</strong>
                      <small>
                        {shortcut ? `Atalho ${shortcut} · ` : ''}
                        {overlay.structure === 'table' ? 'Tabela' : overlay.structure === 'cards' ? 'Cards' : 'Cena destaque'}
                      </small>
                    </span>
                    {onAir ? <span className="broadcast-scene-onair">NO AR</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {activeChampId && !overlays.length && !error ? (
          <div className="broadcast-scenes-empty">
            Nenhuma cena habilitada neste pacote. O admin precisa selecionar as overlays no editor do pacote.
          </div>
        ) : null}
      </section>
    </div>
  )
}
