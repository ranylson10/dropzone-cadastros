'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Gamepad2, Loader2, Shield, Swords, Target, Users } from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import { dataText, rowTitle } from '../../utils'
import { ProfileEditForm } from '@/components/forms/ProfileEditForm'
import { PlayerTeamRequest } from '@/components/equipes/PlayerTeamRequest'
import { supabase } from '@/lib/supabase-browser'

type PlayerTelemetry = {
  abates: number
  assistencias: number
  dano: number
  headshots: number
  knockdowns: number
  sobrevivencia_segundos: number
  precisao_percentual: number
  taxa_headshot_kill_percentual: number
  precisao_headshot_percentual: number
  revives: number
  distancia_movida: number
  distancia_max_abate: number
  granadas_usadas: number
  abates_granada: number
  dano_granada: number
  gel_usado: number
  gel_destruido: number
  kits_medicos: number
  armas: Array<{ arma: string; abates: number; dano: number; headshots: number; precisao_percentual: number }>
  habilidades: Array<{ tipo: string; personagem: string; habilidade: string; usos: number }>
}

type PlayerMatch = {
  campeonato_id: string
  campeonato?: { nome?: string; tipo?: string } | null
  partida_id?: string | null
  numero_partida?: number | null
  mapa_codigo?: string | null
  mapa_nome?: string | null
  abates: number
  dano: number
  assistencias: number
  revives: number
  posicao?: number | null
  booyah?: boolean
  telemetria?: PlayerTelemetry | null
}

type PlayerPerformance = {
  statistics: { partidas: number; abates: number; dano: number; assistencias: number; revives: number; booyahs: number }
  statisticsByChampionship: Array<any>
  matchHistory: PlayerMatch[]
}

type TrendPoint = { label: string; value: number | null }

