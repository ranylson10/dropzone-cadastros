'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

type CatalogItem = {
  id: string
  name: string
  share_token: string
  updated_at?: string | null
}

const SESSION_POLL_MS = 350
const DATA_REFRESH_MS = 6000

export default function BroadcastObsPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [payload, setPayload] = useState<LivePayload | null>(null)
  const [waiting, setWaiting] = useState(true)
  const [error, setError] = useState('')
  const [activeShare, setActiveShare] = useState<string | null>(null)

  const cacheRef = useRef(new Map<string, LivePayload>())
  const inFlightRef = useRef(new Map<string, Promise<LivePayload | null>>())
  const lastChampRef = useRef<string | null>(null)
  const activeShareRef = useRef<string | null>(null)

  const fetchLive = useCallback(async (shareToken: string): Promise<LivePayload | null> => {
    const cached = cacheRef.current.get(shareToken)
    // reutiliza cache se existir (troca instantânea); refresh em background
    try {
      const res = await fetch(`/api/stream/live/${encodeURIComponent(shareToken)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha live')
      cacheRef.current.set(shareToken, json)
      return json as LivePayload
    } catch {
      return cached || null
    }
  }, [])

  const ensureCached = useCallback(
    (shareToken: string, preferCache = true) => {
      if (preferCache) {
        const hit = cacheRef.current.get(shareToken)
        if (hit) return Promise.resolve(hit)
      }
      const existing = inFlightRef.current.get(shareToken)
      if (existing) return existing
      const p = fetchLive(shareToken).finally(() => {
        inFlightRef.current.delete(shareToken)
      })
      inFlightRef.current.set(shareToken, p)
      return p
    },
    [fetchLive],
  )

  const prefetchCatalog = useCallback(
    (catalog: CatalogItem[]) => {
      for (const item of catalog) {
        if (!item.share_token) continue
        if (cacheRef.current.has(item.share_token)) continue
        void ensureCached(item.share_token, true)
      }
    },
    [ensureCached],
  )

  const showShare = useCallback(
    async (shareToken: string | null) => {
      activeShareRef.current = shareToken
      setActiveShare(shareToken)
      if (!shareToken) {
        setWaiting(true)
        setPayload(null)
        return
      }

      const cached = cacheRef.current.get(shareToken)
      if (cached) {
        // troca instantânea
        setPayload(cached)
        setWaiting(false)
        setError('')
        // atualiza dados em background
        void ensureCached(shareToken, false).then((fresh) => {
          if (fresh && activeShareRef.current === shareToken) {
            setPayload(fresh)
          }
        })
        return
      }

      setWaiting(true)
      const live = await ensureCached(shareToken, true)
      if (activeShareRef.current !== shareToken) return
      if (live) {
        setPayload(live)
        setWaiting(false)
        setError('')
      } else {
        setError('Não foi possível carregar a overlay.')
      }
    },
    [ensureCached],
  )

  // poll da sessão (leve) — decide qual share_token está no ar
  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function pollSession() {
      try {
        const res = await fetch(`/api/broadcast/obs/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Falha OBS')
        if (cancelled) return

        const champId = json.session?.campeonato_id || null
        if (champId !== lastChampRef.current) {
          lastChampRef.current = champId
          // ao trocar de live, limpa cache de cenas antigas (evita payload errado)
          cacheRef.current.clear()
          inFlightRef.current.clear()
        }

        const catalog: CatalogItem[] = Array.isArray(json.catalog) ? json.catalog : []
        if (catalog.length) prefetchCatalog(catalog)

        const nextShare = json.waiting || !json.share_token ? null : String(json.share_token)
        if (nextShare !== activeShareRef.current) {
          void showShare(nextShare)
        }
        setError('')
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro')
      }
    }

    void pollSession()
    const t = window.setInterval(() => void pollSession(), SESSION_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [token, prefetchCatalog, showShare])

  // refresh dos dados da overlay ativa (pontuação etc.) sem piscar cena
  useEffect(() => {
    if (!activeShare) return
    const t = window.setInterval(() => {
      void ensureCached(activeShare, false).then((fresh) => {
        if (fresh && activeShareRef.current === activeShare) {
          setPayload(fresh)
        }
      })
    }, DATA_REFRESH_MS)
    return () => window.clearInterval(t)
  }, [activeShare, ensureCached])

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
        <p className="broadcast-obs-waiting">{waiting ? '' : ''}</p>
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
