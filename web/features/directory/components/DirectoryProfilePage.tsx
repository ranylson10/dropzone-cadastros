import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout'
import { EntityProfileHero } from '@/components/entities'
import { ReportButton } from '@/features/reports/ReportButton'
import { DIRECTORY_CONFIG } from '../config'
import { getDirectoryProfile } from '../server'
import type { DirectoryKind } from '../types'
import { ChampionshipPublicView } from './ChampionshipPublicView'
import { DirectoryProfileTabs } from './DirectoryProfileTabs'
import { TeamLinesWorkspace } from '@/components/equipes/TeamLinesWorkspace'
import { CompetitiveProfilePanel } from './CompetitiveProfilePanel'
import './competitive-profile.css'

export async function DirectoryProfilePage({ kind, id }: { kind: DirectoryKind; id: string }) {
  const profile = await getDirectoryProfile(kind, id)
  if (!profile) notFound()
  const config = DIRECTORY_CONFIG[kind]
  const visibleDetails = profile.details.filter((item) => {
    const value = String(item.value ?? '').trim()
    return Boolean(value && value !== '-' && value !== '—')
  })
  const primaryDetails = visibleDetails.slice(0, 3)
  const extraDetails = visibleDetails.slice(3)
  const reportType = {
    campeonatos: 'campeonato',
    equipes: 'equipe',
    jogadores: 'jogador',
    managers: 'manager',
    produtoras: 'produtora',
  }[kind]

  // Campeonato público: navegação por botões no topo (mobile-first)
  if (kind === 'campeonatos') {
    return (
      <AppShell
        activeLabel={config.title}
        loadSession
        headerVariant="storefront"
        withAuthOffset={false}
        mainClassName={`directory-profile-page directory-v1-profile compact-profile directory-theme-${kind} page`}
      >
        <ChampionshipPublicView profile={profile} kindLabel={kind} />
      </AppShell>
    )
  }

  return (
    <AppShell
      activeLabel={config.title}
      loadSession
      headerVariant="storefront"
      withAuthOffset={false}
      mainClassName={`directory-profile-page directory-v1-profile compact-profile directory-theme-${kind} page`}
    >
      <div className="directory-page-body directory-page-body-with-banner directory-immersive-shell profile-command-page">
        <EntityProfileHero
          kind={kind as 'equipes' | 'jogadores' | 'produtoras' | 'managers'}
          backHref={`/${kind}`}
          backLabel={`Voltar para ${config.title.toLowerCase()}`}
          name={profile.name}
          image={profile.image}
          eyebrow={profile.eyebrow || config.singular}
          username={profile.username}
          description={profile.description}
          primaryDetails={primaryDetails}
          extraDetails={extraDetails}
          actions={
            <>
              {profile.competitive ? <a href="#desempenho">Desempenho</a> : null}
              {profile.actions?.map((action) => <a key={action.label} className={action.variant === 'primary' ? 'primary' : ''} href={action.href}>{action.label}</a>)}
              <ReportButton targetType={reportType} targetId={id} targetName={profile.name} />
            </>
          }
        />
        <CompetitiveProfilePanel profile={profile} />
        <DirectoryProfileTabs
          sections={profile.sections}
          agenda={
            kind === 'equipes'
              ? {
                  title: `AGENDA ${profile.name}`.toUpperCase(),
                  scope: 'equipe',
                  scopeId: id,
                  tabLabel: 'Agenda',
                }
              : null
          }
        />
        {kind === 'equipes' ? <TeamLinesWorkspace equipeId={id} /> : null}
      </div>
    </AppShell>
  )
}
