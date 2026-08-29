'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import { ResultadoWhatsappCard } from './ResultadoWhatsappCard'
import '../campeonato-estatisticas.css'

type InnerTab = 'campeao' | 'geral' | 'mvp' | 'pontuador'
type ScoringMode = 'manual' | 'matchresult'

type TeamStat = {
  colocacao: number
  campeonato_equipe_id: string
  nome: string
  tag?: string | null
  logo_url?: string | null
  grupo_id?: string | null
  quedas: number
  booyahs: number
  abates: number
  pontos_posicao: number
  pontos_abates: number
  pontos_total: number
  variacao?: number
}

type MvpStat = {
  colocacao: number
  campeonato_jogador_id: string
  nick: string
  id_jogo?: string | null
  foto_url?: string | null
  tipo_jogador: string
  quedas: number
  abates: number
  variacao?: number
}


type ChampionSummary = {
  final_concluida: boolean
  campeao: TeamStat | null
  jogadores: MvpStat[]
  mvp_final: MvpStat | null
  configuracao?: Record<string, any> | null
  resumo?: { dias: number; jogos: number; quedas: number; quedas_finalizadas: number; jogo_decisivo?: Record<string, any> | null } | null
}

type SumulaTeam = Record<string, any>
type SumulaPlayer = Record<string, any>
type SumulaPartida = Record<string, any>

type PreviewTeam = {
  nome: string
  nome_normalizado: string
  posicao: number
  abates: number
  campeonato_equipe_id: string | null
  status_vinculo: string
  jogadores: Array<{ nick: string; id_jogo: string; abates: number; status_vinculo: string }>
}

type Filters = {
  fase_id: string
  rodada_id: string
  jogo_id: string
  partida_id: string
  mapa_codigo: string
  grupo_id: string
}

const EMPTY_FILTERS: Filters = { fase_id: '', rodada_id: '', jogo_id: '', partida_id: '', mapa_codigo: '', grupo_id: '' }

async function request<T>(url: string, options?: RequestInit, authenticated = false): Promise<T> {
  let authorization: Record<string, string> = {}
  if (authenticated) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    authorization = { Authorization: `Bearer ${token}` }
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...authorization,
      ...(options?.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload as T
}

function rowName(row: Record<string, any>) {
  return row.nome_exibicao || row.equipe_lines?.nome || row.equipes?.nome || row.nome || 'Equipe'
}

function playerName(row: Record<string, any>) {
  return row.jogadores?.nome || row.jogadores_temporarios?.nick || row.nick || 'Jogador'
}


function groupCode(groupId: string | null | undefined, groups: DropZoneRow[]) {
  if (!groupId) return '—'
  const group = groups.find((item) => item.id === groupId)
  const name = String(group?.data?.nome || group?.name || '').trim()
  const match = name.match(/(?:grupo\s*)?([A-Z0-9]+)$/i)
  return (match?.[1] || name || '—').toUpperCase()
}

function kdValue(abates: number, quedas: number) {
  if (!quedas) return '0,00'
  return (abates / quedas).toFixed(2).replace('.', ',')
}


function variationLabel(value: number | undefined) {
  const n = Number(value || 0)
  if (n > 0) return { text: `+${n} ▲`, className: 'is-up', title: `Subiu ${n} posição${n === 1 ? '' : 'ões'}` }
  if (n < 0) return { text: `${n} ▼`, className: 'is-down', title: `Desceu ${Math.abs(n)} posição${Math.abs(n) === 1 ? '' : 'ões'}` }
  return { text: '0 =', className: 'is-neutral', title: 'Manteve a posição' }
}

function VariationCell({ value }: { value?: number }) {
  const meta = variationLabel(value)
  return <span className={`statistics-variation ${meta.className}`} title={meta.title}>{meta.text}</span>
}

function queryString(filters: Filters) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => value && query.set(key, value))
  return query.toString()
}

