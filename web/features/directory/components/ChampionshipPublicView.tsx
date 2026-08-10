'use client'

import {
  ArrowLeft,
  BarChart3,
  Flag,
  Gamepad2,
  Info,
  Layers3,
  MapPinned,
  SlidersHorizontal,
  Ticket,
  Users,
  UserCircle2,
  X,
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
  StructureTree,
  renderSectionItems,
} from './DirectoryProfileTabs'
import '@/app/vagas/vagas.css'
import './championship-public.css'

type TabId = 'info' | 'equipes' | 'jogadores' | 'estatisticas'

const TABS: Array<{ id: TabId; label: string; icon: typeof Info }> = [
  { id: 'info', label: 'Informações', icon: Info },
  { id: 'equipes', label: 'Equipes', icon: Users },
  { id: 'jogadores', label: 'Jogadores', icon: UserCircle2 },
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
  const [tab, setTab] = useState<TabId>('info')
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
      jogadores: findSection(profile, 'Jogadores participantes'),
      grupos: findSection(profile, 'Fases e grupos'),
      jogos: findSection(profile, 'Jogos'),
      estatisticas: findSection(profile, 'Tabela'),
      mvpExtra: findSection(profile, 'MVP'),
    }),
    [profile],
  )

  const structure = useMemo(() => flattenStructure(sectionMap.grupos), [sectionMap.grupos])

  const filteredTeams = useMemo(() => {
    const occupied = structure.slots.filter((slot) => slot.status === 'ocupada')
    return occupied.filter((slot) => {
      if (faseId && slot.phaseId !== faseId) return false
      if (grupoId && slot.groupId !== grupoId) return false
      return true
    })
  }, [structure.slots, faseId, grupoId])

  const groupsForFase = useMemo(
    () => structure.groups.filter((group) => !faseId || group.phaseId === faseId),
    [structure.groups, faseId],
  )

  useEffect(() => {
    if (grupoId && !groupsForFase.some((group) => group.id === grupoId)) setGrupoId('')
  }, [grupoId, groupsForFase])

  const occupiedCount = structure.slots.filter((slot) => slot.status === 'ocupada').length

  const counts: Record<TabId, number> = {
    info: profile.details.length,
    equipes: occupiedCount || structure.slots.length,
    jogadores: sectionMap.jogadores?.items.length || 0,
    estatisticas: sectionMap.estatisticas?.items.length || 0,
  }
  const visibleTabs = TABS

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
      className="directory-page-body directory-page-body-with-banner directory-immersive-shell champ-public champ-theme"
      style={themeStyle}
    >
      <section className="directory-profile-banner directory-immersive-profile-hero theme-campeonatos is-compact champ-public-banner" data-theme="campeonatos">
        <span className="directory-hero-character" aria-hidden="true" />
        <div className="directory-profile-banner-inner directory-immersive-profile-content">
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
            <div className="champ-public-info-links">
              <a className="button secondary" href={`/campeonatos/${profile.id}/regulamento`}>
                <Flag size={15} /> Regulamento
              </a>
              <ReportButton targetType="campeonato" targetId={profile.id} targetName={profile.name} />
            </div>
            <section className="champ-public-info-agenda">
              <header className="champ-public-panel-head">
                <Gamepad2 size={16} />
                <div>
                  <strong>Agenda</strong>
                  <small>Datas e horários do campeonato</small>
                </div>
              </header>
              <AgendaCalendar
                title={`CALENDÁRIO ${profile.name}`.toUpperCase()}
                scope="campeonato"
                scopeId={profile.id}
                canCreate={false}
                compact
              />
            </section>
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

            <div className="champ-list-filters" aria-label="Filtros das equipes">
              <label>
                <span>Fase</span>
                <select value={faseId} onChange={(event) => setFaseId(event.target.value)}>
                  <option value="">Todas</option>
                  {structure.phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.title}</option>)}
                </select>
              </label>
              <label>
                <span>Grupo</span>
                <select value={grupoId} onChange={(event) => setGrupoId(event.target.value)}>
                  <option value="">Todos</option>
                  {groupsForFase.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}
                </select>
              </label>
            </div>

            {filteredTeams.length === 0 ? (
              <div className="directory-empty compact">Nenhuma equipe neste filtro.</div>
            ) : (
              <div className="champ-public-team-list">
                {filteredTeams.map((team) => (
                  <article key={team.id} className="champ-public-team-row">
                    <span className="champ-public-team-avatar">
                      {team.image ? <img src={team.image} alt="" /> : <Users size={18} />}
                    </span>
                    <span className="champ-public-team-copy">
                      <strong>{team.title}</strong>
                      <small>{team.groupTitle} · {team.phaseTitle}</small>
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {tab === 'jogadores' ? (
          <PlayersDirectoryPanel
            players={sectionPlayers(sectionMap.jogadores)}
            teams={sectionTeams(sectionMap.estatisticas)}
          />
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


      {buyOpen && enrollment ? (
        <BuyVacancyModal
          championship={{
            id: profile.id,
            nome: profile.name,
            valor_inscricao: enrollment.valor_inscricao,
            contatos_whatsapp: enrollment.contatos_whatsapp || [],
            proximo_grupo: enrollment.proximo_grupo,
            pagamento_pix_ativo: enrollment.pagamento_pix_ativo,
            pagamento_cartao_ativo: enrollment.pagamento_cartao_ativo,
            pagamento_paypal_ativo: enrollment.pagamento_paypal_ativo,
            pagamento_whatsapp_ativo: enrollment.pagamento_whatsapp_ativo,
            cartao_max_parcelas: enrollment.cartao_max_parcelas,
            paypal_moedas: enrollment.paypal_moedas,
          }}
          returnTo={`/campeonatos/${profile.id}`}
          authenticated={authenticated}
          onClose={() => setBuyOpen(false)}
        />
      ) : null}
    </div>
  )
}


type StatsView = 'campeao' | 'tabela' | 'mvp'
type MobileFilterMode = 'general' | 'phase' | 'map'

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

type PublicPlayerRow = {
  id: string
  nick: string
  foto_url?: string | null
  campeonato_equipe_id?: string | null
  equipe_nome: string
  partidas: number
}

function sectionPlayers(section?: DirectoryProfile['sections'][number]): PublicPlayerRow[] {
  return (section?.items || []).map((item) => ({
    id: item.id,
    nick: item.title,
    foto_url: item.image || null,
    campeonato_equipe_id: String(item.stats?.campeonato_equipe_id || '') || null,
    equipe_nome: String(item.stats?.equipe_nome || item.subtitle || 'Equipe não informada'),
    partidas: Number(item.stats?.partidas || 0),
  }))
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
  const [view, setView] = useState<StatsView>('campeao')
  const [faseId, setFaseId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [jogoId, setJogoId] = useState('')
  const [partidaId, setPartidaId] = useState('')
  const [mapaCodigo, setMapaCodigo] = useState('')
  const [teams, setTeams] = useState<TeamStatsRow[]>(() => sectionTeams(teamsSection))
  const [players, setPlayers] = useState<MvpStatsRow[]>(() => sectionMvp(mvpSection))
  const [loading, setLoading] = useState(false)
  const [championSummary, setChampionSummary] = useState<any>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mobileFilterMode, setMobileFilterMode] = useState<MobileFilterMode>('general')

  const clearAllFilters = () => {
    setFaseId('')
    setGrupoId('')
    setJogoId('')
    setPartidaId('')
    setMapaCodigo('')
  }

  const selectMobileFilterMode = (mode: MobileFilterMode) => {
    setMobileFilterMode(mode)
    if (mode === 'general') {
      clearAllFilters()
      return
    }
    if (mode === 'map') {
      setFaseId('')
      setGrupoId('')
      setJogoId('')
      setPartidaId('')
      return
    }
    setMapaCodigo('')
  }

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
      fetch(`/api/campeonatos/${championshipId}/estatisticas/campeao`, { signal: controller.signal }).then((res) => res.json()),
    ])
      .then(([teamData, playerData, championData]) => {
        if (Array.isArray(teamData.equipes)) setTeams(teamData.equipes)
        if (Array.isArray(playerData.jogadores)) setPlayers(playerData.jogadores)
        setChampionSummary(championData)
        if (!championData?.final_concluida || !championData?.campeao) setView((current) => current === 'campeao' ? 'tabela' : current)
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error(error)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [championshipId, faseId, grupoId, jogoId, partidaId, mapaCodigo])

  const teamName = (id?: string | null) => teams.find((team) => team.campeonato_equipe_id === id)?.nome || 'Equipe não informada'

  const groupName = (id?: string | null) => {
    const label = filters?.groups.find((group) => group.id === id)?.label || ''
    const normalized = label.replace(/^grupo\s*/i, '').trim()
    return normalized || '—'
  }

  const kdLabel = (row: MvpStatsRow) =>
    row.quedas > 0 ? (row.abates / row.quedas).toFixed(2).replace('.', ',') : '0,00'

  const hasFilters = Boolean(
    filters?.phases.length || filters?.groups.length || filters?.games.length || filters?.rounds.length || filters?.maps.length,
  )
  const activeFilterCount = [faseId, grupoId, jogoId, partidaId, mapaCodigo].filter(Boolean).length

  useEffect(() => {
    if (mapaCodigo) {
      setMobileFilterMode('map')
      return
    }
    if (faseId || grupoId || jogoId || partidaId) {
      setMobileFilterMode('phase')
      return
    }
    setMobileFilterMode('general')
  }, [faseId, grupoId, jogoId, partidaId, mapaCodigo])

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
        {championSummary?.final_concluida && championSummary?.campeao ? <button type="button" className={view === 'campeao' ? 'active' : ''} onClick={() => setView('campeao')}><Flag size={14} /> Campeão</button> : null}
        <button type="button" className={view === 'tabela' ? 'active' : ''} onClick={() => setView('tabela')}>
          <BarChart3 size={14} /> Tabela
        </button>
        <button type="button" className={view === 'mvp' ? 'active' : ''} onClick={() => setView('mvp')}>
          <Flag size={14} /> MVP
        </button>
      </div>

      {hasFilters && view !== 'campeao' ? (
        <>
          <div className="champ-stats-filters champ-stats-filters-desktop">
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
          <div className="champ-stats-mobile-filterbar">
            <button type="button" onClick={() => setFiltersOpen(true)} aria-label="Abrir filtros">
              <SlidersHorizontal size={17} />
              <span>Filtros</span>
              {activeFilterCount ? <b>{activeFilterCount}</b> : null}
            </button>
            {faseId ? <span><Layers3 size={13} /> Fase</span> : null}
            {grupoId ? <span><Users size={13} /> Grupo</span> : null}
            {jogoId ? <span><Gamepad2 size={13} /> Jogo</span> : null}
            {partidaId ? <span><Flag size={13} /> Queda</span> : null}
            {mapaCodigo ? <span><MapPinned size={13} /> Mapa</span> : null}
          </div>
          <div className="champ-stats-filters-mobile">
            {filters?.phases.length ? (
              <label><span>Fase</span><select value={faseId} onChange={(event) => { setFaseId(event.target.value); setGrupoId(''); setJogoId(''); setPartidaId('') }}><option value="">Todas</option>{filters.phases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            ) : null}
            {filters?.groups.length ? (
              <label><span>Grupo</span><select value={grupoId} onChange={(event) => { setGrupoId(event.target.value); setJogoId(''); setPartidaId('') }}><option value="">Todos</option>{availableGroups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            ) : null}
            {filters?.games.length ? (
              <label><span>Jogo</span><select value={jogoId} onChange={(event) => { setJogoId(event.target.value); setPartidaId('') }}><option value="">Todos</option>{filters.games.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            ) : null}
            {filters?.rounds.length ? (
              <label><span>Queda</span><select value={partidaId} onChange={(event) => setPartidaId(event.target.value)}><option value="">Todas</option>{availableRounds.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            ) : null}
            {filters?.maps.length ? (
              <label><span>Mapa</span><select value={mapaCodigo} onChange={(event) => setMapaCodigo(event.target.value)}><option value="">Todos</option>{filters.maps.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            ) : null}
          </div>
          {filtersOpen ? (
            <div className="champ-filter-overlay" role="dialog" aria-modal="true" aria-label="Filtros das estatísticas">
              <button type="button" className="champ-filter-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros" />
              <div className="champ-filter-sheet">
                <header><strong>Filtrar estatísticas</strong><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fechar"><X size={18} /></button></header>
                <section className="champ-filter-group champ-filter-mode">
                  <h4><SlidersHorizontal size={15} />Modo</h4>
                  <div>
                    <button type="button" className={mobileFilterMode === 'general' ? 'active' : ''} onClick={() => selectMobileFilterMode('general')}>Geral</button>
                    <button type="button" className={mobileFilterMode === 'phase' ? 'active' : ''} onClick={() => selectMobileFilterMode('phase')}>Fase</button>
                    <button type="button" className={mobileFilterMode === 'map' ? 'active' : ''} onClick={() => selectMobileFilterMode('map')}>Mapa</button>
                  </div>
                  <p className="champ-filter-hint">Escolha o tipo de recorte para liberar só as próximas opções necessárias.</p>
                </section>

                {mobileFilterMode === 'general' ? (
                  <section className="champ-filter-empty">
                    <strong>Visão geral</strong>
                    <p>Mostra todos os resultados do campeonato sem abrir grupos, jogos ou quedas.</p>
                  </section>
                ) : null}

                {mobileFilterMode === 'phase' ? (
                  <>
                    {filters?.phases.length ? (
                      <FilterOptionGroup
                        icon={<Layers3 size={15} />}
                        label="Fase"
                        value={faseId}
                        onChange={(value) => {
                          setFaseId(value)
                          setGrupoId('')
                          setJogoId('')
                          setPartidaId('')
                        }}
                        options={filters.phases}
                        allLabel="Todas"
                      />
                    ) : null}
                    {faseId ? (
                      <>
                        {filters?.groups.length ? (
                          <FilterOptionGroup
                            icon={<Users size={15} />}
                            label="Grupo"
                            value={grupoId}
                            onChange={(value) => {
                              setGrupoId(value)
                              setJogoId('')
                              setPartidaId('')
                            }}
                            options={availableGroups}
                            allLabel="Todos"
                          />
                        ) : null}
                        {filters?.games.length ? (
                          <FilterOptionGroup
                            icon={<Gamepad2 size={15} />}
                            label="Jogo"
                            value={jogoId}
                            onChange={(value) => {
                              setJogoId(value)
                              setPartidaId('')
                            }}
                            options={filters.games}
                            allLabel="Todos"
                          />
                        ) : null}
                        {jogoId && filters?.rounds.length ? (
                          <FilterOptionGroup
                            icon={<Flag size={15} />}
                            label="Queda"
                            value={partidaId}
                            onChange={setPartidaId}
                            options={availableRounds}
                            allLabel="Todas"
                          />
                        ) : null}
                      </>
                    ) : (
                      <section className="champ-filter-empty compact">
                        <p>Selecione uma fase para liberar grupos, jogos e quedas.</p>
                      </section>
                    )}
                  </>
                ) : null}

                {mobileFilterMode === 'map' ? (
                  filters?.maps.length ? (
                    <FilterOptionGroup icon={<MapPinned size={15} />} label="Mapa" value={mapaCodigo} onChange={setMapaCodigo} options={filters.maps} allLabel="Todos" />
                  ) : (
                    <section className="champ-filter-empty compact">
                      <p>Este campeonato ainda não possui mapas cadastrados para filtrar.</p>
                    </section>
                  )
                ) : null}
                <footer>
                  <button type="button" className="button secondary" onClick={() => { clearAllFilters(); setMobileFilterMode('general') }}>Limpar</button>
                  <button type="button" className="button" onClick={() => setFiltersOpen(false)}>Aplicar</button>
                </footer>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {view === 'campeao' && championSummary?.campeao ? <section className="champion-public-spotlight"><div className="champion-public-badge">CAMPEÃO</div><div className="champion-public-main"><span className="champion-public-logo">{championSummary.campeao.logo_url ? <img src={championSummary.campeao.logo_url} alt="" /> : championSummary.campeao.nome.slice(0,2).toUpperCase()}</span><div><small>Grande Final concluída</small><h2>{championSummary.campeao.nome}</h2><p>{championSummary.campeao.pontos_total} PTS · {championSummary.campeao.booyahs} BOOYAH · {championSummary.campeao.abates} KILLS · {championSummary.resumo?.quedas || championSummary.campeao.quedas} QUEDAS</p></div></div><div className="champion-public-lineup"><strong>LINE CAMPEÃ</strong><div>{(championSummary.jogadores || []).map((player:any)=><article key={player.campeonato_jogador_id}>{player.foto_url?<img src={player.foto_url} alt=""/>:<span>{String(player.nick||'?').slice(0,1)}</span>}<b>{player.nick}</b><small>{player.abates} kills</small></article>)}</div></div><footer><button type="button" onClick={()=>setView('mvp')}><Flag size={14}/> Ver MVP</button><button type="button" onClick={()=>setView('tabela')}><BarChart3 size={14}/> Estatísticas do campeonato</button></footer></section> : null}

      {view !== 'campeao' ? <div className="champ-stats-table-wrap champ-stats-desktop-table">
        {view === 'tabela' ? (
          teams.length ? (
            <table className="champ-stats-table champ-stats-team-table">
              <thead><tr><th className="pos">#</th><th className="identity">Equipe</th><th>GP</th><th>QD</th><th>B!</th><th>Kill</th><th className="total">Pts</th></tr></thead>
              <tbody>{teams.map((row) => <tr key={row.campeonato_equipe_id}><td className="pos"><b>{row.colocacao}</b></td><td className="identity"><span className="champ-stats-avatar">{row.logo_url ? <img src={row.logo_url} alt="" /> : row.nome.slice(0, 2).toUpperCase()}</span><span><strong>{row.nome}</strong></span></td><td className="stat-group"><b>{groupName(row.grupo_id)}</b></td><td className="stat-secondary">{row.quedas}</td><td className="stat-secondary">{row.booyahs}</td><td className="stat-secondary">{row.abates}</td><td className="total"><b>{row.pontos_total}</b></td></tr>)}</tbody>
            </table>
          ) : <div className="directory-empty compact">Tabela ainda sem dados para este filtro.</div>
        ) : players.length ? (
          <table className="champ-stats-table champ-stats-mvp-table">
            <thead><tr><th className="pos">#</th><th className="identity">Jogador</th><th>QD</th><th>K.D</th><th className="total">Kill</th></tr></thead>
            <tbody>{players.map((row) => <tr key={row.campeonato_jogador_id}><td className="pos"><b>{row.colocacao}</b></td><td className="identity"><span className="champ-stats-avatar player"><img src={row.foto_url || '/images/jogador-misterioso.png'} alt="" /></span><span><strong>{row.nick}</strong></span></td><td className="stat-secondary">{row.quedas}</td><td className="stat-secondary"><b>{kdLabel(row)}</b></td><td className="total"><b>{row.abates}</b></td></tr>)}</tbody>
          </table>
        ) : <div className="directory-empty compact">MVP ainda sem dados para este filtro.</div>}
      </div> : null}

      {view !== 'campeao' ? <div className="champ-stats-mobile-list">
        {view === 'tabela' ? (
          teams.length ? teams.map((row) => (
            <article key={row.campeonato_equipe_id} className="champ-stats-mobile-row">
              <span className="champ-stats-mobile-position">{row.colocacao}</span>
              <span className="champ-stats-avatar">{row.logo_url ? <img src={row.logo_url} alt="" /> : row.nome.slice(0, 2).toUpperCase()}</span>
              <span className="champ-stats-mobile-copy">
                <strong>{row.nome}</strong>
                <small>Grupo {groupName(row.grupo_id)} · {row.quedas} quedas · {row.booyahs} B! · {row.abates} kills</small>
              </span>
              <span className="champ-stats-mobile-primary"><small>Pontos</small><b>{row.pontos_total}</b></span>
            </article>
          )) : <div className="directory-empty compact">Tabela ainda sem dados para este filtro.</div>
        ) : players.length ? players.map((row) => (
          <article key={row.campeonato_jogador_id} className="champ-stats-mobile-row">
            <span className="champ-stats-mobile-position">{row.colocacao}</span>
            <span className="champ-stats-avatar player"><img src={row.foto_url || '/images/jogador-misterioso.png'} alt="" /></span>
            <span className="champ-stats-mobile-copy">
              <strong>{row.nick}</strong>
              <small>{teamName(row.campeonato_equipe_id)} · {row.quedas} quedas · K.D {kdLabel(row)} · {row.dano} dano · {row.assistencias} AST · {row.revives} rev</small>
            </span>
            <span className="champ-stats-mobile-primary"><small>Kills</small><b>{row.abates}</b></span>
          </article>
        )) : <div className="directory-empty compact">MVP ainda sem dados para este filtro.</div>}
      </div> : null}
    </section>
  )
}


function FilterOptionGroup({
  icon,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; label: string }>
  allLabel: string
}) {
  return (
    <section className="champ-filter-group">
      <h4>{icon}{label}</h4>
      <div>
        <button type="button" className={!value ? 'active' : ''} onClick={() => onChange('')}>{allLabel}</button>
        {options.map((item) => <button key={item.id} type="button" className={value === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>{item.label}</button>)}
      </div>
    </section>
  )
}

function PlayersDirectoryPanel({ players, teams }: { players: PublicPlayerRow[]; teams: TeamStatsRow[] }) {
  const [teamId, setTeamId] = useState('')
  const teamOptions = useMemo(() => {
    const byId = new Map<string, string>()
    teams.forEach((team) => byId.set(team.campeonato_equipe_id, team.nome))
    players.forEach((player) => {
      if (player.campeonato_equipe_id && !byId.has(player.campeonato_equipe_id)) byId.set(player.campeonato_equipe_id, player.equipe_nome)
    })
    return Array.from(byId, ([id, nome]) => ({ id, nome }))
  }, [players, teams])
  const filtered = useMemo(
    () => players.filter((player) => !teamId || player.campeonato_equipe_id === teamId),
    [players, teamId],
  )

  return (
    <section className="champ-public-section">
      <header className="champ-public-panel-head">
        <UserCircle2 size={16} />
        <div><strong>Jogadores</strong><small>Elenco inscrito no campeonato</small></div>
      </header>
      <div className="champ-list-filters single">
        <label><span>Equipe</span><select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Todas</option>{teamOptions.map((team) => <option key={team.id} value={team.id}>{team.nome}</option>)}</select></label>
      </div>
      {filtered.length ? <div className="champ-public-player-list">{filtered.map((player) => (
        <article key={player.id} className="champ-public-player-row">
          <span className="champ-public-player-avatar"><img src={player.foto_url || '/images/jogador-misterioso.png'} alt="" /></span>
          <span className="champ-public-player-copy"><strong>{player.nick}</strong><small>{player.equipe_nome}</small></span>
          <span className="champ-public-player-kills"><small>Partidas</small><b>{player.partidas}</b></span>
        </article>
      ))}</div> : <div className="directory-empty compact">Nenhum jogador neste filtro.</div>}
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
