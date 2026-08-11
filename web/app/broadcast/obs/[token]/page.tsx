'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { StreamPackageStage } from '@/features/campeonatos/stream/components/StreamPackageStage'
import type {
  StreamOverlayPackage,
  StreamPackageRenderData,
  StreamSystemOverlayType,
} from '@/features/campeonatos/stream/types/stream-package.types'
import '@/features/broadcast/broadcast.css'
import '@/features/campeonatos/stream/stream.css'

type ObsPack = StreamOverlayPackage & {
  bg_type?: 'none' | 'image' | 'video' | string
  bg_url?: string | null
}

type ObsPayload = {
  waiting: boolean
  session?: {
    campeonato_id?: string | null
    active_overlay_type?: StreamSystemOverlayType | null
    updated_at?: string | null
  }
  pack: ObsPack | null
  overlay: { type: StreamSystemOverlayType; name: string; structure: string } | null
  data: StreamPackageRenderData | null
  error?: string
}

const SESSION_POLL_MS = 1000
const DATA_REFRESH_MS = 6000

function LiveBackground(props: { pack: ObsPack | null }) {
  const bgType = props.pack?.bg_type || 'none'
  const bgUrl = String(props.pack?.bg_url || '').trim()
  if (bgType === 'none' || !bgUrl) return null

  if (bgType === 'video') {
    return <video key={bgUrl} className="broadcast-obs-bg-media" src={bgUrl} autoPlay muted loop playsInline />
  }

  return <img key={bgUrl} className="broadcast-obs-bg-media" src={bgUrl} alt="" />
}

export default function BroadcastObsPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [payload, setPayload] = useState<ObsPayload | null>(null)
  const [error, setError] = useState('')

  const activeKeyRef = useRef('')
  const dataRequestRef = useRef<Promise<void> | null>(null)

  const fetchState = useCallback(async (includeData: boolean) => {
    if (!token) return null
    const suffix = includeData ? '?data=1' : ''
    const res = await fetch(`/api/broadcast/obs/${encodeURIComponent(token)}${suffix}`, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Falha OBS')
    return json as ObsPayload
  }, [token])

  const refreshData = useCallback(async () => {
    if (dataRequestRef.current) return dataRequestRef.current
    const task = (async () => {
      try {
        const fresh = await fetchState(true)
        if (!fresh) return
        setPayload(fresh)
        setError('')
      } catch (e: any) {
        setError(e?.message || 'Erro')
      } finally {
        dataRequestRef.current = null
      }
    })()
    dataRequestRef.current = task
    return task
  }, [fetchState])

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function pollSession() {
      try {
        const next = await fetchState(false)
        if (!next || cancelled) return

        const key = `${next.session?.campeonato_id || ''}:${next.session?.active_overlay_type || ''}`
        const changed = key !== activeKeyRef.current
        activeKeyRef.current = key

        if (changed && next.session?.active_overlay_type) {
          setPayload((current) => ({ ...next, data: current && key === `${current.session?.campeonato_id || ''}:${current.session?.active_overlay_type || ''}` ? current.data : null }))
          void refreshData()
        } else {
          setPayload((current) => ({ ...next, data: current?.data || null }))
        }
        setError('')
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro')
      }
    }

    void pollSession()
    const timer = window.setInterval(() => void pollSession(), SESSION_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [token, fetchState, refreshData])

  useEffect(() => {
    if (!payload?.session?.active_overlay_type) return
    const timer = window.setInterval(() => void refreshData(), DATA_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [payload?.session?.active_overlay_type, payload?.session?.campeonato_id, refreshData])

  const hasBg = Boolean(payload?.pack && payload.pack.bg_type !== 'none' && payload.pack.bg_url)

  if (error && !payload) {
    return (
      <main className="broadcast-obs-root">
        <p className="broadcast-obs-waiting">{error}</p>
      </main>
    )
  }

  if (!payload?.pack || payload.waiting || !payload.overlay) {
    return (
      <main className={`broadcast-obs-root${hasBg ? ' has-pack-bg' : ''}`}>
        <div className="broadcast-obs-bg" aria-hidden><LiveBackground pack={payload?.pack || null} /></div>
      </main>
    )
  }

  return (
    <main className={`broadcast-obs-root stream-live-root${hasBg ? ' has-pack-bg' : ''}`}>
      <div className="broadcast-obs-bg" aria-hidden><LiveBackground pack={payload.pack} /></div>
      <div className="broadcast-obs-stage">
        {payload.data ? (
          <StreamPackageStage pack={payload.pack} type={payload.overlay.type} data={payload.data} />
        ) : null}
      </div>
    </main>
  )
}
