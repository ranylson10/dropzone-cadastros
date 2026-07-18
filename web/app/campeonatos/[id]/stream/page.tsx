'use client'

import { useParams } from 'next/navigation'
import { StreamWorkspace } from '@/features/campeonatos/stream'

export default function CampeonatoStreamPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  if (!id) return null
  return <StreamWorkspace campeonatoId={id} />
}
