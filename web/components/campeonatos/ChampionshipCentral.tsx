'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertCircle, AlertTriangle, BookOpen, CheckCircle2, Clock3, CreditCard, ExternalLink, Gamepad2, Info, LoaderCircle, Trophy, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

type Championship = { id: string; nome: string; tipo?: string; permission?: { role?: string } }
type Summary = {
  campeonato: Championship
  cards: {
    vagas: { total: number; ocupadas: number; disponiveis: number }
    equipes: { confirmadas: number }
    escalacoes: { incompletas: number }
    grupos: { total: number; incompletos: number }
    jogos: { total: number; sem_quedas: number; quedas: number }
    resultados: { registrados: number; pendentes: number }
    pagamentos: { pendentes: number; aprovados: number }
    regulamento: { publicado: boolean; status: string }
  }
  alerts: Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; message: string; context: string; action: string; href: string }>
  alert_summary: { total: number; critical: number; warning: number; info: number }
  logs: Array<{ id: string; category: 'championship' | 'structure' | 'team' | 'lineup' | 'game' | 'result' | 'payment' | 'rulebook' | 'security'; action: string; title: string; detail: string; occurred_at: string; actor: string; source: string }>
  log_summary: { total: number; visible: number; latest_at: string | null; categories: Record<string, number> }
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Entre na sua conta para acessar a Central do Campeonato.')
  return { Authorization: `Bearer ${token}` }
}

