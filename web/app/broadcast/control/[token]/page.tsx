'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChevronDown, MonitorOff, Radio } from 'lucide-react'
import '@/features/broadcast/broadcast.css'
import '@/features/campeonatos/stream/stream.css'

type OverlayItem = {
  id: string
  name: string
  template?: string
  share_token?: string
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

  const holdActiveUntil = useRef(0)
  const holdChampUntil = useRef(0)
  const liveMenuRef = useRef<HTMLDivElement | null>(null)

  const activeLive = useMemo(
    () => lives.find((l) => l.campeonato_id === activeChampId) || null,
    [lives, activeChampId],
  )

  const liveLabel = activeLive?.display_name
    || champName
    || (activeChampId ? 'Live selecionada' : 'Selecionar live…')

  const liveSub = activeLive?.campeonato?.nome || champName || ''

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

      const now = Date.now()
      if (!opts?.soft || now > holdActiveUntil.current) {
        setActiveId(json.session?.active_overlay_id || null)
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
    const t = window.setInterval(() => void load({ soft: true }), 5000)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!liveMenuOpen) return
    function onDoc(e: MouseEvent) {
      if (!liveMenuRef.current?.contains(e.target as Node)) {
        setLiveMenuOpen(false)
      }
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
      setActiveId(json.session?.active_overlay_id || null)
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
    holdActiveUntil.current = Date.now() + 2500
    setActiveId(id)
    setPendingOverlay(true)
    setError('')
    try {
      const res = await fetch(`/api/broadcast/control/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_overlay_id: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha')
      setActiveId(json.session?.active_overlay_id || null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao trocar cena')
      await load()
    } finally {
      setPendingOverlay(false)
    }
  }

  return (
    <div className="broadcast-control">
      <header className="broadcast-control-head">
        <div className="broadcast-control-head-text">
          <p className="broadcast-control-kicker">STREAM · CONTROLADOR</p>
          <h1>Mesa de live</h1>
          <p className="broadcast-control-hint">
            Escolha a live e toque na cena para ir ao ar
            {(pendingOverlay || pendingLive) ? ' · enviando…' : ''}
          </p>
        </div>

        {/* Menu suspenso de lives */}
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
                onClick={() => setLiveMenuOpen((v) => !v)}
              >
                <span className="broadcast-live-select-icon" aria-hidden>
                  <Radio size={16} />
                </span>
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

      <section className="broadcast-scenes-section">
        <div className="broadcast-scenes-head">
          <p className="broadcast-control-section-label">
            Cenas
            {packConfigured ? ' · pack do campeonato' : ''}
          </p>
          {activeChampId ? (
            <span className="broadcast-scenes-count">
              {overlays.length} cena{overlays.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        {!activeChampId ? (
          <div className="broadcast-scenes-empty">
            Selecione uma live no menu acima para carregar as cenas.
          </div>
        ) : (
          <ul className="broadcast-scene-list">
            <li>
              <button
                type="button"
                className={`broadcast-scene-row${!activeId ? ' is-active' : ''}`}
                onClick={() => void selectOverlay(null)}
              >
                <span className="broadcast-scene-index is-clear">
                  <MonitorOff size={15} />
                </span>
                <span className="broadcast-scene-meta">
                  <strong>Tela limpa</strong>
                  <small>Remove a overlay do OBS</small>
                </span>
                {!activeId ? <span className="broadcast-scene-onair">NO AR</span> : null}
              </button>
            </li>
            {overlays.map((o, i) => {
              const on = activeId === o.id
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`broadcast-scene-row${on ? ' is-active' : ''}`}
                    onClick={() => void selectOverlay(o.id)}
                  >
                    <span className="broadcast-scene-index">{i + 1}</span>
                    <span className="broadcast-scene-meta">
                      <strong>{o.name}</strong>
                      <small>{o.template || 'custom'}</small>
                    </span>
                    {on ? <span className="broadcast-scene-onair">NO AR</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {activeChampId && !overlays.length && !error ? (
          <div className="broadcast-scenes-empty">
            Nenhuma cena nesta live. Peça ao admin para marcar overlays na aba Stream → Composição da live.
          </div>
        ) : null}
      </section>
    </div>
  )
}
