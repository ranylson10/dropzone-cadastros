'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, AlertTriangle, BookOpen, CheckCircle2, Clock3, CreditCard, ExternalLink, Gamepad2, Info, LoaderCircle, MapPin, Trophy, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

type Championship = { id: string; nome: string; tipo?: string; access?: 'administration' | 'participant'; permission?: { role?: string } }
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
  alerts: Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; message: string; context: string; action: string; href: string; status?: 'new' | 'read' | 'resolved' | 'dismissed'; status_note?: string | null; status_updated_at?: string | null }>
  alert_summary: { total: number; active: number; new: number; read: number; resolved: number; dismissed: number; critical: number; warning: number; info: number }
  logs: Array<{ id: string; category: 'championship' | 'structure' | 'team' | 'lineup' | 'game' | 'result' | 'payment' | 'rulebook' | 'security'; action: string; title: string; detail: string; occurred_at: string; actor: string; source: string }>
  log_summary: { total: number; visible: number; latest_at: string | null; categories: Record<string, number> }
}

type ChoicePayload = {
  participations: Array<{ id: string; nome_exibicao?: string | null; grupo_id?: string | null; slot_id?: string | null; slot_numero?: number | null }>
  configs: Array<{ fase_id: string; aberta: boolean; permite_troca: boolean; abre_em?: string | null; fecha_em?: string | null }>
  groups: Array<{ id: string; nome: string; fase_id: string; slots?: number | null }>
  slots: Array<{ id: string; fase_id?: string | null; grupo_id: string; slot_numero: number; slot_letra?: string | null; status: string; equipe_id?: string | null; line_id?: string | null }>
  blocks: Array<{ id: string; fase_id: string; grupo_id?: string | null; slot_id?: string | null; motivo?: string | null }>
  history: Array<{ id: string; campeonato_equipe_id: string; grupo_anterior_id?: string | null; grupo_novo_id?: string | null; slot_anterior_id?: string | null; slot_novo_id?: string | null; observacao?: string | null; created_at: string }>
  server_time?: string
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
  const [choice, setChoice] = useState<ChoicePayload | null>(null)
  const [choiceForm, setChoiceForm] = useState({ campeonato_equipe_id: '', grupo_id: '', slot_id: '' })
  const [loading, setLoading] = useState(true)
  const [savingChoice, setSavingChoice] = useState(false)
  const [choiceAction, setChoiceAction] = useState<{ participationId: string; kind: 'cancel' | 'restore' } | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [logFilter, setLogFilter] = useState('all')
  const [alertFilter, setAlertFilter] = useState('active')
  const [alertBusy, setAlertBusy] = useState('')

  const selectedItem = items.find((item) => item.id === selected)
  const participantMode = selectedItem?.access === 'participant'

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const headers = await authHeaders()
        const response = await fetch('/api/central-campeonato', { headers, cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Não foi possível listar os campeonatos.')
        if (!active) return
        const byId = new Map<string, Championship>()
        for (const row of Array.isArray(body.participant_items) ? body.participant_items : []) byId.set(String(row.id), { ...row, access: 'participant' })
        for (const row of Array.isArray(body.items) ? body.items : []) byId.set(String(row.id), { ...row, access: 'administration' })
        const next = [...byId.values()]
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
    if (!selected || !selectedItem) { setSummary(null); setChoice(null); return }
    let active = true
    setLoading(true)
    setError('')
    setSuccess('')
    setSummary(null)
    setChoice(null)
    ;(async () => {
      try {
        const headers = await authHeaders()
        const endpoint = participantMode
          ? `/api/campeonatos/${encodeURIComponent(selected)}/escolha-grupo`
          : `/api/central-campeonato?campeonato_id=${encodeURIComponent(selected)}`
        const response = await fetch(endpoint, { headers, cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar o campeonato.')
        if (!active) return
        if (participantMode) {
          setChoice(body)
          setChoiceForm((current) => ({ ...current, campeonato_equipe_id: body.participations?.[0]?.id || '' }))
        } else setSummary(body)
      } catch (e: any) {
        if (active) setError(e?.message || 'Erro ao carregar o campeonato.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [selected, selectedItem, participantMode])

  const availableGroups = useMemo(() => {
    if (!choice) return []
    const openPhases = new Set(choice.configs.map((row) => String(row.fase_id)))
    const blockedGroups = new Set((choice.blocks || []).map((row) => String(row.grupo_id || '')).filter(Boolean))
    return choice.groups.filter((group) => openPhases.has(String(group.fase_id)) && !blockedGroups.has(String(group.id)))
  }, [choice])

  const availableSlots = useMemo(() => (choice?.slots || []).filter((slot) =>
    String(slot.grupo_id) === choiceForm.grupo_id && slot.status === 'livre' && !slot.equipe_id && !slot.line_id && !(choice?.blocks || []).some((row) => String(row.slot_id || '') === String(slot.id)),
  ), [choice, choiceForm.grupo_id])

  async function saveGroupChoice() {
    if (!selected || !choiceForm.campeonato_equipe_id || !choiceForm.grupo_id || !choiceForm.slot_id) return
    setSavingChoice(true)
    setError('')
    setSuccess('')
    try {
      const headers = await authHeaders()
      const response = await fetch(`/api/campeonatos/${encodeURIComponent(selected)}/escolha-grupo`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(choiceForm),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível confirmar o grupo e o slot.')
      setChoice(body)
      setChoiceForm((current) => ({ ...current, grupo_id: '', slot_id: '' }))
      setSuccess('Grupo e slot confirmados com sucesso.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao confirmar grupo e slot.')
    } finally { setSavingChoice(false) }
  }

  async function runChoiceAction(method: 'DELETE' | 'PUT', participationId: string) {
    if (!selected || !participationId) return
    setChoiceAction({ participationId, kind: method === 'DELETE' ? 'cancel' : 'restore' })
    setError('')
    setSuccess('')
    try {
      const headers = await authHeaders()
      const response = await fetch(`/api/campeonatos/${encodeURIComponent(selected)}/escolha-grupo`, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campeonato_equipe_id: participationId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || (method === 'DELETE' ? 'Não foi possível cancelar a escolha.' : 'Não foi possível restaurar a escolha.'))
      setChoice(body)
      setSuccess(method === 'DELETE' ? 'Escolha cancelada. O grupo e o slot foram liberados.' : 'Escolha anterior restaurada com sucesso.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar a escolha.')
    } finally { setChoiceAction(null) }
  }


  async function updateAlertStatus(alertKey: string, status: 'new' | 'read' | 'resolved' | 'dismissed') {
    if (!selected) return
    let note: string | null = null
    if (status === 'resolved' || status === 'dismissed') {
      note = window.prompt(status === 'resolved' ? 'Informe como o alerta foi resolvido (opcional):' : 'Informe o motivo para dispensar este alerta (opcional):')
      if (note === null) return
    }
    setAlertBusy(alertKey)
    setError('')
    setSuccess('')
    try {
      const headers = await authHeaders()
      const response = await fetch('/api/central-campeonato', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campeonato_id: selected, alert_key: alertKey, status, note }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível atualizar o alerta.')
      setSummary(body)
      setSuccess(status === 'read' ? 'Alerta marcado como lido.' : status === 'resolved' ? 'Alerta marcado como resolvido.' : status === 'dismissed' ? 'Alerta dispensado.' : 'Alerta reaberto.')
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar o alerta.')
    } finally { setAlertBusy('') }
  }

  const filteredAlerts = summary?.alerts?.filter((alert) => {
    const status = alert.status || 'new'
    if (alertFilter === 'active') return status === 'new' || status === 'read'
    if (alertFilter === 'closed') return status === 'resolved' || status === 'dismissed'
    return alertFilter === 'all' || status === alertFilter
  }) || []

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
        <div><small>OPERAÇÃO SEGURA</small><h1>Central do Campeonato</h1><p>Administre o campeonato ou escolha manualmente o grupo e o slot da sua equipe.</p></div>
        <select value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Selecionar campeonato">
          <option value="">Selecione um campeonato</option>
          {items.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.access === 'participant' ? ' · Minha equipe' : ' · Administração'}</option>)}
        </select>
      </header>

      {loading ? <div className="championship-central-state"><LoaderCircle className="spin" /> Carregando...</div> : null}
      {!loading && error ? <div className="championship-central-state error"><AlertTriangle /> {error}</div> : null}
      {!loading && success ? <div className="championship-central-state success"><CheckCircle2 /> {success}</div> : null}
      {!loading && !error && !items.length ? <div className="championship-central-state">Nenhum campeonato autorizado encontrado.</div> : null}

      {!loading && choice && selectedItem ? (
        <section className="championship-choice-panel">
          <div className="championship-choice-heading"><div><small>ESCOLHA DA EQUIPE</small><h2>{selectedItem.nome}</h2><p>Nenhum grupo ou slot é definido automaticamente. Escolha apenas entre as opções liberadas pela administração.</p></div><MapPin size={24} /></div>
          {choice.participations.length ? <>
            <div className="championship-choice-current">{choice.participations.map((row) => { const group = choice.groups.find((item) => item.id === row.grupo_id); const slot = choice.slots.find((item) => item.id === row.slot_id); const canRestore = !row.grupo_id && choice.history.some((item) => item.campeonato_equipe_id === row.id && !item.grupo_novo_id && item.grupo_anterior_id && item.slot_anterior_id); return <article key={row.id}><div><strong>{row.nome_exibicao || 'Minha equipe'}</strong><span>{group ? `${group.nome} · ${slot?.slot_letra || `Slot ${slot?.slot_numero || row.slot_numero || '-'}`}` : 'Grupo e slot ainda não escolhidos'}</span></div><div className="championship-choice-actions">{row.grupo_id ? <button type="button" className="button secondary danger" disabled={Boolean(choiceAction)} onClick={() => void runChoiceAction('DELETE', row.id)}>{choiceAction?.participationId === row.id && choiceAction.kind === 'cancel' ? 'Cancelando...' : 'Cancelar escolha'}</button> : null}{canRestore ? <button type="button" className="button secondary" disabled={Boolean(choiceAction)} onClick={() => void runChoiceAction('PUT', row.id)}>{choiceAction?.participationId === row.id && choiceAction.kind === 'restore' ? 'Restaurando...' : 'Restaurar anterior'}</button> : null}</div></article> })}</div>
            {availableGroups.length ? <div className="championship-choice-form">
              <label><span>Equipe/line</span><select value={choiceForm.campeonato_equipe_id} onChange={(event) => setChoiceForm({ ...choiceForm, campeonato_equipe_id: event.target.value })}>{choice.participations.map((row) => <option key={row.id} value={row.id}>{row.nome_exibicao || 'Minha equipe'}</option>)}</select></label>
              <label><span>Grupo</span><select value={choiceForm.grupo_id} onChange={(event) => setChoiceForm({ ...choiceForm, grupo_id: event.target.value, slot_id: '' })}><option value="">Escolha o grupo</option>{availableGroups.map((group) => { const free = choice.slots.filter((slot) => slot.grupo_id === group.id && slot.status === 'livre' && !slot.equipe_id && !slot.line_id && !choice.blocks.some((block) => String(block.slot_id || '') === String(slot.id))).length; return <option key={group.id} value={group.id} disabled={!free}>{group.nome} · {free} slot(s) livre(s)</option> })}</select></label>
              <label><span>Slot</span><select value={choiceForm.slot_id} onChange={(event) => setChoiceForm({ ...choiceForm, slot_id: event.target.value })} disabled={!choiceForm.grupo_id}><option value="">Escolha o slot</option>{availableSlots.map((slot) => <option key={slot.id} value={slot.id}>{slot.slot_letra || `Slot ${slot.slot_numero}`}</option>)}</select></label>
              <button type="button" className="button" disabled={savingChoice || !choiceForm.campeonato_equipe_id || !choiceForm.grupo_id || !choiceForm.slot_id} onClick={() => void saveGroupChoice()}>{savingChoice ? <LoaderCircle className="spin" size={15} /> : null} Confirmar grupo e slot</button>
            </div> : <div className="championship-choice-closed"><Clock3 size={18} /><div><strong>Escolha indisponível</strong><span>A escolha ainda não abriu, o prazo terminou ou todas as opções foram bloqueadas pela administração.</span></div></div>}
          </> : <div className="championship-choice-closed"><Info size={18} /><div><strong>Nenhuma participação ativa</strong><span>Não encontramos uma equipe sua neste campeonato.</span></div></div>}
        </section>
      ) : null}

      {!loading && summary ? (
        <>
          <section className="championship-central-title"><div><small>{summary.campeonato.tipo || 'Campeonato'}</small><h2>{summary.campeonato.nome}</h2></div></section>
          <section className="championship-central-grid">{cards.map(([label, value, detail, Icon]) => <article key={label}><Icon size={18} /><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>)}</section>
          <section className="championship-central-alerts">
            <div className="championship-central-alerts-heading"><div><small>PRIORIDADES DA OPERAÇÃO</small><h3>Alertas inteligentes</h3></div><div className="championship-central-alert-counts" aria-label="Resumo dos alertas"><span className="critical">{summary.alert_summary.critical} críticos</span><span className="warning">{summary.alert_summary.warning} avisos</span><span className="info">{summary.alert_summary.info} informativos</span></div></div>
            <div className="championship-central-alert-filters" aria-label="Filtrar alertas inteligentes">{[['active', 'Ativos'], ['new', 'Novos'], ['read', 'Lidos'], ['closed', 'Encerrados'], ['all', 'Todos']].map(([value, label]) => <button key={value} type="button" className={alertFilter === value ? 'active' : ''} onClick={() => setAlertFilter(value)}>{label}</button>)}</div>
            {filteredAlerts.length ? <div className="championship-central-alert-list">{filteredAlerts.map((alert) => { const Icon = alert.severity === 'critical' ? AlertCircle : alert.severity === 'warning' ? AlertTriangle : Info; const status = alert.status || 'new'; return <article key={alert.id} className={`smart-alert ${alert.severity} status-${status}`}><div className="smart-alert-icon"><Icon size={19} /></div><div className="smart-alert-copy"><div className="smart-alert-title"><strong>{alert.title}</strong><span>{status === 'resolved' ? 'Resolvido' : status === 'dismissed' ? 'Dispensado' : status === 'read' ? 'Lido' : alert.severity === 'critical' ? 'Crítico' : alert.severity === 'warning' ? 'Atenção' : 'Informativo'}</span></div><p>{alert.message}</p><small>{alert.context}</small>{alert.status_note ? <em>{alert.status_note}</em> : null}</div><div className="smart-alert-actions"><a href={alert.href}>{alert.action}<ExternalLink size={14} /></a>{status === 'new' ? <button type="button" disabled={alertBusy === alert.id} onClick={() => void updateAlertStatus(alert.id, 'read')}>Marcar lido</button> : null}{status === 'new' || status === 'read' ? <><button type="button" disabled={alertBusy === alert.id} onClick={() => void updateAlertStatus(alert.id, 'resolved')}>Resolver</button><button type="button" disabled={alertBusy === alert.id} onClick={() => void updateAlertStatus(alert.id, 'dismissed')}>Dispensar</button></> : <button type="button" disabled={alertBusy === alert.id} onClick={() => void updateAlertStatus(alert.id, 'new')}>Reabrir</button>}</div></article> })}</div> : <div className="championship-central-alert-empty"><CheckCircle2 size={19} /><div><strong>Nenhum alerta neste filtro</strong><span>{summary.alerts.length ? 'Altere o filtro para consultar outros estados.' : 'Nenhuma pendência acionável foi encontrada nesta leitura.'}</span></div></div>}
          </section>
          <section className="championship-central-logs">
            <div className="championship-central-logs-heading"><div><small>HISTÓRICO RASTREÁVEL</small><h3>Logs operacionais</h3><p>Eventos reais consolidados da estrutura, inscrições, jogos, resultados, pagamentos e segurança.</p></div><div className="championship-central-log-total"><Activity size={16} />{summary.log_summary.visible} exibidos</div></div>
            <div className="championship-central-log-filters" aria-label="Filtrar logs operacionais">{[['all', 'Todos'], ['structure', 'Estrutura'], ['team', 'Equipes'], ['lineup', 'Escalações'], ['game', 'Jogos'], ['result', 'Resultados'], ['payment', 'Pagamentos'], ['rulebook', 'Regulamento'], ['security', 'Segurança']].map(([value, label]) => <button key={value} type="button" className={logFilter === value ? 'active' : ''} onClick={() => setLogFilter(value)}>{label}</button>)}</div>
            {filteredLogs.length ? <div className="championship-central-log-list">{filteredLogs.map((log) => <article key={log.id} className={`operational-log ${log.category}`}><div className="operational-log-marker"><Clock3 size={15} /></div><div className="operational-log-copy"><div><strong>{log.title}</strong><span>{log.actor}</span></div><p>{log.detail}</p><small>{new Date(log.occurred_at).toLocaleString('pt-BR')} · fonte: {log.source}</small></div></article>)}</div> : <div className="championship-central-log-empty">Nenhum evento encontrado neste filtro.</div>}
          </section>
        </>
      ) : null}
    </div>
  )
}