export function ChampionshipCentral() {
  const [items, setItems] = useState<Championship[]>([])
  const [selected, setSelected] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logFilter, setLogFilter] = useState('all')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const headers = await authHeaders()
        const response = await fetch('/api/central-campeonato', { headers, cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Não foi possível listar os campeonatos.')
        if (!active) return
        const next = Array.isArray(body.items) ? body.items : []
        setItems(next)
        setSelected(next[0]?.id || '')
      } catch (e: any) {
        if (active) setError(e?.message || 'Erro ao abrir a Central.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) { setSummary(null); return }
    let active = true
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const headers = await authHeaders()
        const response = await fetch(`/api/central-campeonato?campeonato_id=${encodeURIComponent(selected)}`, { headers, cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar o resumo.')
        if (active) setSummary(body)
      } catch (e: any) {
        if (active) setError(e?.message || 'Erro ao carregar o campeonato.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [selected])

  const filteredLogs = summary?.logs?.filter((log) => logFilter === 'all' || log.category === logFilter) || []

  const cards = summary ? [
    ['Vagas', `${summary.cards.vagas.ocupadas}/${summary.cards.vagas.total}`, `${summary.cards.vagas.disponiveis} disponíveis`, Users],
    ['Equipes', String(summary.cards.equipes.confirmadas), 'confirmadas', Users],
    ['Grupos', String(summary.cards.grupos.total), `${summary.cards.grupos.incompletos} incompletos`, Trophy],
    ['Jogos', String(summary.cards.jogos.total), `${summary.cards.jogos.sem_quedas} sem quedas`, Gamepad2],
    ['Resultados', String(summary.cards.resultados.registrados), `${summary.cards.resultados.pendentes} pendentes`, Trophy],
    ['Pagamentos', String(summary.cards.pagamentos.aprovados), `${summary.cards.pagamentos.pendentes} pendentes`, CreditCard],
    ['Regulamento', summary.cards.regulamento.publicado ? 'Publicado' : 'Pendente', summary.cards.regulamento.status, BookOpen],
  ] as const : []

  return (
    <div className="championship-central-shell">
      <header className="championship-central-header">
        <div><small>OPERAÇÃO SEGURA</small><h1>Central do Campeonato</h1><p>Visão rápida e somente leitura dos campeonatos que você pode administrar.</p></div>
        <select value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Selecionar campeonato">
          <option value="">Selecione um campeonato</option>
          {items.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </header>

      {loading ? <div className="championship-central-state"><LoaderCircle className="spin" /> Carregando...</div> : null}
      {!loading && error ? <div className="championship-central-state error"><AlertTriangle /> {error}</div> : null}
      {!loading && !error && !items.length ? <div className="championship-central-state">Nenhum campeonato autorizado encontrado.</div> : null}

      {!loading && summary ? (
        <>
          <section className="championship-central-title"><div><small>{summary.campeonato.tipo || 'Campeonato'}</small><h2>{summary.campeonato.nome}</h2></div></section>
          <section className="championship-central-grid">
            {cards.map(([label, value, detail, Icon]) => <article key={label}><Icon size={18} /><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>)}
          </section>
          <section className="championship-central-alerts">
            <div className="championship-central-alerts-heading">
              <div>
                <small>PRIORIDADES DA OPERAÇÃO</small>
                <h3>Alertas inteligentes</h3>
              </div>
              <div className="championship-central-alert-counts" aria-label="Resumo dos alertas">
                <span className="critical">{summary.alert_summary.critical} críticos</span>
                <span className="warning">{summary.alert_summary.warning} avisos</span>
                <span className="info">{summary.alert_summary.info} informativos</span>
              </div>
            </div>
            {summary.alerts.length ? (
              <div className="championship-central-alert-list">
                {summary.alerts.map((alert) => {
                  const Icon = alert.severity === 'critical' ? AlertCircle : alert.severity === 'warning' ? AlertTriangle : Info
                  return (
                    <article key={alert.id} className={`smart-alert ${alert.severity}`}>
                      <div className="smart-alert-icon"><Icon size={19} /></div>
                      <div className="smart-alert-copy">
                        <div className="smart-alert-title"><strong>{alert.title}</strong><span>{alert.severity === 'critical' ? 'Crítico' : alert.severity === 'warning' ? 'Atenção' : 'Informativo'}</span></div>
                        <p>{alert.message}</p>
                        <small>{alert.context}</small>
                      </div>
                      <a href={alert.href}>{alert.action}<ExternalLink size={14} /></a>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="championship-central-alert-empty"><CheckCircle2 size={19} /><div><strong>Operação em dia</strong><span>Nenhuma pendência acionável foi encontrada nesta leitura.</span></div></div>
            )}
          </section>
          <section className="championship-central-logs">
            <div className="championship-central-logs-heading">
              <div>
                <small>HISTÓRICO RASTREÁVEL</small>
                <h3>Logs operacionais</h3>
                <p>Eventos reais consolidados da estrutura, inscrições, jogos, resultados, pagamentos e segurança.</p>
              </div>
              <div className="championship-central-log-total"><Activity size={16} />{summary.log_summary.visible} exibidos</div>
            </div>
            <div className="championship-central-log-filters" aria-label="Filtrar logs operacionais">
              {[
                ['all', 'Todos'], ['structure', 'Estrutura'], ['team', 'Equipes'], ['lineup', 'Escalações'], ['game', 'Jogos'], ['result', 'Resultados'], ['payment', 'Pagamentos'], ['rulebook', 'Regulamento'], ['security', 'Segurança'],
              ].map(([value, label]) => <button key={value} type="button" className={logFilter === value ? 'active' : ''} onClick={() => setLogFilter(value)}>{label}</button>)}
            </div>
            {filteredLogs.length ? (
              <div className="championship-central-log-list">
                {filteredLogs.map((log) => (
                  <article key={log.id} className={`operational-log ${log.category}`}>
                    <div className="operational-log-marker"><Clock3 size={15} /></div>
                    <div className="operational-log-copy">
                      <div><strong>{log.title}</strong><span>{log.actor}</span></div>
                      <p>{log.detail}</p>
                      <small>{new Date(log.occurred_at).toLocaleString('pt-BR')} · fonte: {log.source}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : <div className="championship-central-log-empty">Nenhum evento encontrado neste filtro.</div>}
          </section>
        </>
      ) : null}
    </div>
  )
}
