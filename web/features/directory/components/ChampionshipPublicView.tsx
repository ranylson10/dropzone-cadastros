'use client'

import {
  ArrowLeft,
  BarChart3,
  Flag,
  Gamepad2,
  Info,
  Users,
  UserCircle2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ReportButton } from '@/features/reports/ReportButton'
import { championshipThemeStyle } from '@/lib/championship-theme'
import type { DirectoryProfile, DirectorySectionItem } from '../types'
import {
  DirectoryProfileTabs,
  SlotVagaRow,
  StructureTree,
  renderSectionItems,
} from './DirectoryProfileTabs'

type TabId = 'info' | 'equipes' | 'jogadores' | 'jogos' | 'estatisticas'
type EquipesFilterMode = 'geral' | 'fase' | 'grupo'

const TABS: Array<{ id: TabId; label: string; icon: typeof Info }> = [
  { id: 'info', label: 'Informações', icon: Info },
  { id: 'equipes', label: 'Equipes', icon: Users },
  { id: 'jogadores', label: 'Jogadores', icon: UserCircle2 },
  { id: 'jogos', label: 'Jogos', icon: Gamepad2 },
  { id: 'estatisticas', label: 'Estatísticas', icon: BarChart3 },
]

type FlatSlot = DirectorySectionItem & {
  phaseId: string
  phaseTitle: string
  groupId: string
  groupTitle: string
}

function findSection(profile: DirectoryProfile, ...titles: string[]) {
  return profile.sections.find((section) =>
    titles.some((title) => section.title.toLowerCase() === title.toLowerCase()),
  )
}

/** Achata fase → grupo → slot para lista com filtros. */
function flattenStructure(section?: DirectoryProfile['sections'][number]) {
  const slots: FlatSlot[] = []
  const phases: Array<{ id: string; title: string }> = []
  const groups: Array<{ id: string; title: string; phaseId: string }> = []

  if (!section?.items?.length) return { slots, phases, groups }

  for (const phase of section.items) {
    phases.push({ id: phase.id, title: phase.title })
    for (const group of phase.children || []) {
      groups.push({ id: group.id, title: group.title, phaseId: phase.id })
      for (const slot of group.children || []) {
        slots.push({
          ...slot,
          phaseId: phase.id,
          phaseTitle: phase.title,
          groupId: group.id,
          groupTitle: group.title,
          // detalhe legível no padrão Equipes
          subtitle: slot.subtitle || [group.title, phase.title].filter(Boolean).join(' · '),
        })
      }
    }
  }

  return { slots, phases, groups }
}

export function ChampionshipPublicView({
  profile,
  kindLabel = 'campeonatos',
}: {
  profile: DirectoryProfile
  kindLabel?: string
}) {
  const [tab, setTab] = useState<TabId>('equipes')
  const [equipesMode, setEquipesMode] = useState<EquipesFilterMode>('geral')
  const [faseId, setFaseId] = useState('')
  const [grupoId, setGrupoId] = useState('')

  const sectionMap = useMemo(
    () => ({
      equipesList: findSection(profile, 'Equipes participantes'),
      jogadores: findSection(profile, 'MVP'),
      grupos: findSection(profile, 'Fases e grupos'),
      jogos: findSection(profile, 'Jogos'),
      estatisticas: findSection(profile, 'Tabela'),
      mvpExtra: findSection(profile, 'MVP'),
    }),
    [profile],
  )

  const structure = useMemo(() => flattenStructure(sectionMap.grupos), [sectionMap.grupos])

  const filteredSlots = useMemo(() => {
    let list = structure.slots
    if (equipesMode === 'fase' && faseId) {
      list = list.filter((slot) => slot.phaseId === faseId)
    }
    if (equipesMode === 'grupo' && grupoId) {
      list = list.filter((slot) => slot.groupId === grupoId)
    }
    return list
  }, [structure.slots, equipesMode, faseId, grupoId])

  const groupsForFase = useMemo(() => {
    if (equipesMode === 'fase' && faseId) {
      return structure.groups.filter((group) => group.phaseId === faseId)
    }
    return structure.groups
  }, [structure.groups, equipesMode, faseId])

  const occupiedCount = structure.slots.filter((slot) => slot.status === 'ocupada').length

  const counts: Record<TabId, number> = {
    info: profile.details.length,
    equipes: occupiedCount || structure.slots.length,
    jogadores: sectionMap.jogadores?.items.length || 0,
    jogos: sectionMap.jogos?.items.length || 0,
    estatisticas: sectionMap.estatisticas?.items.length || 0,
  }

  const themeStyle = useMemo(
    () =>
      championshipThemeStyle({
        cor_principal: profile.theme?.cor_principal,
        cor_secundaria: profile.theme?.cor_secundaria,
      }),
    [profile.theme?.cor_principal, profile.theme?.cor_secundaria],
  )

  return (
    <div
      className="directory-page-body directory-page-body-with-banner champ-public champ-theme"
      style={themeStyle}
    >
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

          <nav className="champ-public-nav champ-public-nav-5" aria-label="Seções do campeonato">
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
          <section className="champ-public-section">
            <header className="champ-public-panel-head">
              <Users size={16} />
              <div>
                <strong>Equipes</strong>
                <small>
                  {occupiedCount}/{structure.slots.length || 0} slots preenchidos
                </small>
              </div>
            </header>

            {/* Filtros: Geral · Fases · Grupos */}
            <div className="champ-equipes-filters" role="tablist" aria-label="Filtro de equipes">
              <button
                type="button"
                className={equipesMode === 'geral' ? 'active' : ''}
                onClick={() => {
                  setEquipesMode('geral')
                  setFaseId('')
                  setGrupoId('')
                }}
              >
                Geral
              </button>
              <button
                type="button"
                className={equipesMode === 'fase' ? 'active' : ''}
                onClick={() => {
                  setEquipesMode('fase')
                  setGrupoId('')
                  if (!faseId && structure.phases[0]) setFaseId(structure.phases[0].id)
                }}
              >
                Fases
              </button>
              <button
                type="button"
                className={equipesMode === 'grupo' ? 'active' : ''}
                onClick={() => {
                  setEquipesMode('grupo')
                  setFaseId('')
                  if (!grupoId && structure.groups[0]) setGrupoId(structure.groups[0].id)
                }}
              >
                Grupos
              </button>
            </div>

            {equipesMode === 'fase' && structure.phases.length > 0 ? (
              <div className="champ-equipes-chips" aria-label="Escolher fase">
                {structure.phases.map((phase) => (
                  <button
                    key={phase.id}
                    type="button"
                    className={faseId === phase.id ? 'active' : ''}
                    onClick={() => setFaseId(phase.id)}
                  >
                    {phase.title}
                  </button>
                ))}
              </div>
            ) : null}

            {equipesMode === 'grupo' && groupsForFase.length > 0 ? (
              <div className="champ-equipes-chips" aria-label="Escolher grupo">
                {groupsForFase.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={grupoId === group.id ? 'active' : ''}
                    onClick={() => setGrupoId(group.id)}
                  >
                    {group.title}
                  </button>
                ))}
              </div>
            ) : null}

            {filteredSlots.length === 0 ? (
              <div className="directory-empty compact">Nenhum slot neste filtro.</div>
            ) : (
              <div className="championship-vagas-list directory-public-slots champ-equipes-list">
                {filteredSlots.map((slot) => (
                  <SlotVagaRow key={slot.id} item={slot} />
                ))}
              </div>
            )}
          </section>
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
