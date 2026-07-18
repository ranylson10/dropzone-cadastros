'use client'

import { useParams } from 'next/navigation'
import { StreamOverlayEditor } from '@/features/campeonatos/stream'
import '@/features/campeonatos/stream/stream.css'

export default function NovaOverlayPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  if (!id) return null
  return <StreamOverlayEditor campeonatoId={id} isNew />
}
