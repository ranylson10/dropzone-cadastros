import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { ReportButton } from '@/features/reports/ReportButton'
import { DIRECTORY_CONFIG } from '../config'
import { getDirectoryProfile } from '../server'
import type { DirectoryKind } from '../types'
import { ChampionshipPublicView } from './ChampionshipPublicView'
import { DirectoryProfileTabs } from './DirectoryProfileTabs'

export async function DirectoryProfilePage({ kind, id }: { kind: DirectoryKind; id: string }) {
  const profile = await getDirectoryProfile(kind, id)
  if (!profile) notFound()
  const config = DIRECTORY_CONFIG[kind]
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
        mainClassName={`directory-profile-page compact-profile directory-theme-${kind} page page-authenticated`}
      >
        <ChampionshipPublicView profile={profile} kindLabel={kind} />
      </AppShell>
    )
  }

  return (
    <AppShell
      activeLabel={config.title}
      loadSession
      mainClassName={`directory-profile-page compact-profile directory-theme-${kind} page page-authenticated`}
    >
      <div className="directory-page-body directory-page-body-with-banner">
        <section className={`directory-profile-banner theme-${kind} is-compact`} data-theme={kind}>
          <div className="directory-profile-banner-inner">
            <a className="directory-back on-banner" href={`/${kind}`}>
              <ArrowLeft size={15} /> Voltar para {config.title.toLowerCase()}
            </a>
            <div className="directory-profile-hero compact on-banner">
              <span className="directory-profile-avatar">
                {profile.image ? <img src={profile.image} alt="" /> : <b>{profile.name.slice(0, 2).toUpperCase()}</b>}
              </span>
              <div className="directory-profile-copy">
                <small>{profile.eyebrow || config.singular}</small>
                <h1>{profile.name}</h1>
                {profile.username ? <strong>@{profile.username}</strong> : null}
                {profile.description ? (
                  <p className="directory-profile-desc">{profile.description}</p>
                ) : null}
                <div className="directory-profile-toolbar">
                  <ReportButton targetType={reportType} targetId={id} targetName={profile.name} />
                </div>
              </div>
              <div className="directory-profile-details compact on-banner">
                {profile.details.map((item) => (
                  <div key={item.label} className={item.label === 'Sobre' ? 'directory-profile-about' : undefined}>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
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
      </div>
    </AppShell>
  )
}
