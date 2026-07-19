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

export default function BroadcastControlPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [overlays, setOverlays] = useState<OverlayItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('Controlador')
  const [champName, setChampName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/broadcast/control/${encodeURIComponent(token)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha')
      setOverlays(json.overlays || [])
      setActiveId(json.session?.active_overlay_id || null)
      setTitle(json.session?.nome || 'Live')
      setChampName(json.campeonato?.nome || '')
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Erro')
    }
  }, [token])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 3000)
    return () => window.clearInterval(t)
  }, [load])

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
    } catch (e: any) {
      setError(e?.message || 'Erro ao trocar overlay')
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
        <h1>{title}</h1>
        {champName ? <p style={{ margin: '4px 0 0', color: '#9aa3b2' }}>{champName}</p> : null}
      </header>

      {error ? <p style={{ color: '#ff8a8a', margin: 0 }}>{error}</p> : null}

      <section>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Overlays do campeonato — clique para ir ao ar no OBS
        </p>
        <div className="broadcast-control-grid">
          <button
            type="button"
            className={`broadcast-control-card${!activeId ? ' is-active' : ''}`}
            disabled={busy}
            onClick={() => void selectOverlay(null)}
          >
            <strong>Tela limpa</strong>
            <small>Nenhuma overlay</small>
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
        {!overlays.length && !error ? (
          <p style={{ color: '#9aa3b2' }}>Nenhuma overlay ativa neste campeonato.</p>
        ) : null}
      </section>
    </div>
  )
}
