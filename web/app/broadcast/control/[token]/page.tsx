'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import '@/features/broadcast/broadcast.css'
import '@/features/campeonatos/stream/stream.css'

type OverlayItem = {
  id: string
  name: string
  template?: string
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
  const [busy, setBusy] = useState(false)
  const [packConfigured, setPackConfigured] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/broadcast/control/${encodeURIComponent(token)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha')
      setLives(json.lives || [])
      setOverlays(json.overlays || [])
      setActiveId(json.session?.active_overlay_id || null)
      setActiveChampId(json.session?.campeonato_id || null)
      setChampName(json.campeonato?.nome || '')
      setPackConfigured(Boolean(json.pack))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Erro')
    }
  }, [token])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 4000)
    return () => window.clearInterval(t)
  }, [load])

  async function selectLive(campeonatoId: string | null) {
    setBusy(true)
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
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Erro ao trocar live')
    } finally {
      setBusy(false)
    }
  }

  async function selectOverlay(id: string | null) {
    setBusy(true)
    try {
      const res = await fetch(`/api/broadcast/control/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_overlay_id: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha')
      setActiveId(json.session?.active_overlay_id || null)
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Erro ao trocar cena')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="broadcast-control">
      <header>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.12em', color: '#e8c547', fontWeight: 900 }}>
          STREAM · CONTROLADOR
        </p>
        <h1>Mesa de live</h1>
        <p style={{ margin: '4px 0 0', color: '#9aa3b2', fontSize: '0.9rem' }}>
          1) Escolha a live · 2) Clique na cena para ir ao ar no OBS
        </p>
      </header>

      {error ? <p style={{ color: '#ff8a8a', margin: 0 }}>{error}</p> : null}

      <section>
        <p className="broadcast-control-section-label">Lives da sua lista</p>
        {!lives.length ? (
          <p style={{ color: '#9aa3b2', margin: 0 }}>
            Nenhum campeonato na lista. No painel Stream, resgate a chave enviada pela produtora.
          </p>
        ) : (
          <div className="broadcast-live-tabs">
            {lives.map((live) => {
              const active = activeChampId === live.campeonato_id
              return (
                <button
                  key={live.id}
                  type="button"
                  className={`broadcast-live-tab${active ? ' is-active' : ''}`}
                  disabled={busy}
                  onClick={() => void selectLive(live.campeonato_id)}
                >
                  <strong>{live.display_name}</strong>
                  <small>{live.campeonato?.nome || live.campeonato_id.slice(0, 8)}</small>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <p className="broadcast-control-section-label">
          Cenas
          {activeChampId
            ? ` · ${champName || lives.find((l) => l.campeonato_id === activeChampId)?.display_name || 'live'}`
            : ' · selecione uma live'}
          {activeChampId && packConfigured ? ' · pack do campeonato' : ''}
        </p>

        {!activeChampId ? (
          <p style={{ color: '#9aa3b2' }}>Selecione uma live acima para carregar as cenas configuradas.</p>
        ) : (
          <div className="broadcast-control-grid">
            <button
              type="button"
              className={`broadcast-control-card${!activeId ? ' is-active' : ''}`}
              disabled={busy}
              onClick={() => void selectOverlay(null)}
            >
              <strong>Tela limpa</strong>
              <small>Nenhuma overlay no OBS</small>
            </button>
            {overlays.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`broadcast-control-card${activeId === o.id ? ' is-active' : ''}`}
                disabled={busy}
                onClick={() => void selectOverlay(o.id)}
              >
                <strong>{o.name}</strong>
                <small>{o.template || 'custom'}</small>
              </button>
            ))}
          </div>
        )}

        {activeChampId && !overlays.length && !error ? (
          <p style={{ color: '#9aa3b2' }}>
            Nenhuma cena nesta live. Peça ao admin do campeonato para marcar overlays na aba Stream → Composição da
            live.
          </p>
        ) : null}
      </section>
    </div>
  )
}
