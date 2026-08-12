import { AppShell } from '@/components/layout'
import { PostArtworkWorkspace } from '@/features/campeonatos/artes-postagem'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AppShell activeLabel="Artes salvas" loadSession mainClassName="page page-authenticated"><PostArtworkWorkspace campeonatoId={id} mode="manage" /></AppShell>
}
