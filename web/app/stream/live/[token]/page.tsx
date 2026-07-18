'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { StreamLiveStage, type StreamLiveData } from '@/features/campeonatos/stream/components/StreamLiveStage'
import type { StreamBlock } from '@/features/campeonatos/stream'
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
  campeonato?: { nome?: string }
}

export default function StreamLivePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [payload, setPayload] = useState<LivePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/stream/live/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha ao carregar')
        if (!cancelled) {
          setPayload(json)
          setError('')
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro')
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 8000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [token])

  if (error) {
    return (
      <main className="stream-live-root">
        <p style={{ padding: 16 }}>{error}</p>
      </main>
    )
  }
  if (!payload) {
    return <main className="stream-live-root" />
  }

  return (
    <main className="stream-live-root">
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
