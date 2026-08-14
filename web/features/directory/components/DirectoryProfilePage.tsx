import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout'
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
      <div className="directory-page-body directory-page-body-with-banner directory-immersive-shell profile-command-page">
        <section className={`profile-command-hero theme-${kind}`} data-theme={kind}>
          <div className="profile-command-inner">
            <a className="directory-back" href={`/${kind}`}>
              <ArrowLeft size={15} /> Voltar para {config.title.toLowerCase()}
            </a>
            <div className="profile-command-main">
              <span className="profile-command-avatar">
                {profile.image ? <img src={profile.image} alt="" decoding="async" /> : <b>{profile.name.slice(0, 2).toUpperCase()}</b>}
              </span>
              <div className="profile-command-copy">
                <small>{profile.eyebrow || config.singular}</small>
                <h1>{profile.name}</h1>
                {profile.username ? <strong>@{profile.username}</strong> : null}
                {profile.description ? <p>{profile.description}</p> : null}
              </div>
              <dl className="profile-command-facts">
              {profile.details.map((item) => (
                <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
              ))}
              </dl>
            </div>
            <div className="profile-command-actions">
              {profile.competitive ? <a href="#desempenho">Desempenho</a> : null}
              {profile.actions?.map((action) => <a key={action.label} className={action.variant === 'primary' ? 'primary' : ''} href={action.href}>{action.label}</a>)}
              <ReportButton targetType={reportType} targetId={id} targetName={profile.name} />
            </div>
          </div>
        </section>
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