function TrendChart(props: { title: string; subtitle: string; points: TrendPoint[]; format: (value: number) => string; lowerIsBetter?: boolean }) {
  const available = props.points.filter((point): point is { label: string; value: number } => point.value !== null && Number.isFinite(point.value))
  if (available.length < 2) {
    return <article className="team-training-chart is-empty"><div><strong>{props.title}</strong><small>{props.subtitle}</small></div><span>Dados insuficientes</span></article>
  }
  const values = available.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = Math.max(1, max - min)
  const width = 320
  const height = 96
  const padX = 8
  const padY = 10
  const coords = available.map((point, index) => {
    const x = padX + (index / Math.max(1, available.length - 1)) * (width - padX * 2)
    const normalized = (point.value - min) / spread
    const y = padY + (props.lowerIsBetter ? normalized : 1 - normalized) * (height - padY * 2)
    return { ...point, x, y }
  })
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const latest = available[available.length - 1]
  return (
    <article className="team-training-chart">
      <div className="team-training-chart-head"><span><strong>{props.title}</strong><small>{props.subtitle}</small></span><b>{props.format(latest.value)}</b></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${props.title} por queda`}>
        <path className="team-training-chart-line" d={path} />
        {coords.map((point) => <circle key={`${point.label}:${point.x}`} className="team-training-chart-point" cx={point.x} cy={point.y} r="3" />)}
      </svg>
      <div className="team-training-chart-labels">{available.map((point) => <span key={point.label}>{point.label}</span>)}</div>
    </article>
  )
}

function formatSurvival(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

export function JogadorPanel(props: {
  account: DropZoneRow
  registrations: DropZoneRow[]
  playerTeams: DropZoneRow[]
  teams: DropZoneRow[]
  teamLines: DropZoneRow[]
}) {
  const memberships = props.playerTeams.filter(
    (row) => row.created_by === props.account.auth_user_id || String(row.data?.jogador_id || '') === props.account.id,
  )
  const teamIds = new Set(memberships.map((row) => String(row.ref_id || row.data?.team_id || '')))
  const myTeams = props.teams.filter((team) => teamIds.has(team.id))
  const myLines = props.teamLines.filter((line) => teamIds.has(String(line.ref_id || line.data?.team_id || '')))
  const [tab, setTab] = useState<'resumo' | 'desempenho' | 'perfil'>('resumo')
  const [performance, setPerformance] = useState<PlayerPerformance | null>(null)
  const [performanceLoading, setPerformanceLoading] = useState(false)
  const [performanceError, setPerformanceError] = useState('')
  const [championshipFilter, setChampionshipFilter] = useState('todos')

  useEffect(() => {
    if (tab === 'desempenho' && !performance && !performanceLoading) void loadPerformance()
  }, [tab])

  async function loadPerformance() {
    setPerformanceLoading(true)
    setPerformanceError('')
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('Sessão expirada. Entre novamente.')
      const response = await fetch(`/api/lili/jogadores?id=${encodeURIComponent(props.account.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Não foi possível carregar seu desempenho.')
      setPerformance(json.overview || null)
    } catch (error: any) {
      setPerformanceError(error?.message || 'Não foi possível carregar seu desempenho.')
    } finally {
      setPerformanceLoading(false)
    }
  }

  const filteredMatches = useMemo(() => {
    const rows = performance?.matchHistory || []
    return championshipFilter === 'todos' ? rows : rows.filter((row) => String(row.campeonato_id) === championshipFilter)
  }, [performance, championshipFilter])

  const chronologicalMatches = useMemo(() => [...filteredMatches].reverse(), [filteredMatches])

  const analytics = useMemo(() => {
    const mapGroups = new Map<string, PlayerMatch[]>()
    const weaponGroups = new Map<string, { usos: number; abates: number; dano: number; precisao: number; amostrasPrecisao: number }>()
    const skillGroups = new Map<string, { usos: number; partidas: number; personagem: string; habilidade: string }>()
    let survivalTotal = 0
    let survivalSamples = 0
    let precisionTotal = 0
    let precisionSamples = 0
    let headshots = 0
    let knockdowns = 0

    for (const match of filteredMatches) {
      const map = String(match.mapa_nome || match.mapa_codigo || 'Mapa não definido')
      mapGroups.set(map, [...(mapGroups.get(map) || []), match])
      const telemetry = match.telemetria
      if (!telemetry) continue
      if (Number(telemetry.sobrevivencia_segundos || 0) > 0) { survivalTotal += Number(telemetry.sobrevivencia_segundos); survivalSamples += 1 }
      if (Number(telemetry.precisao_percentual || 0) > 0) { precisionTotal += Number(telemetry.precisao_percentual); precisionSamples += 1 }
      headshots += Number(telemetry.headshots || 0)
      knockdowns += Number(telemetry.knockdowns || 0)
      for (const weapon of telemetry.armas || []) {
        const name = String(weapon.arma || 'Arma não identificada')
        const current = weaponGroups.get(name) || { usos: 0, abates: 0, dano: 0, precisao: 0, amostrasPrecisao: 0 }
        current.usos += 1
        current.abates += Number(weapon.abates || 0)
        current.dano += Number(weapon.dano || 0)
        if (Number(weapon.precisao_percentual || 0) > 0) { current.precisao += Number(weapon.precisao_percentual); current.amostrasPrecisao += 1 }
        weaponGroups.set(name, current)
      }
      for (const skill of telemetry.habilidades || []) {
        const personagem = String(skill.personagem || '')
        const habilidade = String(skill.habilidade || 'Habilidade')
        const key = `${personagem}:${habilidade}`
        const current = skillGroups.get(key) || { usos: 0, partidas: 0, personagem, habilidade }
        current.usos += Number(skill.usos || 0)
        current.partidas += 1
        skillGroups.set(key, current)
      }
    }

    const maps = [...mapGroups.entries()].map(([nome, rows]) => ({
      nome,
      partidas: rows.length,
      abates_media: rows.reduce((sum, row) => sum + Number(row.abates || 0), 0) / rows.length,
      dano_media: rows.reduce((sum, row) => sum + Number(row.dano || 0), 0) / rows.length,
      colocacao_media: (() => {
        const positions = rows.map((row) => Number(row.posicao || 0)).filter((value) => value > 0)
        return positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : null
      })(),
    })).sort((a, b) => (a.colocacao_media ?? 99) - (b.colocacao_media ?? 99) || b.abates_media - a.abates_media)

    const weapons = [...weaponGroups.entries()].map(([nome, row]) => ({
      nome,
      ...row,
      precisao_media: row.amostrasPrecisao ? row.precisao / row.amostrasPrecisao : null,
    })).sort((a, b) => b.abates - a.abates || b.dano - a.dano).slice(0, 8)

    const skills = [...skillGroups.values()].sort((a, b) => b.partidas - a.partidas || b.usos - a.usos).slice(0, 8)

    return {
      maps,
      weapons,
      skills,
      sobrevivencia_media: survivalSamples ? survivalTotal / survivalSamples : null,
      precisao_media: precisionSamples ? precisionTotal / precisionSamples : null,
      headshots,
      knockdowns,
    }
  }, [filteredMatches])

  const totals = useMemo(() => filteredMatches.reduce((sum, row) => ({
    partidas: sum.partidas + 1,
    abates: sum.abates + Number(row.abates || 0),
    dano: sum.dano + Number(row.dano || 0),
    assistencias: sum.assistencias + Number(row.assistencias || 0),
    revives: sum.revives + Number(row.revives || 0),
    booyahs: sum.booyahs + (row.booyah ? 1 : 0),
  }), { partidas: 0, abates: 0, dano: 0, assistencias: 0, revives: 0, booyahs: 0 }), [filteredMatches])

  const championshipOptions = performance?.statisticsByChampionship || []

  return (
    <div className="dashboard player-dashboard">
      <section className="panel span-3">
        <div className="section-head">
          <div><p className="eyebrow">Jogador</p><h2>Meu painel</h2></div>
          <Gamepad2 />
        </div>
        <div className="producer-tabs manager-champ-tabs" style={{ marginBottom: 12 }}>
          <button type="button" className={tab === 'resumo' ? 'active' : ''} onClick={() => setTab('resumo')}>Resumo</button>
          <button type="button" className={tab === 'desempenho' ? 'active' : ''} onClick={() => setTab('desempenho')}>Desempenho</button>
          <button type="button" className={tab === 'perfil' ? 'active' : ''} onClick={() => setTab('perfil')}>Perfil</button>
        </div>

        {tab === 'perfil' ? (
          <ProfileEditForm profileType="jogador" profileId={props.account.id} initial={{
            nome: props.account.name || '', avatar_url: dataText(props.account, 'avatar_url') || dataText(props.account, 'foto_url'),
            bio: dataText(props.account, 'bio'), id_jogo: dataText(props.account, 'id_jogo'), funcao: dataText(props.account, 'funcao'),
          }} />
        ) : null}

        {tab === 'resumo' ? (
          <div className="player-summary-grid">
            <div><Shield size={18} /><strong>{myTeams.length}</strong><span>Equipes</span></div>
            <div><Users size={18} /><strong>{myLines.length}</strong><span>Lines</span></div>
            <div><Swords size={18} /><strong>{props.registrations.length}</strong><span>Campeonatos</span></div>
            <div><BarChart3 size={18} /><strong>{performance?.statistics?.partidas || 0}</strong><span>Partidas pontuadas</span></div>
          </div>
        ) : null}

        {tab === 'desempenho' ? (
          <div className="player-performance">
            {performanceLoading ? <p className="empty"><Loader2 className="spin" size={16} /> Carregando desempenho...</p> : null}
            {performanceError ? <div className="message error">{performanceError}</div> : null}
            {!performanceLoading && !performanceError && performance ? (
              <>
                <div className="player-performance-head">
                  <div><p className="eyebrow">Privado</p><h3>Meu desempenho</h3><small>Telemetria e histórico visíveis somente no seu perfil de jogador.</small></div>
                  <label><span>Campeonato</span><select value={championshipFilter} onChange={(event) => setChampionshipFilter(event.target.value)}><option value="todos">Todos</option>{championshipOptions.map((row: any) => <option key={row.campeonato_id} value={row.campeonato_id}>{row.campeonato?.nome || 'Campeonato'}</option>)}</select></label>
                </div>

                <div className="player-performance-metrics">
                  <span><b>{totals.partidas}</b><small>partidas</small></span>
                  <span><b>{totals.abates}</b><small>kills</small></span>
                  <span><b>{Math.round(totals.dano).toLocaleString('pt-BR')}</b><small>dano</small></span>
                  <span><b>{totals.assistencias}</b><small>assistências</small></span>
                  <span><b>{analytics.precisao_media === null ? '—' : `${analytics.precisao_media.toFixed(1)}%`}</b><small>precisão</small></span>
                  <span><b>{formatSurvival(analytics.sobrevivencia_media || 0)}</b><small>sobrevivência</small></span>
                </div>

                <div className="team-training-chart-grid player-performance-charts">
                  <TrendChart title="Kills" subtitle="evolução por partida" points={chronologicalMatches.map((row, index) => ({ label: `Q${row.numero_partida || index + 1}`, value: row.abates }))} format={(value) => String(Math.round(value))} />
                  <TrendChart title="Dano" subtitle="evolução por partida" points={chronologicalMatches.map((row, index) => ({ label: `Q${row.numero_partida || index + 1}`, value: row.dano }))} format={(value) => Math.round(value).toLocaleString('pt-BR')} />
                  <TrendChart title="Sobrevivência" subtitle="tempo vivo por partida" points={chronologicalMatches.map((row, index) => ({ label: `Q${row.numero_partida || index + 1}`, value: row.telemetria?.sobrevivencia_segundos || null }))} format={formatSurvival} />
                  <TrendChart title="Colocação" subtitle="resultado da equipe" points={chronologicalMatches.map((row, index) => ({ label: `Q${row.numero_partida || index + 1}`, value: row.posicao || null }))} format={(value) => `${Math.round(value)}º`} lowerIsBetter />
                </div>

                <div className="player-performance-sections">
                  <section><div className="player-performance-section-head"><Target size={16} /><span><strong>Leitura técnica</strong><small>telemetria Garena</small></span></div><div className="player-performance-tech"><span><b>{analytics.headshots}</b><small>headshots</small></span><span><b>{analytics.knockdowns}</b><small>knockdowns</small></span><span><b>{totals.revives}</b><small>revives</small></span><span><b>{totals.booyahs}</b><small>booyahs</small></span></div></section>

                  <section><div className="player-performance-section-head"><Activity size={16} /><span><strong>Por mapa</strong><small>médias do jogador</small></span></div><div className="player-performance-list">{analytics.maps.length ? analytics.maps.map((map) => <div key={map.nome}><strong>{map.nome}</strong><span>{map.partidas} partidas</span><b>{map.abates_media.toFixed(1)} K</b><small>{Math.round(map.dano_media).toLocaleString('pt-BR')} dano · {map.colocacao_media === null ? '—' : `${map.colocacao_media.toFixed(1)} pos.`}</small></div>) : <p className="empty">Sem partidas por mapa ainda.</p>}</div></section>

                  <section><div className="player-performance-section-head"><Swords size={16} /><span><strong>Armas</strong><small>mais eficientes no histórico filtrado</small></span></div><div className="player-performance-list">{analytics.weapons.length ? analytics.weapons.map((weapon) => <div key={weapon.nome}><strong>{weapon.nome}</strong><span>{weapon.usos} partidas</span><b>{weapon.abates} K</b><small>{Math.round(weapon.dano).toLocaleString('pt-BR')} dano · {weapon.precisao_media === null ? '—' : `${weapon.precisao_media.toFixed(1)}% precisão`}</small></div>) : <p className="empty">Sem telemetria de armas ainda.</p>}</div></section>

                  <section><div className="player-performance-section-head"><Gamepad2 size={16} /><span><strong>Habilidades</strong><small>uso no histórico filtrado</small></span></div><div className="player-performance-list">{analytics.skills.length ? analytics.skills.map((skill) => <div key={`${skill.personagem}:${skill.habilidade}`}><strong>{skill.habilidade}</strong><span>{skill.personagem || 'Personagem'}</span><b>{skill.partidas}</b><small>partidas · {skill.usos} usos registrados</small></div>) : <p className="empty">Sem telemetria de habilidades ainda.</p>}</div></section>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {tab === 'resumo' ? <>
        <section className="panel span-2"><h2>Campeonatos inscritos</h2><div className="cards">{props.registrations.length === 0 ? <p className="empty">Você ainda não está inscrito em campeonato.</p> : null}{props.registrations.map((row) => <div className="card" key={row.id}><p>{String(row.data?.team_tag || 'Equipe')}</p><strong>{String(row.data?.championship_name || 'Campeonato')}</strong><span>{String(row.data?.team_name || '')}</span></div>)}</div></section>
        <section className="panel"><h2>Minha equipe</h2>{myTeams.length === 0 ? <p className="empty">Você ainda não faz parte de uma equipe.</p> : null}<div className="team-line-grid">{myTeams.map((team) => <article className="team-line-card" key={team.id}><img src={dataText(team, 'logo_url') || '/favicon.ico'} alt="" /><div><strong>{rowTitle(team)}</strong><span>{dataText(team, 'tag') || 'Sem tag'}</span></div></article>)}</div><PlayerTeamRequest mode="request_join"/></section>
        <section className="panel"><h2>Minhas lines</h2>{myLines.length === 0 ? <p className="empty">Nenhuma line vinculada ao seu elenco.</p> : null}<div className="team-line-grid">{myLines.map((line) => <article className="team-line-card" key={line.id}><img src={dataText(line, 'logo_url') || '/favicon.ico'} alt="" /><div><strong>{rowTitle(line)}</strong><span>{dataText(line, 'tag') || 'Sem tag'}</span></div></article>)}</div></section>
      </> : null}
    </div>
  )
}
