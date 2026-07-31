import { AppShell } from '@/components/layout'
import { ChampionshipCentral } from '@/components/campeonatos/ChampionshipCentral'

export const dynamic = 'force-dynamic'

export default function CentralCampeonatoPage() {
  return (
    <AppShell activeLabel="Campeonatos" loadSession mainClassName="page page-authenticated championship-central-page">
      <ChampionshipCentral />
    </AppShell>
  )
}
