'use client'

import { useParams } from 'next/navigation'
import { StreamOverlayCatalog } from '@/features/campeonatos/stream/components/StreamOverlayCatalog'
import '@/features/campeonatos/stream/stream.css'

/** Nova overlay → catálogo de modelos (não abre editor em branco direto). */
export default function NovaOverlayPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  if (!id) return null
  return <StreamOverlayCatalog campeonatoId={id} />
}