export function CampeonatoEstatisticasTab(props: {
  campeonatoId: string
  campeonatoNome?: string
  campeonatoLogo?: string | null
  phases: DropZoneRow[]
  groups: DropZoneRow[]
  games: DropZoneRow[]
  maps: Array<{ codigo: string; nome: string }>
}) {
  const [tab, setTab] = useState<InnerTab>('campeao')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [teamStats, setTeamStats] = useState<TeamStat[]>([])
  const [mvpStats, setMvpStats] = useState<MvpStat[]>([])
  const [championSummary, setChampionSummary] = useState<ChampionSummary | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState('')
  const previousTeamPositions = useRef(new Map<string, number>())
  const previousMvpPositions = useRef(new Map<string, number>())

  const [sumulaLoading, setSumulaLoading] = useState(false)
  const [sumulaTeams, setSumulaTeams] = useState<SumulaTeam[]>([])
  const [sumulaPlayers, setSumulaPlayers] = useState<SumulaPlayer[]>([])
  const [partidas, setPartidas] = useState<SumulaPartida[]>([])
  const [selectedPartidaId, setSelectedPartidaId] = useState('')
  const [mode, setMode] = useState<ScoringMode>('manual')
  const [manual, setManual] = useState<Record<string, { posicao: string; abates: string; jogadores: Record<string, string> }>>({})
  const [saving, setSaving] = useState(false)
  const [matchFileName, setMatchFileName] = useState('')
  const [matchContent, setMatchContent] = useState('')
  const [preview, setPreview] = useState<PreviewTeam[]>([])
  const [previewLinks, setPreviewLinks] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')

  const selectedGameIds = useMemo(() => new Set(props.games.filter((game) => !filters.fase_id || game.data?.fase_id === filters.fase_id).map((game) => game.id)), [props.games, filters.fase_id])
  const filteredPartidas = useMemo(() => partidas.filter((partida) => (!filters.rodada_id || partida.rodada_id === filters.rodada_id) && (!filters.jogo_id || partida.jogo_id === filters.jogo_id)), [partidas, filters.rodada_id, filters.jogo_id])
  const rounds = useMemo(() => {
    const unique = new Map<string, string>()
    for (const partida of partidas) {
      if (partida.rodada_id) unique.set(partida.rodada_id, partida.rodada_nome || `Rodada ${unique.size + 1}`)
    }
    return [...unique.entries()].map(([id, nome]) => ({ id, nome }))
  }, [partidas])

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    setError('')
    try {
      const query = queryString(filters)
      const suffix = query ? `?${query}` : ''
      const [teamsResult, mvpResult, championResult] = await Promise.all([
        request<{ equipes: TeamStat[] }>(`/api/campeonatos/${props.campeonatoId}/estatisticas/equipes${suffix}`, undefined, true),
        request<{ jogadores: MvpStat[] }>(`/api/campeonatos/${props.campeonatoId}/estatisticas/mvp${suffix}`, undefined, true),
        request<ChampionSummary>(`/api/campeonatos/${props.campeonatoId}/estatisticas/campeao`, undefined, true),
      ])
      const nextTeams = (teamsResult.equipes || []).map((row) => ({
        ...row,
        variacao: previousTeamPositions.current.has(row.campeonato_equipe_id)
          ? (previousTeamPositions.current.get(row.campeonato_equipe_id) || row.colocacao) - row.colocacao
          : 0,
      }))
      const nextMvp = (mvpResult.jogadores || []).map((row) => ({
        ...row,
        variacao: previousMvpPositions.current.has(row.campeonato_jogador_id)
          ? (previousMvpPositions.current.get(row.campeonato_jogador_id) || row.colocacao) - row.colocacao
          : 0,
      }))
      previousTeamPositions.current = new Map(nextTeams.map((row) => [row.campeonato_equipe_id, row.colocacao]))
      previousMvpPositions.current = new Map(nextMvp.map((row) => [row.campeonato_jogador_id, row.colocacao]))
      setTeamStats(nextTeams)
      setMvpStats(nextMvp)
      setChampionSummary(championResult)
      if (!championResult.final_concluida || !championResult.campeao) setTab((current) => current === 'campeao' ? 'geral' : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar estatísticas.')
    } finally {
      setLoadingStats(false)
    }
  }, [filters, props.campeonatoId])

  const loadSumula = useCallback(async () => {
    setSumulaLoading(true)
    setError('')
    try {
      const result = await request<{ partidas: SumulaPartida[]; equipes: SumulaTeam[]; jogadores: SumulaPlayer[] }>(`/api/campeonatos/${props.campeonatoId}/sumula`, undefined, true)
      setPartidas(result.partidas || [])
      setSumulaTeams(result.equipes || [])
      setSumulaPlayers(result.jogadores || [])
      setSelectedPartidaId((current) => current || result.partidas?.[0]?.id || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar pontuador.')
    } finally {
      setSumulaLoading(false)
    }
  }, [props.campeonatoId])

  useEffect(() => { void loadStats() }, [loadStats])
  useEffect(() => { if (partidas.length === 0) void loadSumula() }, [partidas.length, loadSumula])

  const selectedPartida = partidas.find((partida) => partida.id === selectedPartidaId)
  const selectedJogo = props.games.find((game) => game.id === selectedPartida?.jogo_id)
  const participatingGroupIds = Array.isArray(selectedJogo?.data?.grupos_ids) ? selectedJogo?.data?.grupos_ids as string[] : []
  const eligibleTeams = sumulaTeams.filter((team) => participatingGroupIds.length === 0 || participatingGroupIds.includes(team.grupo_id))
  const shareScope = useMemo(() => {
    const selectedDrop = filteredPartidas.find((item) => item.id === filters.partida_id)
    const values = [
      props.phases.find((item) => item.id === filters.fase_id)?.data?.nome,
      props.groups.find((item) => item.id === filters.grupo_id)?.data?.nome,
      rounds.find((item) => item.id === filters.rodada_id)?.nome,
      props.games.find((item) => item.id === filters.jogo_id)?.data?.nome,
      selectedDrop ? `Queda ${selectedDrop.numero_partida}` : null,
    ].filter(Boolean)
    return values.length ? `Classificação · ${values.join(' · ')}` : 'Classificação geral do campeonato'
  }, [filteredPartidas, filters, props.games, props.groups, props.phases, rounds])

  function setManualTeam(teamId: string, patch: Partial<{ posicao: string; abates: string }>) {
    setManual((current) => {
      const previous = current[teamId] || { posicao: '', abates: '', jogadores: {} }
      return { ...current, [teamId]: { ...previous, ...patch } }
    })
  }

  function setManualPlayer(teamId: string, playerId: string, value: string) {
    setManual((current) => ({
      ...current,
      [teamId]: (() => {
        const previous = current[teamId] || { posicao: '', abates: '', jogadores: {} }
        return { ...previous, jogadores: { ...previous.jogadores, [playerId]: value } }
      })(),
    }))
  }

  async function saveManual() {
    if (!selectedPartidaId) return setError('Selecione uma queda.')
    const equipes = eligibleTeams.flatMap((team) => {
      const values = manual[team.id]
      if (!values?.posicao) return []
      const players = sumulaPlayers
        .filter((player) => player.campeonato_equipe_id === team.id)
        .map((player) => ({ campeonato_jogador_id: player.id, abates: Number(values.jogadores[player.id] || 0) }))
      return [{ campeonato_equipe_id: team.id, posicao: Number(values.posicao), abates: Number(values.abates || 0), jogadores: players }]
    })
    if (!equipes.length) return setError('Preencha a posição de pelo menos uma equipe.')
    setSaving(true); setError(''); setNotice('')
    try {
      await request(`/api/campeonatos/${props.campeonatoId}/sumula/manual`, { method: 'POST', body: JSON.stringify({ partida_id: selectedPartidaId, equipes }) }, true)
      setNotice('Pontuação salva. Os pontos foram recalculados pelo sistema.')
      await loadStats()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao salvar pontuação.')
    } finally { setSaving(false) }
  }

  async function readMatchFile(file?: File) {
    if (!file) return
    setMatchFileName(file.name)
    setMatchContent(await file.text())
    setPreview([])
    setPreviewLinks({})
  }

  async function previewMatchResult() {
    if (!selectedPartidaId || !matchContent) return setError('Selecione a queda e o arquivo MatchResult.')
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await request<{ preview: { equipes: PreviewTeam[] } }>(`/api/campeonatos/${props.campeonatoId}/sumula/matchresult/preview`, { method: 'POST', body: JSON.stringify({ partida_id: selectedPartidaId, conteudo_bruto: matchContent }) }, true)
      setPreview(result.preview.equipes || [])
      setPreviewLinks(Object.fromEntries((result.preview.equipes || []).map((team) => [team.nome_normalizado, team.campeonato_equipe_id || ''])))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao interpretar MatchResult.')
    } finally { setSaving(false) }
  }

  async function confirmMatchResult() {
    const missing = preview.find((team) => !previewLinks[team.nome_normalizado])
    if (missing) return setError(`Vincule a equipe "${missing.nome}".`)
    setSaving(true); setError(''); setNotice('')
    try {
      await request(`/api/campeonatos/${props.campeonatoId}/sumula/matchresult/confirmar`, {
        method: 'POST',
        body: JSON.stringify({
          partida_id: selectedPartidaId,
          nome_arquivo: matchFileName,
          conteudo_bruto: matchContent,
          equipes: preview.map((team) => ({ nome: team.nome, campeonato_equipe_id: previewLinks[team.nome_normalizado] })),
        }),
      }, true)
      setNotice('MatchResult confirmado e pontuação registrada.')
      setPreview([]); setMatchContent(''); setMatchFileName('')
      await Promise.all([loadStats(), loadSumula()])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao confirmar MatchResult.')
    } finally { setSaving(false) }
  }

  async function finalizeDrop() {
    if (!selectedPartidaId) return
    if (!window.confirm('Finalizar esta queda? Depois disso a pontuação não poderá ser alterada.')) return
    setSaving(true); setError(''); setNotice('')
    try {
      await request(`/api/campeonatos/${props.campeonatoId}/quedas/${selectedPartidaId}/finalizar`, { method: 'POST' }, true)
      setNotice('Queda finalizada.')
      await loadSumula()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao finalizar queda.')
    } finally { setSaving(false) }
  }

  const leader = teamStats[0] || null
  const mvpLeader = mvpStats[0] || null
  const totalDrops = teamStats.reduce((max, row) => Math.max(max, Number(row.quedas || 0)), 0)

  return (
    <section className="champ-stats">
      <header className="champ-stats-head">
        <div>
          <p>Classificação e estatísticas</p>
          <h2>Desempenho do campeonato</h2>
        </div>
        <button
          className="champ-stats-refresh"
          type="button"
          onClick={() => void loadStats()}
          disabled={loadingStats}
          aria-label="Atualizar estatísticas"
          title="Atualizar estatísticas"
        >
          <RefreshCcw size={16} />
        </button>
      </header>

      <div className="champ-stats-summary" aria-label="Resumo da classificação">
        <span><strong>{teamStats.length}</strong><small>equipes</small></span>
        <span><strong>{totalDrops}</strong><small>quedas</small></span>
        <span><strong>{leader?.pontos_total ?? 0}</strong><small>pts líder</small></span>
        <span><strong>{mvpLeader?.abates ?? 0}</strong><small>kills MVP</small></span>
      </div>

      <nav className="champ-stats-tabs" aria-label="Seções de estatísticas">
        {championSummary?.final_concluida && championSummary.campeao ? (
          <button className={tab === 'campeao' ? 'active' : ''} type="button" onClick={() => setTab('campeao')}>
            Campeão
          </button>
        ) : null}
        <button className={tab === 'geral' ? 'active' : ''} type="button" onClick={() => setTab('geral')}>
          Classificação
        </button>
        <button className={tab === 'mvp' ? 'active' : ''} type="button" onClick={() => setTab('mvp')}>
          MVP
        </button>
        <button className={tab === 'pontuador' ? 'active' : ''} type="button" onClick={() => setTab('pontuador')}>
          Pontuador
        </button>
      </nav>

      {tab !== 'pontuador' && tab !== 'campeao' ? (
        <details className="champ-stats-filters">
          <summary>
            <span>Filtros</span>
            <small>{Object.values(filters).filter(Boolean).length ? `${Object.values(filters).filter(Boolean).length} ativos` : 'Todos os dados'}</small>
          </summary>
          <div className="champ-stats-filter-grid">
            <select value={filters.fase_id} onChange={(event) => setFilters({ ...filters, fase_id: event.target.value, rodada_id: '', jogo_id: '', partida_id: '', grupo_id: '' })}>
              <option value="">Todas as fases</option>{props.phases.map((phase) => <option key={phase.id} value={phase.id}>{String(phase.data?.nome || phase.name || 'Fase')}</option>)}
            </select>
            <select value={filters.grupo_id} onChange={(event) => setFilters({ ...filters, grupo_id: event.target.value })}>
              <option value="">Todos os grupos</option>{props.groups.filter((group) => !filters.fase_id || group.data?.fase_id === filters.fase_id).map((group) => <option key={group.id} value={group.id}>{String(group.data?.nome || group.name || 'Grupo')}</option>)}
            </select>
            <select value={filters.rodada_id} onChange={(event) => setFilters({ ...filters, rodada_id: event.target.value, jogo_id: '', partida_id: '' })}>
              <option value="">Todas as rodadas</option>{rounds.map((round) => <option key={round.id} value={round.id}>{round.nome}</option>)}
            </select>
            <select value={filters.jogo_id} onChange={(event) => setFilters({ ...filters, jogo_id: event.target.value, partida_id: '' })}>
              <option value="">Todos os jogos</option>{props.games.filter((game) => selectedGameIds.has(game.id)).map((game) => <option key={game.id} value={game.id}>{String(game.data?.nome || game.name || 'Jogo')}</option>)}
            </select>
            <select value={filters.partida_id} onChange={(event) => setFilters({ ...filters, partida_id: event.target.value })}>
              <option value="">Todas as quedas</option>{filteredPartidas.map((partida) => <option key={partida.id} value={partida.id}>Queda {partida.numero_partida} · {partida.mapa_nome || partida.mapa || 'Mapa'}</option>)}
            </select>
            <select value={filters.mapa_codigo} onChange={(event) => setFilters({ ...filters, mapa_codigo: event.target.value })}>
              <option value="">Todos os mapas</option>{props.maps.map((map) => <option key={map.codigo} value={map.codigo}>{map.nome}</option>)}
            </select>
          </div>
        </details>
      ) : null}

      {error ? <div className="champ-stats-message is-error">{error}</div> : null}
      {notice ? <div className="champ-stats-message is-success">{notice}</div> : null}
      {loadingStats && tab !== 'pontuador' ? <div className="champ-stats-loading"><Loader2 className="button-spinner" size={16} /> Atualizando...</div> : null}

      {tab === 'campeao' && !loadingStats && championSummary?.campeao ? (
        <section className="champ-stats-champion">
          <div className="champ-stats-champion-main">
            <span className="champ-stats-champion-position">1</span>
            <span className="champ-stats-champion-logo">
              {championSummary.campeao.logo_url ? <img src={championSummary.campeao.logo_url} alt="" /> : <strong>{championSummary.campeao.nome.slice(0, 2).toUpperCase()}</strong>}
            </span>
            <div>
              <small>Campeão</small>
              <h3>{championSummary.campeao.nome}</h3>
              {championSummary.campeao.tag ? <span>{championSummary.campeao.tag}</span> : null}
            </div>
          </div>
          <div className="champ-stats-champion-numbers">
            <span><strong>{championSummary.campeao.pontos_total}</strong><small>pontos</small></span>
            <span><strong>{championSummary.campeao.booyahs}</strong><small>booyahs</small></span>
            <span><strong>{championSummary.campeao.abates}</strong><small>kills</small></span>
            <span><strong>{championSummary.resumo?.quedas || championSummary.campeao.quedas}</strong><small>quedas</small></span>
          </div>
          {championSummary.jogadores.length ? (
            <div className="champ-stats-lineup">
              {championSummary.jogadores.map((player) => (
                <article key={player.campeonato_jogador_id}>
                  {player.foto_url ? <img src={player.foto_url} alt="" /> : <span>{player.nick.slice(0, 1)}</span>}
                  <div><strong>{player.nick}</strong><small>{player.abates} kills</small></div>
                </article>
              ))}
            </div>
          ) : null}
          <div className="champ-stats-actions">
            <button type="button" onClick={() => setTab('geral')}>Ver classificação</button>
            <button type="button" onClick={() => setTab('mvp')}>Ver MVP</button>
          </div>
        </section>
      ) : null}

      {tab === 'geral' && !loadingStats ? (
        <>
          <div className="champ-stats-ranking" role="table" aria-label="Classificação geral">
            <div className="champ-stats-ranking-head" role="row">
              <span>#</span><span>Equipe</span><span>QD</span><span>B!</span><span>K</span><span>PTS</span>
            </div>
            {teamStats.map((row) => (
              <article className={`champ-stats-ranking-row${row.colocacao <= 3 ? ' is-podium' : ''}`} key={row.campeonato_equipe_id} role="row">
                <div className="champ-stats-rank">
                  <strong>{row.colocacao}</strong>
                  <VariationCell value={row.variacao} />
                </div>
                <div className="champ-stats-team">
                  {row.logo_url ? <img src={row.logo_url} alt="" /> : <span>{row.nome.slice(0, 1)}</span>}
                  <div><strong>{row.nome}</strong><small>{row.tag || `Grupo ${groupCode(row.grupo_id, props.groups)}`}</small></div>
                </div>
                <span>{row.quedas}</span>
                <span>{row.booyahs}</span>
                <span>{row.abates}</span>
                <strong className="champ-stats-points">{row.pontos_total}</strong>
              </article>
            ))}
            {teamStats.length === 0 ? <p className="champ-stats-empty">Nenhuma pontuação registrada.</p> : null}
          </div>

          <details className="champ-stats-share">
            <summary>Compartilhar resultado</summary>
            <ResultadoWhatsappCard
              campeonatoId={props.campeonatoId}
              campeonatoNome={props.campeonatoNome || 'Campeonato DropZone'}
              campeonatoLogo={props.campeonatoLogo}
              recorte={shareScope}
              ranking={teamStats}
            />
          </details>
        </>
      ) : null}

      {tab === 'mvp' && !loadingStats ? (
        <div className="champ-stats-mvp-list">
          {mvpStats.map((row) => (
            <article className={row.colocacao <= 3 ? 'is-podium' : ''} key={row.campeonato_jogador_id}>
              <div className="champ-stats-rank">
                <strong>{row.colocacao}</strong>
                <VariationCell value={row.variacao} />
              </div>
              <div className="champ-stats-player">
                {row.foto_url ? <img src={row.foto_url} alt="" /> : <span>{row.nick.slice(0, 1)}</span>}
                <div><strong>{row.nick}</strong><small>{row.id_jogo ? `ID ${row.id_jogo}` : row.tipo_jogador}</small></div>
              </div>
              <span><strong>{row.quedas}</strong><small>QD</small></span>
              <span><strong>{kdValue(row.abates, row.quedas)}</strong><small>K.D</small></span>
              <span className="champ-stats-mvp-kills"><strong>{row.abates}</strong><small>KILLS</small></span>
            </article>
          ))}
          {mvpStats.length === 0 ? <p className="champ-stats-empty">Nenhuma estatística de jogador registrada.</p> : null}
        </div>
      ) : null}

      {tab === 'pontuador' ? (
        <section className="champ-stats-scorer">
          <header>
            <div><small>Pontuador</small><h3>Selecione o jogo</h3></div>
            <p>A pontuação abre em uma tela dedicada com slots, quedas, MVP e MatchResult.</p>
          </header>

          <div className="champ-stats-scorer-fields">
            <label>
              <span>Fase</span>
              <select value={filters.fase_id} onChange={(event) => setFilters({ ...filters, fase_id: event.target.value, jogo_id: '' })}>
                <option value="">Selecione a fase</option>
                {props.phases.map((phase) => <option key={phase.id} value={phase.id}>{String(phase.data?.nome || phase.name || 'Fase')}</option>)}
              </select>
            </label>
            <label>
              <span>Jogo</span>
              <select value={filters.jogo_id} onChange={(event) => setFilters({ ...filters, jogo_id: event.target.value })} disabled={!filters.fase_id}>
                <option value="">Selecione o jogo</option>
                {props.games.filter((game) => game.data?.fase_id === filters.fase_id).map((game) => <option key={game.id} value={game.id}>{String(game.data?.nome || game.name || 'Jogo')}</option>)}
              </select>
            </label>
          </div>

          {filters.fase_id ? (
            <div className="champ-stats-scorer-games">
              {props.games.filter((game) => game.data?.fase_id === filters.fase_id).map((game) => (
                <button
                  type="button"
                  key={game.id}
                  className={filters.jogo_id === game.id ? 'selected' : ''}
                  onClick={() => setFilters({ ...filters, jogo_id: game.id })}
                >
                  <span><strong>{String(game.data?.nome || game.name || 'Jogo')}</strong><small>{Number(game.data?.numero_partidas || 0)} quedas</small></span>
                  <span>{filters.jogo_id === game.id ? 'Selecionado' : 'Selecionar'}</span>
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="champ-stats-open-scorer"
            disabled={!filters.fase_id || !filters.jogo_id}
            onClick={() => window.open(`/campeonatos/${props.campeonatoId}/pontuador/${filters.jogo_id}`, '_blank', 'noopener,noreferrer')}
          >
            Abrir pontuador
          </button>
        </section>
      ) : null}
    </section>
  )
}
