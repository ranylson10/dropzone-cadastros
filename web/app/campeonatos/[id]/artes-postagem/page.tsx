import { AppShell } from '@/components/layout'
import { PostArtworkWorkspace } from '@/features/campeonatos/artes-postagem'

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ artwork?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return <AppShell activeLabel="Artes para postar" loadSession mainClassName="page page-authenticated"><PostArtworkWorkspace campeonatoId={id} mode="generate" initialArtworkId={query.artwork} /></AppShell>
}
