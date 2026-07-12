'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileUp, Loader2, Medal, RefreshCcw, Save, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'

type InnerTab = 'geral' | 'mvp' | 'pontuador'
type ScoringMode = 'manual' | 'matchresult'

type TeamStat = {
  colocacao: number
  campeonato_equipe_id: string
  nome: string
  tag?: string | null
  logo_url?: string | null
  quedas: number
  booyahs: number
  abates: number
  pontos_posicao: number
  pontos_abates: number
  pontos_total: number
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
  dano: number
  assistencias: number
  revives: number
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

function queryString(filters: Filters) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => value && query.set(key, value))
  return query.toString()
}

export function CampeonatoEstatisticasTab(props: {
  campeonatoId: string
  phases: DropZoneRow[]
  groups: DropZoneRow[]
  games: DropZoneRow[]
  maps: Array<{ codigo: string; nome: string }>
}) {
  const [tab, setTab] = useState<InnerTab>('geral')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [teamStats, setTeamStats] = useState<TeamStat[]>([])
  const [mvpStats, setMvpStats] = useState<MvpStat[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState('')

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
      const [teamsResult, mvpResult] = await Promise.all([
        request<{ equipes: TeamStat[] }>(`/api/campeonatos/${props.campeonatoId}/estatisticas/equipes${suffix}`),
        request<{ jogadores: MvpStat[] }>(`/api/campeonatos/${props.campeonatoId}/estatisticas/mvp${suffix}`),
      ])
      setTeamStats(teamsResult.equipes || [])
      setMvpStats(mvpResult.jogadores || [])
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

  return (
    <div className="statistics-tab-shell">
      <div className="subtab-actionbar statistics-heading">
        <div><p className="eyebrow">Pontuação do campeonato</p><h3>Estatísticas</h3></div>
        <button className="button secondary" onClick={() => void loadStats()} disabled={loadingStats}><RefreshCcw size={15} /> Atualizar</button>
      </div>

      <nav className="statistics-inner-tabs">
        <button className={tab === 'geral' ? 'active' : ''} onClick={() => setTab('geral')}><Trophy size={16} /> Tabela geral</button>
        <button className={tab === 'mvp' ? 'active' : ''} onClick={() => setTab('mvp')}><Medal size={16} /> MVP</button>
        <button className={tab === 'pontuador' ? 'active' : ''} onClick={() => setTab('pontuador')}><Save size={16} /> Pontuador</button>
      </nav>

      {tab !== 'pontuador' ? (
        <div className="statistics-filters">
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
      ) : null}

      {error ? <div className="statistics-message error">{error}</div> : null}
      {notice ? <div className="statistics-message success">{notice}</div> : null}
      {loadingStats && tab !== 'pontuador' ? <div className="statistics-loading"><Loader2 className="button-spinner" /> Carregando estatísticas...</div> : null}

      {tab === 'geral' && !loadingStats ? (
        <div className="statistics-table-wrap"><table className="statistics-table"><thead><tr><th>#</th><th>Equipe</th><th>Quedas</th><th>Booyahs</th><th>Abates</th><th>P. posição</th><th>P. abates</th><th>Total</th></tr></thead><tbody>
          {teamStats.map((row) => <tr key={row.campeonato_equipe_id}><td><strong>{row.colocacao}</strong></td><td><div className="statistics-identity">{row.logo_url ? <img src={row.logo_url} alt="" /> : <span className="statistics-avatar-fallback">{row.nome.slice(0, 1)}</span>}<span><strong>{row.nome}</strong>{row.tag ? <small>{row.tag}</small> : null}</span></div></td><td>{row.quedas}</td><td>{row.booyahs}</td><td>{row.abates}</td><td>{row.pontos_posicao}</td><td>{row.pontos_abates}</td><td className="statistics-total">{row.pontos_total}</td></tr>)}
          {teamStats.length === 0 ? <tr><td colSpan={8} className="empty">Nenhuma pontuação registrada.</td></tr> : null}
        </tbody></table></div>
      ) : null}

      {tab === 'mvp' && !loadingStats ? (
        <div className="statistics-table-wrap"><table className="statistics-table"><thead><tr><th>#</th><th>Jogador</th><th>Tipo</th><th>Quedas</th><th>Abates</th><th>Dano</th><th>Assist.</th><th>Revives</th></tr></thead><tbody>
          {mvpStats.map((row) => <tr key={row.campeonato_jogador_id}><td><strong>{row.colocacao}</strong></td><td><div className="statistics-identity">{row.foto_url ? <img src={row.foto_url} alt="" /> : <span className="statistics-avatar-fallback">{row.nick.slice(0, 1)}</span>}<span><strong>{row.nick}</strong>{row.id_jogo ? <small>ID {row.id_jogo}</small> : null}</span></div></td><td><span className={`player-type-badge ${row.tipo_jogador}`}>{row.tipo_jogador}</span></td><td>{row.quedas}</td><td className="statistics-total">{row.abates}</td><td>{row.dano}</td><td>{row.assistencias}</td><td>{row.revives}</td></tr>)}
          {mvpStats.length === 0 ? <tr><td colSpan={8} className="empty">Nenhuma estatística de jogador registrada.</td></tr> : null}
        </tbody></table></div>
      ) : null}

      {tab === 'pontuador' ? (
        <div className="scorer-launcher">
          <div className="scorer-launcher-copy">
            <p className="eyebrow">Pontuador em tela cheia</p>
            <h4>Selecione a fase e o jogo</h4>
            <p>O pontuador será aberto em outra aba com todos os slots, quedas, classificação do jogo, MVP e vínculos do MatchResult.</p>
          </div>

          <div className="scorer-launcher-fields">
            <label>
              <span>Fase</span>
              <select
                value={filters.fase_id}
                onChange={(event) => setFilters({ ...filters, fase_id: event.target.value, jogo_id: '' })}
              >
                <option value="">Selecione a fase</option>
                {props.phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {String(phase.data?.nome || phase.name || 'Fase')}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Jogo</span>
              <select
                value={filters.jogo_id}
                onChange={(event) => setFilters({ ...filters, jogo_id: event.target.value })}
                disabled={!filters.fase_id}
              >
                <option value="">Selecione o jogo</option>
                {props.games
                  .filter((game) => game.data?.fase_id === filters.fase_id)
                  .map((game) => (
                    <option key={game.id} value={game.id}>
                      {String(game.data?.nome || game.name || 'Jogo')}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="scorer-launcher-list">
            {filters.fase_id ? props.games
              .filter((game) => game.data?.fase_id === filters.fase_id)
              .map((game) => {
                const selected = filters.jogo_id === game.id
                return (
                  <button
                    type="button"
                    key={game.id}
                    className={selected ? 'selected' : ''}
                    onClick={() => setFilters({ ...filters, jogo_id: game.id })}
                  >
                    <span>
                      <strong>{String(game.data?.nome || game.name || 'Jogo')}</strong>
                      <small>{Number(game.data?.numero_partidas || 0)} quedas</small>
                    </span>
                    <span>{selected ? 'Selecionado' : 'Selecionar'}</span>
                  </button>
                )
              }) : <p className="empty">Selecione uma fase para listar os jogos.</p>}
          </div>

          <button
            type="button"
            className="button scorer-open-button"
            disabled={!filters.fase_id || !filters.jogo_id}
            onClick={() => window.open(`/campeonatos/${props.campeonatoId}/pontuador/${filters.jogo_id}`, '_blank', 'noopener,noreferrer')}
          >
            Abrir pontuador em tela cheia
          </button>
        </div>
      ) : null}
    </div>
  )
}
