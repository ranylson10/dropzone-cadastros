'use client'

import {
  ArrowLeft,
  BarChart3,
  Flag,
  Gamepad2,
  Info,
  Ticket,
  Users,
  UserCircle2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AgendaCalendar } from '@/features/agenda'
import { BuyVacancyModal } from '@/features/billing/BuyVacancyModal'
import { PixIcon, WhatsAppIcon } from '@/features/billing/BrandIcons'
import { ReportButton } from '@/features/reports/ReportButton'
import { championshipThemeStyle } from '@/lib/championship-theme'
import { supabase } from '@/lib/supabase-browser'
import type { DirectoryProfile, DirectorySectionItem } from '../types'
import {
  DirectoryProfileTabs,
  SlotVagaRow,
  StructureTree,
  renderSectionItems,
} from './DirectoryProfileTabs'
import '@/app/vagas/vagas.css'

type TabId = 'info' | 'equipes' | 'jogadores' | 'jogos' | 'estatisticas'
type EquipesFilterMode = 'geral' | 'fase' | 'grupo'

const TABS: Array<{ id: TabId; label: string; icon: typeof Info }> = [
  { id: 'info', label: 'Informações', icon: Info },
  { id: 'equipes', label: 'Equipes', icon: Users },
  { id: 'jogadores', label: 'Jogadores', icon: UserCircle2 },
  { id: 'jogos', label: 'Agenda', icon: Gamepad2 },
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

function moneyLabel(value: unknown) {
  const number = Number(value)
  return number > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
    : null
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
  const [buyOpen, setBuyOpen] = useState(false)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('aba')
    if (requested === 'estatisticas') setTab('estatisticas')
  }, [])
  const [authenticated, setAuthenticated] = useState(false)

  const enrollment = profile.enrollment
  const canEnroll = Boolean(
    enrollment?.aceita_novas_inscricoes
    && (
      Number(enrollment?.valor_inscricao || 0) >= 1
      || (enrollment?.contatos_whatsapp?.length || 0) > 0
    ),
  )
  const valorLabel = moneyLabel(enrollment?.valor_inscricao)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session?.access_token))
    })
  }, [])

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
  const visibleTabs = TABS.filter(
    (item) =>
      item.id === 'info' ||
      item.id === 'equipes' ||
      item.id === 'jogos' ||
      counts[item.id] > 0,
  )

  const themeStyle = useMemo(
    () =>
      championshipThemeStyle({
        cor_principal: profile.theme?.cor_principal,
        cor_secundaria: profile.theme?.cor_secundaria,
        bg_opacidade: profile.theme?.bg_opacidade,
        bg_image_url: profile.theme?.bg_image_url,
      }),
    [
      profile.theme?.cor_principal,
      profile.theme?.cor_secundaria,
      profile.theme?.bg_opacidade,
      profile.theme?.bg_image_url,
    ],
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
              {canEnroll ? (
                <div className="champ-public-enroll">
                  <div className="champ-public-enroll-meta">
                    {valorLabel ? (
                      <span>
                        <Ticket size={13} /> Inscrição {valorLabel}
                      </span>
                    ) : null}
                    {enrollment?.vagas_livres != null && enrollment.vagas_livres > 0 ? (
                      <span>
                        <Users size={13} /> {enrollment.vagas_livres} vaga
                        {enrollment.vagas_livres === 1 ? '' : 's'} livre
                        {enrollment.vagas_livres === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="button champ-public-enroll-btn"
                    onClick={() => setBuyOpen(true)}
                  >
                    <PixIcon size={16} />
                    <WhatsAppIcon size={16} />
                    Garantir vaga
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <nav className="champ-public-nav" aria-label="Seções do campeonato">
            {visibleTabs.map((item) => {
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
              {canEnroll ? (
                <button
                  type="button"
                  className="button champ-public-enroll-btn"
                  onClick={() => setBuyOpen(true)}
                >
                  <PixIcon size={16} />
                  Garantir vaga
                </button>
              ) : null}
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
          <section className="champ-public-section">
            <header className="champ-public-panel-head">
              <Gamepad2 size={16} />
              <div>
                <strong>Agenda de jogos</strong>
                <small>Calendário mensal com horários e partidas do campeonato</small>
              </div>
            </header>
            <AgendaCalendar
              title={`CALENDÁRIO ${profile.name}`.toUpperCase()}
              scope="campeonato"
              scopeId={profile.id}
              canCreate
              compact
            />
          </section>
        ) : null}

        {tab === 'estatisticas' ? (
          <StatsDashboard
            championshipId={profile.id}
            filters={profile.statsFilters}
            teamsSection={sectionMap.estatisticas}
            mvpSection={sectionMap.mvpExtra}
          />
        ) : null}
      </div>

      <div className="champ-public-desktop-tabs">
        <DirectoryProfileTabs sections={profile.sections} />
      </div>

      {buyOpen && enrollment ? (
        <BuyVacancyModal
          championship={{
            id: profile.id,
            nome: profile.name,
            valor_inscricao: enrollment.valor_inscricao,
            contatos_whatsapp: enrollment.contatos_whatsapp || [],
            proximo_grupo: enrollment.proximo_grupo,
          }}
          returnTo={`/campeonatos/${profile.id}`}
          authenticated={authenticated}
          onClose={() => setBuyOpen(false)}
        />
      ) : null}
    </div>
  )
}


type StatsView = 'tabela' | 'mvp'

type TeamStatsRow = {
  campeonato_equipe_id: string
  nome: string
  tag?: string | null
  logo_url?: string | null
  grupo_id?: string | null
  colocacao: number
  quedas: number
  booyahs: number
  abates: number
  pontos_posicao: number
  pontos_abates: number
  pontos_total: number
}

type MvpStatsRow = {
  campeonato_jogador_id: string
  nick: string
  id_jogo?: string | null
  foto_url?: string | null
  campeonato_equipe_id?: string | null
  colocacao: number
  quedas: number
  abates: number
  dano: number
  assistencias: number
  revives: number
}

function sectionTeams(section?: DirectoryProfile['sections'][number]): TeamStatsRow[] {
  return (section?.items || []).map((item) => ({
    campeonato_equipe_id: item.id,
    nome: item.title,
    tag: item.subtitle || null,
    logo_url: item.image || null,
    grupo_id: String(item.stats?.grupo_id || '') || null,
    colocacao: Number(item.stats?.colocacao || 0),
    quedas: Number(item.stats?.quedas || 0),
    booyahs: Number(item.stats?.booyahs || 0),
    abates: Number(item.stats?.abates || 0),
    pontos_posicao: Number(item.stats?.pontos_posicao || 0),
    pontos_abates: Number(item.stats?.pontos_abates || 0),
    pontos_total: Number(item.stats?.pontos_total || 0),
  }))
}

function sectionMvp(section?: DirectoryProfile['sections'][number]): MvpStatsRow[] {
  return (section?.items || []).map((item) => ({
    campeonato_jogador_id: item.id,
    nick: item.title,
    id_jogo: item.subtitle || null,
    foto_url: item.image || null,
    campeonato_equipe_id: String(item.stats?.campeonato_equipe_id || '') || null,
    colocacao: Number(item.stats?.colocacao || 0),
    quedas: Number(item.stats?.quedas || 0),
    abates: Number(item.stats?.abates || 0),
    dano: Number(item.stats?.dano || 0),
    assistencias: Number(item.stats?.assistencias || 0),
    revives: Number(item.stats?.revives || 0),
  }))
}

function StatsDashboard({
  championshipId,
  filters,
  teamsSection,
  mvpSection,
}: {
  championshipId: string
  filters?: DirectoryProfile['statsFilters']
  teamsSection?: DirectoryProfile['sections'][number]
  mvpSection?: DirectoryProfile['sections'][number]
}) {
  const [view, setView] = useState<StatsView>('tabela')
  const [faseId, setFaseId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [jogoId, setJogoId] = useState('')
  const [partidaId, setPartidaId] = useState('')
  const [mapaCodigo, setMapaCodigo] = useState('')
  const [teams, setTeams] = useState<TeamStatsRow[]>(() => sectionTeams(teamsSection))
  const [players, setPlayers] = useState<MvpStatsRow[]>(() => sectionMvp(mvpSection))
  const [loading, setLoading] = useState(false)

  const availableGroups = useMemo(
    () => (filters?.groups || []).filter((group) => !faseId || group.phaseId === faseId),
    [filters?.groups, faseId],
  )
  const availableRounds = useMemo(
    () => (filters?.rounds || []).filter((round) => !jogoId || round.gameId === jogoId),
    [filters?.rounds, jogoId],
  )

  useEffect(() => {
    if (grupoId && !availableGroups.some((group) => group.id === grupoId)) setGrupoId('')
  }, [availableGroups, grupoId])

  useEffect(() => {
    if (partidaId && !availableRounds.some((round) => round.id === partidaId)) setPartidaId('')
  }, [availableRounds, partidaId])

  useEffect(() => {
    const params = new URLSearchParams()
    if (faseId) params.set('fase_id', faseId)
    if (grupoId) params.set('grupo_id', grupoId)
    if (jogoId) params.set('jogo_id', jogoId)
    if (partidaId) params.set('partida_id', partidaId)
    if (mapaCodigo) params.set('mapa_codigo', mapaCodigo)

    const controller = new AbortController()
    setLoading(true)
    Promise.all([
      fetch(`/api/campeonatos/${championshipId}/estatisticas/equipes?${params}`, { signal: controller.signal }).then((res) => res.json()),
      fetch(`/api/campeonatos/${championshipId}/estatisticas/mvp?${params}`, { signal: controller.signal }).then((res) => res.json()),
    ])
      .then(([teamData, playerData]) => {
        if (Array.isArray(teamData.equipes)) setTeams(teamData.equipes)
        if (Array.isArray(playerData.jogadores)) setPlayers(playerData.jogadores)
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error(error)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [championshipId, faseId, grupoId, jogoId, partidaId, mapaCodigo])

  const groupName = (id?: string | null) =>
    filters?.groups.find((group) => group.id === id)?.label || '—'

  const hasFilters = Boolean(
    filters?.phases.length || filters?.groups.length || filters?.games.length || filters?.rounds.length || filters?.maps.length,
  )

  return (
    <section className="champ-public-section champ-stats-section">
      <header className="champ-public-panel-head champ-stats-head">
        <BarChart3 size={16} />
        <div>
          <strong>Estatísticas</strong>
          <small>Classificação e desempenho individual</small>
        </div>
        {loading ? <span className="champ-stats-loading">Atualizando…</span> : null}
      </header>

      <div className="champ-stats-tabs" role="tablist" aria-label="Tipo de estatística">
        <button type="button" className={view === 'tabela' ? 'active' : ''} onClick={() => setView('tabela')}>
          <BarChart3 size={14} /> Tabela
        </button>
        <button type="button" className={view === 'mvp' ? 'active' : ''} onClick={() => setView('mvp')}>
          <Flag size={14} /> MVP
        </button>
      </div>

      {hasFilters ? (
        <div className="champ-stats-filters">
          {filters?.phases.length ? (
            <label><span>Fase</span><select value={faseId} onChange={(event) => setFaseId(event.target.value)}><option value="">Todas</option>{filters.phases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          ) : null}
          {filters?.groups.length ? (
            <label><span>Grupo</span><select value={grupoId} onChange={(event) => setGrupoId(event.target.value)}><option value="">Todos</option>{availableGroups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          ) : null}
          {filters?.games.length ? (
            <label><span>Jogo</span><select value={jogoId} onChange={(event) => setJogoId(event.target.value)}><option value="">Todos</option>{filters.games.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          ) : null}
          {filters?.rounds.length ? (
            <label><span>Queda</span><select value={partidaId} onChange={(event) => setPartidaId(event.target.value)}><option value="">Todas</option>{availableRounds.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          ) : null}
          {filters?.maps.length ? (
            <label><span>Mapa</span><select value={mapaCodigo} onChange={(event) => setMapaCodigo(event.target.value)}><option value="">Todos</option>{filters.maps.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          ) : null}
        </div>
      ) : null}

      <div className="champ-stats-table-wrap">
        {view === 'tabela' ? (
          teams.length ? (
            <table className="champ-stats-table">
              <thead><tr><th className="pos">#</th><th className="identity">Equipe</th><th>Grupo</th><th>Quedas</th><th>Booyah</th><th>Abates</th><th>P. posição</th><th>P. abates</th><th className="total">Total</th></tr></thead>
              <tbody>{teams.map((row) => <tr key={row.campeonato_equipe_id}><td className="pos"><b>{row.colocacao}</b></td><td className="identity"><span className="champ-stats-avatar">{row.logo_url ? <img src={row.logo_url} alt="" /> : row.nome.slice(0, 2).toUpperCase()}</span><span><strong>{row.nome}</strong>{row.tag ? <small>{row.tag}</small> : null}</span></td><td>{groupName(row.grupo_id)}</td><td>{row.quedas}</td><td>{row.booyahs}</td><td>{row.abates}</td><td>{row.pontos_posicao}</td><td>{row.pontos_abates}</td><td className="total"><b>{row.pontos_total}</b></td></tr>)}</tbody>
            </table>
          ) : <div className="directory-empty compact">Tabela ainda sem dados para este filtro.</div>
        ) : players.length ? (
          <table className="champ-stats-table champ-stats-mvp-table">
            <thead><tr><th className="pos">#</th><th className="identity">Jogador</th><th>Quedas</th><th>Abates</th><th>Dano</th><th>Assist.</th><th>Revives</th></tr></thead>
            <tbody>{players.map((row) => <tr key={row.campeonato_jogador_id}><td className="pos"><b>{row.colocacao}</b></td><td className="identity"><span className="champ-stats-avatar player">{row.foto_url ? <img src={row.foto_url} alt="" /> : row.nick.slice(0, 2).toUpperCase()}</span><span><strong>{row.nick}</strong>{row.id_jogo ? <small>ID {row.id_jogo}</small> : null}</span></td><td>{row.quedas}</td><td className="total"><b>{row.abates}</b></td><td>{row.dano}</td><td>{row.assistencias}</td><td>{row.revives}</td></tr>)}</tbody>
          </table>
        ) : <div className="directory-empty compact">MVP ainda sem dados para este filtro.</div>}
      </div>
    </section>
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
