'use client'

import {
  ArrowLeft,
  BarChart3,
  Flag,
  Gamepad2,
  Info,
  Layers,
  Users,
  UserCircle2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ReportButton } from '@/features/reports/ReportButton'
import type { DirectoryProfile } from '../types'
import { DirectoryProfileTabs, StructureTree, renderSectionItems } from './DirectoryProfileTabs'

type TabId = 'info' | 'equipes' | 'jogadores' | 'grupos' | 'jogos' | 'estatisticas'

const TABS: Array<{ id: TabId; label: string; icon: typeof Info }> = [
  { id: 'info', label: 'Informações', icon: Info },
  { id: 'equipes', label: 'Equipes', icon: Users },
  { id: 'jogadores', label: 'Jogadores', icon: UserCircle2 },
  { id: 'grupos', label: 'Grupos', icon: Layers },
  { id: 'jogos', label: 'Jogos', icon: Gamepad2 },
  { id: 'estatisticas', label: 'Estatísticas', icon: BarChart3 },
]

function findSection(profile: DirectoryProfile, ...titles: string[]) {
  return profile.sections.find((section) =>
    titles.some((title) => section.title.toLowerCase() === title.toLowerCase()),
  )
}

export function ChampionshipPublicView({
  profile,
  kindLabel = 'campeonatos',
}: {
  profile: DirectoryProfile
  kindLabel?: string
}) {
  const [tab, setTab] = useState<TabId>('grupos')

  const sectionMap = useMemo(
    () => ({
      equipes: findSection(profile, 'Equipes participantes'),
      jogadores: findSection(profile, 'MVP'),
      grupos: findSection(profile, 'Fases e grupos'),
      jogos: findSection(profile, 'Jogos'),
      estatisticas: findSection(profile, 'Tabela'),
      mvpExtra: findSection(profile, 'MVP'),
    }),
    [profile],
  )

  const counts: Record<TabId, number> = {
    info: profile.details.length,
    equipes: sectionMap.equipes?.items.length || 0,
    jogadores: sectionMap.jogadores?.items.length || 0,
    grupos: sectionMap.grupos?.items.length || 0,
    jogos: sectionMap.jogos?.items.length || 0,
    estatisticas: sectionMap.estatisticas?.items.length || 0,
  }

  return (
    <div className="directory-page-body directory-page-body-with-banner champ-public">
      <section className="directory-profile-banner theme-campeonatos is-compact champ-public-banner" data-theme="campeonatos">
        <div className="directory-profile-banner-inner">
          <a className="directory-back on-banner" href={`/${kindLabel}`}>
            <ArrowLeft size={15} /> Voltar para {kindLabel}
          </a>
          <div className="directory-profile-hero compact on-banner champ-public-hero">
            <span className="directory-profile-avatar">
              {profile.image ? (
                <img src={profile.image} alt="" />
              ) : (
                <b>{profile.name.slice(0, 2).toUpperCase()}</b>
              )}
            </span>
            <div className="directory-profile-copy">
              <small>{profile.eyebrow || 'Campeonato'}</small>
              <h1>{profile.name}</h1>
              {profile.description ? <p className="directory-profile-desc">{profile.description}</p> : null}
            </div>
          </div>

          <nav className="champ-public-nav" aria-label="Seções do campeonato">
            {TABS.map((item) => {
              const Icon = item.icon
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`champ-public-nav-btn ${active ? 'active' : ''}`}
                  onClick={() => setTab(item.id)}
                >
                  <Icon size={15} strokeWidth={2.2} />
                  <span className="champ-public-nav-label">{item.label}</span>
                  <span className="champ-public-nav-count">{counts[item.id]}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </section>

      <div className="champ-public-panel">
        {tab === 'info' ? (
          <div className="champ-public-info">
            <header className="champ-public-panel-head">
              <Info size={16} />
              <div>
                <strong>Informações</strong>
                <small>Dados gerais do campeonato</small>
              </div>
            </header>
            <div className="champ-public-info-grid">
              {profile.details.map((item) => (
                <div key={item.label} className="champ-public-info-card">
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="champ-public-info-actions">
              <ReportButton targetType="campeonato" targetId={profile.id} targetName={profile.name} />
            </div>
          </div>
        ) : null}

        {tab === 'equipes' ? (
          <SectionPanel
            title="Equipes"
            subtitle="Lines inscritas no campeonato"
            icon={<Users size={16} />}
            empty="Nenhuma equipe inscrita ainda."
            section={sectionMap.equipes}
          />
        ) : null}

        {tab === 'jogadores' ? (
          <SectionPanel
            title="Jogadores"
            subtitle="Ranking MVP / destaques"
            icon={<UserCircle2 size={16} />}
            empty="Nenhum jogador listado ainda."
            section={sectionMap.jogadores}
          />
        ) : null}

        {tab === 'grupos' ? (
          <SectionPanel
            title="Grupos"
            subtitle="Fases, grupos e slots"
            icon={<Layers size={16} />}
            empty="Nenhuma fase ou grupo cadastrado."
            section={sectionMap.grupos}
          />
        ) : null}

        {tab === 'jogos' ? (
          <SectionPanel
            title="Jogos"
            subtitle="Calendário e partidas"
            icon={<Gamepad2 size={16} />}
            empty="Nenhum jogo cadastrado."
            section={sectionMap.jogos}
          />
        ) : null}

        {tab === 'estatisticas' ? (
          <div className="champ-public-stats">
            <SectionPanel
              title="Tabela"
              subtitle="Classificação de equipes"
              icon={<BarChart3 size={16} />}
              empty="Tabela ainda sem dados."
              section={sectionMap.estatisticas}
            />
            {sectionMap.mvpExtra && sectionMap.mvpExtra.items.length > 0 ? (
              <SectionPanel
                title="MVP"
                subtitle="Destaques individuais"
                icon={<Flag size={16} />}
                empty=""
                section={sectionMap.mvpExtra}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Desktop: mantém abas completas em telas largas via CSS; mobile usa só nav de cima */}
      <div className="champ-public-desktop-tabs">
        <DirectoryProfileTabs sections={profile.sections} />
      </div>
    </div>
  )
}

function SectionPanel({
  title,
  subtitle,
  icon,
  empty,
  section,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  empty: string
  section?: DirectoryProfile['sections'][number]
}) {
  return (
    <section className="champ-public-section">
      <header className="champ-public-panel-head">
        {icon}
        <div>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
      </header>
      {!section || section.items.length === 0 ? (
        empty ? <div className="directory-empty compact">{empty}</div> : null
      ) : section.layout === 'structure' ? (
        <StructureTree items={section.items} />
      ) : (
        renderSectionItems(section.items)
      )}
    </section>
  )
}
