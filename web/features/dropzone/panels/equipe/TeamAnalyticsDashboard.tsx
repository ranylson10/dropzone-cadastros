'use client'

import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, ChevronRight, CircleDollarSign, Crosshair, Loader2, MapPinned, RefreshCw, Target, Trophy, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

type DashboardPeriod = 'today' | '7d' | '30d' | 'month' | 'year' | 'all'

type DashboardMapMetric = {
  codigo: string
  nome: string
  quedas: number
  pontos_media: number | null
  abates_media: number | null
  colocacao_media: number | null
  booyahs: number
  top5_percentual: number | null
}

type DashboardPlayerMetric = {
  id: string
  nick: string
  id_jogo?: string | null
  foto_url?: string | null
  line_id?: string | null
  line_nome?: string | null
  quedas: number
  abates: number
  abates_media: number | null
  dano: number
  dano_media: number | null
  assistencias: number
  revives: number
}

type DashboardLineMetric = {
  id: string
  nome: string
  tag?: string | null
  logo_url?: string | null
  quedas: number
  pontos_total: number | null
  pontos_media: number | null
  abates: number
  abates_media: number | null
  booyahs: number
  colocacao_media: number | null
  top5_percentual: number | null
}

type DashboardData = {
  equipe: { id: string; nome: string; tag?: string | null; logo_url?: string | null }
  filtro: { periodo: DashboardPeriod; evento_id?: string | null; line_id?: string | null; mapa?: string | null }
  opcoes: {
    eventos: Array<{ id: string; nome: string; tipo?: string | null; status?: string | null }>
    lines: Array<{ id: string; nome: string; tag?: string | null; logo_url?: string | null }>
    mapas: Array<{ codigo: string; nome: string }>
  }
  participacoes: { hoje: number; mes: number; ano: number; total: number }
  kpis: {
    campeonatos_disputados: number
    quedas: number
    booyahs: number
    abates: number
    pontos_total: number | null
    pontos_media: number | null
    colocacao_media: number | null
    top3_percentual: number | null
    top5_percentual: number | null
    premio_em_disputa: number | null
    campeonatos_com_premiacao_ativa: number
  }
  premios: {
    em_disputa: number
    eventos: Array<{ campeonato_id: string; nome: string; valor: number; descricao?: string | null }>
  }
  evolucao: Array<{
    chave: string
    label: string
    quedas: number
    pontos: number | null
    pontos_media: number | null
    abates: number
    colocacao_media: number | null
    booyahs: number
  }>
  mapas: DashboardMapMetric[]
  eventos: Array<{
    id: string
    nome: string
    tipo?: string | null
    status?: string | null
    logo_url?: string | null
    quedas: number
    pontos_total: number | null
    pontos_media: number | null
    abates: number
    booyahs: number
    colocacao_media: number | null
    premiacao: number
  }>
  jogadores: DashboardPlayerMetric[]
  lines: DashboardLineMetric[]
  insights: {
    melhor_mapa?: DashboardMapMetric | null
    mapa_atencao?: DashboardMapMetric | null
    line_destaque?: DashboardLineMetric | null
    jogador_destaque?: DashboardPlayerMetric | null
    tendencia?: { percentual: number; direcao: 'alta' | 'queda' | 'estavel'; atual: number; anterior: number } | null
  }
  meta: { resultados_considerados: number; jogadores_com_resultado: number; atualizado_em: string }
}

type NextGame = {
  campeonato_equipe_id?: string | null
  campeonato_nome?: string | null
  line_nome?: string | null
  grupo_nome?: string | null
  data_jogo?: string | null
  horario?: string | null
} | null

const periodLabels: Record<DashboardPeriod, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
  month: 'Mês atual',
  year: 'Ano atual',
  all: 'Todo histórico',
}

