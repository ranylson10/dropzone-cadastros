import { AppShell } from '@/components/layout'
import { LocalStudioHandoff } from '@/components/local-studio/LocalStudioHandoff'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AppShell activeLabel="Estúdio local" loadSession mainClassName="page page-authenticated"><LocalStudioHandoff campeonatoId={id} kind="artes" /></AppShell>
}
