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

type PackBg = {
  bg_type: 'none' | 'image' | 'video' | string
  bg_url: string | null
}

const SESSION_POLL_MS = 350
const DATA_REFRESH_MS = 6000

function LiveBackground(props: { pack: PackBg | null }) {
  const bgType = props.pack?.bg_type || 'none'
  const bgUrl = String(props.pack?.bg_url || '').trim()
  if (bgType === 'none' || !bgUrl) return null

  if (bgType === 'video') {
    return (
      <video
        key={bgUrl}
        className="broadcast-obs-bg-media"
        src={bgUrl}
        autoPlay
        muted
        loop
        playsInline
        // sem controls — Browser Source
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={bgUrl} className="broadcast-obs-bg-media" src={bgUrl} alt="" />
  )
}

export default function BroadcastObsPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [payload, setPayload] = useState<LivePayload | null>(null)
  const [waiting, setWaiting] = useState(true)
  const [error, setError] = useState('')
  const [activeShare, setActiveShare] = useState<string | null>(null)
  const [pack, setPack] = useState<PackBg | null>(null)

  const cacheRef = useRef(new Map<string, LivePayload>())
  const inFlightRef = useRef(new Map<string, Promise<LivePayload | null>>())
  const lastChampRef = useRef<string | null>(null)
  const activeShareRef = useRef<string | null>(null)

  const fetchLive = useCallback(async (shareToken: string): Promise<LivePayload | null> => {
    const cached = cacheRef.current.get(shareToken)
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
        setPayload(cached)
        setWaiting(false)
        setError('')
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
          cacheRef.current.clear()
          inFlightRef.current.clear()
        }

        // fundo da composição do campeonato (imagem / vídeo)
        if (json.pack) {
          setPack({
            bg_type: json.pack.bg_type || 'none',
            bg_url: json.pack.bg_url || null,
          })
        } else {
          setPack(null)
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

  const hasBg = Boolean(pack && pack.bg_type !== 'none' && pack.bg_url)

  if (error) {
    return (
      <main className="broadcast-obs-root">
        <p className="broadcast-obs-waiting">{error}</p>
      </main>
    )
  }

  // Tela limpa: ainda mostra BG da live se configurado
  if (waiting || !payload) {
    return (
      <main className={`broadcast-obs-root${hasBg ? ' has-pack-bg' : ''}`}>
        <div className="broadcast-obs-bg" aria-hidden>
          <LiveBackground pack={pack} />
        </div>
      </main>
    )
  }

  return (
    <main className={`broadcast-obs-root stream-live-root${hasBg ? ' has-pack-bg' : ''}`}>
      <div className="broadcast-obs-bg" aria-hidden>
        <LiveBackground pack={pack} />
      </div>
      <div className="broadcast-obs-stage">
        <StreamLiveStage
          template={payload.overlay.template || 'custom'}
          blocks={payload.overlay.blocks || []}
          data={payload.data}
          frameW={payload.overlay.frameW}
          frameH={payload.overlay.frameH}
        />
      </div>
    </main>
  )
}
