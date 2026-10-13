'use client'

import { useParams } from 'next/navigation'
import { StreamWorkspace } from '@/features/campeonatos/stream'
import { AppShell } from '@/components/layout'

export default function CampeonatoStreamPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  if (!id) return null
  return (
    <AppShell activeLabel="Campeonatos" loadSession headerVariant="storefront" withAuthOffset={false} mainClassName="championship-stream-page">
      <StreamWorkspace campeonatoId={id} />
    </AppShell>
  )
}
