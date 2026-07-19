'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { StreamLiveStage, type StreamLiveData } from '@/features/campeonatos/stream/components/StreamLiveStage'
import type { StreamBlock } from '@/features/campeonatos/stream'
import '@/features/broadcast/broadcast.css'
import '@/features/campeonatos/stream/stream.css'

type LivePayload = {
  overlay: {
    id: string
    name: string
    template: string
    blocks: StreamBlock[]
    frameW?: number
    frameH?: number
  }
  data: StreamLiveData
}

export default function BroadcastObsPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [payload, setPayload] = useState<LivePayload | null>(null)
  const [waiting, setWaiting] = useState(true)
  const [error, setError] = useState('')
  const [shareToken, setShareToken] = useState<string | null>(null)

  // 1) resolve sessão OBS → share_token da overlay ativa
  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function pollSession() {
      try {
        const res = await fetch(`/api/broadcast/obs/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha OBS')
        if (cancelled) return
        if (json.waiting || !json.share_token) {
          setWaiting(true)
          setShareToken(null)
          setPayload(null)
          setError('')
          return
        }
        setShareToken(json.share_token)
        setWaiting(false)
        setError('')
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro')
      }
    }
    void pollSession()
    const t = window.setInterval(() => void pollSession(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [token])

  // 2) carrega payload live da overlay ativa
  useEffect(() => {
    if (!shareToken) return
    let cancelled = false
    async function loadLive() {
      try {
        const res = await fetch(`/api/stream/live/${encodeURIComponent(shareToken!)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha live')
        if (!cancelled) {
          setPayload(json)
          setError('')
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro live')
      }
    }
    void loadLive()
    const t = window.setInterval(() => void loadLive(), 8000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [shareToken])

  if (error) {
    return (
      <main className="broadcast-obs-root">
        <p className="broadcast-obs-waiting">{error}</p>
      </main>
    )
  }

  if (waiting || !payload) {
    return (
      <main className="broadcast-obs-root">
        <p className="broadcast-obs-waiting">{waiting ? 'Aguardando overlay…' : ''}</p>
      </main>
    )
  }

  return (
    <main className="broadcast-obs-root stream-live-root">
      <StreamLiveStage
        template={payload.overlay.template || 'custom'}
        blocks={payload.overlay.blocks || []}
        data={payload.data}
        frameW={payload.overlay.frameW}
        frameH={payload.overlay.frameH}
      />
    </main>
  )
}