function numberText(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function currencyText(value: number | null | undefined) {
  if (!value || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function positionText(value: number | null | undefined) {
  if (!value || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}º`
}

function percentText(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function MiniProgress({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(3, Math.min(100, (value / max) * 100)) : 0
  return <span className="team-analytics-progress"><i style={{ width: `${width}%` }} /></span>
}

function EvolutionChart({ rows }: { rows: DashboardData['evolucao'] }) {
  const width = 720
  const height = 250
  const padX = 34
  const padTop = 20
  const padBottom = 40
  const chartHeight = height - padTop - padBottom
  const chartWidth = width - padX * 2
  const pointMax = Math.max(1, ...rows.map((row) => Number(row.pontos_media || 0)))
  const killMax = Math.max(1, ...rows.map((row) => Number(row.abates || 0) / Math.max(1, row.quedas)))
  const x = (index: number) => rows.length <= 1 ? width / 2 : padX + (index / (rows.length - 1)) * chartWidth
  const yPoint = (value: number) => padTop + chartHeight - (value / pointMax) * chartHeight
  const yKill = (value: number) => padTop + chartHeight - (value / killMax) * chartHeight
  const pointPath = rows.map((row, index) => `${index ? 'L' : 'M'} ${x(index)} ${yPoint(Number(row.pontos_media || 0))}`).join(' ')
  const killPath = rows.map((row, index) => `${index ? 'L' : 'M'} ${x(index)} ${yKill(Number(row.abates || 0) / Math.max(1, row.quedas))}`).join(' ')
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6))

  if (!rows.length) return <div className="team-analytics-empty">Nenhum resultado registrado neste recorte.</div>

  return (
    <div className="team-analytics-chart-wrap">
      <div className="team-analytics-chart-legend">
        <span><i className="points" />Pontos médios</span>
        <span><i className="kills" />Abates médios</span>
      </div>
      <svg className="team-analytics-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução de pontos e abates da equipe">
        {[0, 1, 2, 3, 4].map((step) => {
          const y = padTop + (step / 4) * chartHeight
          return <line key={step} x1={padX} y1={y} x2={width - padX} y2={y} className="grid" />
        })}
        <path d={pointPath} className="series points" />
        <path d={killPath} className="series kills" />
        {rows.map((row, index) => {
          const killsAvg = Number(row.abates || 0) / Math.max(1, row.quedas)
          return (
            <g key={row.chave}>
              <circle cx={x(index)} cy={yPoint(Number(row.pontos_media || 0))} r="4" className="dot points">
                <title>{`${row.label}: ${numberText(row.pontos_media, 1)} pts/queda`}</title>
              </circle>
              <circle cx={x(index)} cy={yKill(killsAvg)} r="3.5" className="dot kills">
                <title>{`${row.label}: ${numberText(killsAvg, 1)} abates/queda`}</title>
              </circle>
              {index % labelEvery === 0 || index === rows.length - 1 ? <text x={x(index)} y={height - 14} textAnchor="middle">{row.label}</text> : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function TeamAnalyticsDashboard({
  equipeId,
  nextGame,
  onOpenNextGame,
}: {
  equipeId: string
  nextGame?: NextGame
  onOpenNextGame?: () => void
}) {
  const [period, setPeriod] = useState<DashboardPeriod>('30d')
  const [eventId, setEventId] = useState('')
  const [lineId, setLineId] = useState('')
  const [mapCode, setMapCode] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!equipeId) return
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token
        if (!token) throw new Error('Sessão expirada. Entre novamente.')
        const params = new URLSearchParams({ equipe_id: equipeId, periodo: period })
        if (eventId) params.set('evento_id', eventId)
        if (lineId) params.set('line_id', lineId)
        if (mapCode) params.set('mapa', mapCode)
        const response = await fetch(`/api/equipe/dashboard?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json.error || 'Erro ao carregar dashboard da equipe.')
        setData(json as DashboardData)
      } catch (loadError: any) {
        if (loadError?.name === 'AbortError') return
        setError(loadError?.message || 'Erro ao carregar dashboard da equipe.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [equipeId, period, eventId, lineId, mapCode])

  const maxMapPoints = useMemo(() => Math.max(1, ...(data?.mapas || []).map((row) => Number(row.pontos_media || 0))), [data?.mapas])
  const maxPlayerKills = useMemo(() => Math.max(1, ...(data?.jogadores || []).map((row) => row.abates)), [data?.jogadores])
  const maxLinePoints = useMemo(() => Math.max(1, ...(data?.lines || []).map((row) => Number(row.pontos_media || 0))), [data?.lines])

  const resetFilters = () => {
    setPeriod('30d')
    setEventId('')
    setLineId('')
    setMapCode('')
  }

  return (
    <div className="panel-tab-body team-analytics-dashboard">
      <div className="team-analytics-toolbar">
        <div>
          <p className="eyebrow">Análise competitiva</p>
          <h3>Dashboard da equipe</h3>
          <span>Somente resultados, jogadores, lines e premiações cadastrados no DropZone entram nos indicadores.</span>
        </div>
        <div className="team-analytics-filters">
          <label>
            <span>Período</span>
            <select value={period} onChange={(event: ChangeEvent<HTMLSelectElement>) => setPeriod(event.target.value as DashboardPeriod)}>
              {(Object.keys(periodLabels) as DashboardPeriod[]).map((key) => <option key={key} value={key}>{periodLabels[key]}</option>)}
            </select>
          </label>
          <label>
            <span>Evento</span>
            <select value={eventId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setEventId(event.target.value)}>
              <option value="">Todos</option>
              {(data?.opcoes.eventos || []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>
            <span>Line</span>
            <select value={lineId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setLineId(event.target.value)}>
              <option value="">Todas</option>
              {(data?.opcoes.lines || []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label>
            <span>Mapa</span>
            <select value={mapCode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMapCode(event.target.value)}>
              <option value="">Todos</option>
              {(data?.opcoes.mapas || []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nome}</option>)}
            </select>
          </label>
          <button type="button" className="team-analytics-reset" onClick={resetFilters} title="Limpar filtros"><RefreshCw size={15} /></button>
        </div>
      </div>

      {error ? <div className="message error">{error}</div> : null}
      {loading && !data ? <div className="team-analytics-loading"><Loader2 className="spin" size={18} /> Carregando dados reais da equipe...</div> : null}

      {data ? (
        <>
          <section className="team-analytics-entry-strip" aria-label="Participações em campeonatos">
            <article><CalendarDays size={17} /><span><small>Jogou hoje</small><strong>{data.participacoes.hoje}</strong></span></article>
            <article><CalendarDays size={17} /><span><small>Eventos no mês</small><strong>{data.participacoes.mes}</strong></span></article>
            <article><CalendarDays size={17} /><span><small>Eventos no ano</small><strong>{data.participacoes.ano}</strong></span></article>
            <article><Trophy size={17} /><span><small>Participações</small><strong>{data.participacoes.total}</strong></span></article>
            {nextGame ? (
              <button type="button" className="team-analytics-next-game" onClick={onOpenNextGame}>
                <span><small>Próximo compromisso</small><strong>{nextGame.campeonato_nome || 'Campeonato'}</strong><em>{nextGame.line_nome || 'Line'}{nextGame.data_jogo ? ` · ${new Date(`${nextGame.data_jogo}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}{nextGame.horario ? ` · ${String(nextGame.horario).slice(0, 5)}h` : ''}</em></span>
                <ChevronRight size={17} />
              </button>
            ) : null}
          </section>

          <section className="team-analytics-kpis">
            <article><Trophy size={17} /><span>Eventos no recorte</span><strong>{data.kpis.campeonatos_disputados}</strong><small>{data.kpis.quedas} quedas analisadas</small></article>
            <article><Target size={17} /><span>Pontos / queda</span><strong>{numberText(data.kpis.pontos_media, 1)}</strong><small>{numberText(data.kpis.pontos_total, 0)} pontos no total</small></article>
            <article><Crosshair size={17} /><span>Abates</span><strong>{numberText(data.kpis.abates)}</strong><small>{data.kpis.quedas ? numberText(data.kpis.abates / data.kpis.quedas, 1) : '—'} por queda</small></article>
            <article><Trophy size={17} /><span>Booyahs</span><strong>{numberText(data.kpis.booyahs)}</strong><small>{data.kpis.quedas ? percentText((data.kpis.booyahs / data.kpis.quedas) * 100) : '—'} das quedas</small></article>
            <article><Activity size={17} /><span>Colocação média</span><strong>{positionText(data.kpis.colocacao_media)}</strong><small>Top 5 em {percentText(data.kpis.top5_percentual)}</small></article>
            <article><CircleDollarSign size={17} /><span>Premiação em disputa</span><strong>{currencyText(data.kpis.premio_em_disputa)}</strong><small>{data.kpis.campeonatos_com_premiacao_ativa} campeonato(s) ativo(s)</small></article>
          </section>

          <section className="team-analytics-grid">
            <article className="team-analytics-card team-analytics-evolution">
              <header><div><span>Evolução</span><strong>Pontos e abates ao longo do tempo</strong></div><small>{periodLabels[period]} · {data.meta.resultados_considerados} quedas</small></header>
              <EvolutionChart rows={data.evolucao} />
            </article>

            <article className="team-analytics-card team-analytics-prize">
              <header><div><span>Premiações</span><strong>Valores atualmente em disputa</strong></div><CircleDollarSign size={18} /></header>
              <div className="team-analytics-prize-total"><strong>{currencyText(data.premios.em_disputa)}</strong><span>Somatório das premiações numéricas dos campeonatos ativos em que a equipe participa.</span></div>
              <div className="team-analytics-prize-list">
                {data.premios.eventos.slice(0, 5).map((item) => <div key={item.campeonato_id}><span><strong>{item.nome}</strong>{item.descricao ? <small>{item.descricao}</small> : null}</span><b>{currencyText(item.valor)}</b></div>)}
                {!data.premios.eventos.length ? <p>Nenhuma premiação numérica ativa cadastrada para este recorte de equipe/line.</p> : null}
              </div>
            </article>

            <article className="team-analytics-card team-analytics-map-card">
              <header><div><span>Mapas</span><strong>Onde a equipe rende melhor</strong></div><MapPinned size={18} /></header>
              <div className="team-analytics-ranked-list">
                {data.mapas.slice(0, 7).map((item) => <div className="team-analytics-ranked-row" key={item.codigo}>
                  <span className="identity"><strong>{item.nome}</strong><small>{item.quedas} quedas · {item.booyahs} booyah(s) · Top 5 {percentText(item.top5_percentual)}</small></span>
                  <span className="metric"><b>{numberText(item.pontos_media, 1)}</b><small>pts/q</small></span>
                  <span className="metric"><b>{numberText(item.abates_media, 1)}</b><small>kills/q</small></span>
                  <span className="metric"><b>{positionText(item.colocacao_media)}</b><small>posição</small></span>
                  <MiniProgress value={Number(item.pontos_media || 0)} max={maxMapPoints} />
                </div>)}
                {!data.mapas.length ? <div className="team-analytics-empty">Nenhum mapa com resultado neste recorte.</div> : null}
              </div>
            </article>

            <article className="team-analytics-card team-analytics-event-card">
              <header><div><span>Eventos</span><strong>Desempenho por campeonato</strong></div><Trophy size={18} /></header>
              <div className="team-analytics-event-table">
                <div className="head"><span>Evento</span><span>Q</span><span>PTS/Q</span><span>K</span><span>POS.</span><span>Prêmio</span></div>
                {data.eventos.slice(0, 8).map((item) => <div className="row" key={item.id}>
                  <span className="event"><img src={item.logo_url || '/favicon.ico'} alt="" /><i><strong>{item.nome}</strong><small>{item.tipo || item.status || 'Campeonato'}</small></i></span>
                  <b>{item.quedas}</b>
                  <b>{numberText(item.pontos_media, 1)}</b>
                  <b>{item.abates}</b>
                  <b>{positionText(item.colocacao_media)}</b>
                  <b>{currencyText(item.premiacao)}</b>
                </div>)}
                {!data.eventos.length ? <div className="team-analytics-empty">Nenhum campeonato com resultado neste recorte.</div> : null}
              </div>
            </article>

            <article className="team-analytics-card team-analytics-players-card">
              <header><div><span>Jogadores</span><strong>Desempenho individual</strong></div><Users size={18} /></header>
              <div className="team-analytics-mini-list">
                {data.jogadores.slice(0, 6).map((player, index) => <div key={player.id}>
                  <span className="rank">{index + 1}</span>
                  <img src={player.foto_url || '/images/jogador-misterioso.png'} alt="" />
                  <span className="identity"><strong>{player.nick}</strong><small>{player.line_nome || 'Sem line'} · {player.quedas} quedas</small></span>
                  <span className="metric"><b>{player.abates}</b><small>kills</small></span>
                  <span className="metric"><b>{numberText(player.dano_media, 0)}</b><small>dano/q</small></span>
                  <MiniProgress value={player.abates} max={maxPlayerKills} />
                </div>)}
                {!data.jogadores.length ? <div className="team-analytics-empty">Nenhum resultado individual neste recorte.</div> : null}
              </div>
            </article>

            <article className="team-analytics-card team-analytics-lines-card">
              <header><div><span>Lines</span><strong>Comparativo interno</strong></div><Users size={18} /></header>
              <div className="team-analytics-mini-list line-list">
                {data.lines.slice(0, 6).map((line, index) => <div key={line.id}>
                  <span className="rank">{index + 1}</span>
                  <span className="line-avatar">{line.logo_url ? <img src={line.logo_url} alt="" /> : line.nome.slice(0, 1).toUpperCase()}</span>
                  <span className="identity"><strong>{line.nome}</strong><small>{line.quedas} quedas · {line.booyahs} booyah(s)</small></span>
                  <span className="metric"><b>{numberText(line.pontos_media, 1)}</b><small>pts/q</small></span>
                  <span className="metric"><b>{numberText(line.abates_media, 1)}</b><small>k/q</small></span>
                  <MiniProgress value={Number(line.pontos_media || 0)} max={maxLinePoints} />
                </div>)}
                {!data.lines.length ? <div className="team-analytics-empty">Nenhuma line com resultado neste recorte.</div> : null}
              </div>
            </article>

            <article className="team-analytics-card team-analytics-insights">
              <header><div><span>Leitura rápida</span><strong>Pontos para evolução</strong></div><Activity size={18} /></header>
              <div className="team-analytics-insight-grid">
                <div><small>Melhor mapa*</small><strong>{data.insights.melhor_mapa?.nome || 'Dados insuficientes'}</strong>{data.insights.melhor_mapa ? <span>{numberText(data.insights.melhor_mapa.pontos_media, 1)} pts/q · {data.insights.melhor_mapa.quedas} quedas</span> : null}</div>
                <div><small>Mapa de atenção*</small><strong>{data.insights.mapa_atencao?.nome || 'Dados insuficientes'}</strong>{data.insights.mapa_atencao ? <span>{numberText(data.insights.mapa_atencao.pontos_media, 1)} pts/q · {data.insights.mapa_atencao.quedas} quedas</span> : null}</div>
                <div><small>Line destaque*</small><strong>{data.insights.line_destaque?.nome || 'Dados insuficientes'}</strong>{data.insights.line_destaque ? <span>{numberText(data.insights.line_destaque.pontos_media, 1)} pts/q · Top 5 {percentText(data.insights.line_destaque.top5_percentual)}</span> : null}</div>
                <div><small>Jogador destaque</small><strong>{data.insights.jogador_destaque?.nick || 'Sem resultado individual'}</strong>{data.insights.jogador_destaque ? <span>{data.insights.jogador_destaque.abates} kills · {numberText(data.insights.jogador_destaque.abates_media, 1)} k/q</span> : null}</div>
                <div className="trend"><small>Tendência · últimas 5 vs. 5 anteriores</small><strong>{data.insights.tendencia ? (data.insights.tendencia.direcao === 'alta' ? `+${numberText(data.insights.tendencia.percentual, 1)}%` : data.insights.tendencia.direcao === 'queda' ? `-${numberText(data.insights.tendencia.percentual, 1)}%` : 'Estável') : 'Dados insuficientes'}</strong>{data.insights.tendencia ? <span>{numberText(data.insights.tendencia.anterior, 1)} → {numberText(data.insights.tendencia.atual, 1)} pts/q</span> : null}</div>
              </div>
              <p>* Comparações de mapa e line exigem pelo menos 3 quedas no recorte.</p>
            </article>
          </section>
        </>
      ) : null}
    </div>
  )
}
