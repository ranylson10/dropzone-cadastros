import { AppShell } from '@/components/layout'
import { LocalStudioHandoff } from '@/components/local-studio/LocalStudioHandoff'

export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ artwork?: string }> }) {
  const [{ id }] = await Promise.all([params, searchParams])
  return <AppShell activeLabel="Estúdio local" loadSession mainClassName="page page-authenticated"><LocalStudioHandoff campeonatoId={id} kind="artes" /></AppShell>
}
