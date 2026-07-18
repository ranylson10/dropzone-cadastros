'use client'

import { useParams } from 'next/navigation'
import { StreamOverlayEditor } from '@/features/campeonatos/stream'
import '@/features/campeonatos/stream/stream.css'

export default function EditarOverlayPage() {
  const params = useParams<{ id: string; overlayId: string }>()
  const id = String(params?.id || '')
  const overlayId = String(params?.overlayId || '')
  if (!id || !overlayId) return null
  return <StreamOverlayEditor campeonatoId={id} overlayId={overlayId} />
}
