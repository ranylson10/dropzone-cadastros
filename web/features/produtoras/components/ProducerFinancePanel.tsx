'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  CalendarRange,
  CircleDollarSign,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
} from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'

const CATEGORY_LABELS: Record<string, string> = {
  patrocinio: 'Patrocínio',
  premiacao: 'Premiação',
  design: 'Design',
  narracao: 'Narração',
  servidor: 'Servidor',
  producao: 'Produção',
  marketing: 'Marketing',
  plataforma: 'Plataforma',
  equipe: 'Equipe',
  viagem: 'Viagem',
  imposto: 'Imposto',
  taxa: 'Taxa',
  outros: 'Outros',
}

const ENTRY_CATEGORIES = Object.entries(CATEGORY_LABELS)

function money(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0) / 100)
}

function percent(value: unknown) {
  const n = Number(value || 0)
  return `${Number.isFinite(n) ? n.toFixed(n % 1 ? 1 : 0) : '0'}%`
}

function inputMoneyFromCents(value: unknown) {
  const n = Number(value || 0) / 100
  return n > 0 ? String(n.toFixed(2)) : ''
}

function centsFromInput(value: string) {
  const n = Number(String(value || '').replace(',', '.'))
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7)
}

function titleOfChampionship(championship: DropZoneRow) {
  return String(championship.data?.nome || championship.name || 'Campeonato')
}

type EntryForm = {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  descricao: string
  valor: string
  data_competencia: string
  status: 'previsto' | 'realizado' | 'cancelado'
  campeonato_id: string
  observacao: string
}

function emptyEntry(championshipId?: string | null): EntryForm {
  return {
    id: '',
    tipo: 'despesa',
    categoria: 'producao',
    descricao: '',
    valor: '',
    data_competencia: today(),
    status: 'realizado',
    campeonato_id: championshipId || '',
    observacao: '',
  }
}

export function ProducerFinancePanel(props: {
  producerId: string
  championships: DropZoneRow[]
  championshipId?: string | null
  scope?: 'workspace' | 'championship'
}) {
  const scope = props.scope || 'workspace'
  const [period, setPeriod] = useState(currentPeriod())
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [entryOpen, setEntryOpen] = useState(false)
  const [entry, setEntry] = useState<EntryForm>(() => emptyEntry(props.championshipId))
  const [goalRevenue, setGoalRevenue] = useState('')
  const [goalProfit, setGoalProfit] = useState('')
  const [goalSeats, setGoalSeats] = useState('')

  const selectedChampionship = useMemo(
    () => props.championships.find((championship) => championship.id === props.championshipId) || null,
    [props.championships, props.championshipId],
  )

  async function financeRequest(path: string, options?: RequestInit) {
    const { data: authData } = await supabase.auth.getSession()
    const token = authData.session?.access_token
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        'X-Produtora-Id': props.producerId,
        ...(options?.headers || {}),
      },
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(json.error || 'Não foi possível concluir a operação financeira.')
    return json
  }

  async function loadFinance() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ periodo: period })
      if (props.championshipId) params.set('campeonato_id', props.championshipId)
      const json = await financeRequest(`/api/produtora/financeiro?${params.toString()}`)
      setData(json)
      if (scope === 'workspace') {
        setGoalRevenue(inputMoneyFromCents(json.resumo?.meta_receita_centavos))
        setGoalProfit(inputMoneyFromCents(json.resumo?.meta_lucro_centavos))
        setGoalSeats(json.resumo?.meta_vagas ? String(json.resumo.meta_vagas) : '')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar o financeiro gerencial.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setEntry(emptyEntry(props.championshipId))
  }, [props.championshipId])

  useEffect(() => {
    void loadFinance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.producerId, props.championshipId, period])

  async function saveGoal() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await financeRequest('/api/produtora/financeiro', {
        method: 'POST',
        body: JSON.stringify({
          action: 'meta',
          periodo: period,
          meta_receita_centavos: centsFromInput(goalRevenue),
          meta_lucro_centavos: centsFromInput(goalProfit),
          meta_vagas: Math.max(0, Math.floor(Number(goalSeats || 0))),
        }),
      })
      setMessage('Metas mensais atualizadas.')
      await loadFinance()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao salvar metas.')
    } finally {
      setBusy(false)
    }
  }

  async function saveEntry() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        lancamento_id: entry.id || undefined,
        campeonato_id: props.championshipId || entry.campeonato_id || null,
        tipo: entry.tipo,
        categoria: entry.categoria,
        descricao: entry.descricao,
        valor_centavos: centsFromInput(entry.valor),
        data_competencia: entry.data_competencia,
        status: entry.status,
        observacao: entry.observacao,
      }
      await financeRequest('/api/produtora/financeiro', {
        method: entry.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      setMessage(entry.id ? 'Lançamento atualizado.' : 'Lançamento adicionado.')
      setEntry(emptyEntry(props.championshipId))
      setEntryOpen(false)
      await loadFinance()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao salvar lançamento.')
    } finally {
      setBusy(false)
    }
  }

  function editEntry(item: any) {
    setEntry({
      id: String(item.id || ''),
      tipo: item.tipo === 'receita' ? 'receita' : 'despesa',
      categoria: String(item.categoria || 'outros'),
      descricao: String(item.descricao || ''),
      valor: inputMoneyFromCents(item.valor_centavos),
      data_competencia: String(item.data_competencia || today()).slice(0, 10),
      status: ['previsto', 'cancelado'].includes(String(item.status)) ? item.status : 'realizado',
      campeonato_id: String(item.campeonato_id || ''),
      observacao: String(item.observacao || ''),
    })
    setEntryOpen(true)
  }

  async function removeEntry(item: any) {
    if (!window.confirm(`Remover o lançamento “${item.descricao}”?`)) return
    setBusy(true)
    setError('')
    try {
      await financeRequest(`/api/produtora/financeiro?lancamento_id=${encodeURIComponent(String(item.id))}`, { method: 'DELETE' })
      setMessage('Lançamento removido.')
      await loadFinance()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao remover lançamento.')
    } finally {
      setBusy(false)
    }
  }

  const summary = data?.resumo || {}
  const championshipRows = Array.isArray(data?.campeonatos) ? data.campeonatos : []
  const entries = Array.isArray(data?.lancamentos) ? data.lancamentos : []
  const sellers = Array.isArray(data?.vendedores) ? data.vendedores : []
  const progress = Math.min(100, Math.max(0, Number(summary.progresso_meta_receita_percentual || 0)))

  return (
    <section className={`producer-finance-manager ${scope === 'championship' ? 'is-championship' : ''}`}>
      <div className="producer-finance-toolbar">
        <div>
          <p className="eyebrow">{scope === 'championship' ? 'Financeiro do campeonato' : 'Financeiro gerencial'}</p>
          <h2>{selectedChampionship ? titleOfChampionship(selectedChampionship) : 'Visão financeira da produtora'}</h2>
          <span>Carteira é saldo. Aqui ficam desempenho, custos, metas e projeções.</span>
        </div>
        <div className="producer-finance-toolbar-actions">
          <label><CalendarRange size={15} /><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
          <button type="button" className="button secondary" disabled={loading} onClick={() => void loadFinance()}><RefreshCcw size={15} /> Atualizar</button>
          {scope === 'workspace' ? <a className="button secondary" href="/carteira"><WalletCards size={15} /> Carteira</a> : null}
        </div>
      </div>

      {error ? <div className="message error">{error}</div> : null}
      {message ? <div className="message success">{message}</div> : null}
      {loading ? <div className="producer-finance-loading"><Loader2 className="spin" size={20} /> Carregando dados financeiros…</div> : null}

      {!loading && data ? (
        <>
          <div className="producer-finance-kpis">
            <article><span><CircleDollarSign size={18} /></span><small>Receita bruta</small><strong>{money(summary.receita_bruta_centavos)}</strong><em>vendas + receitas manuais</em></article>
            <article><span><Banknote size={18} /></span><small>Receita líquida</small><strong>{money(summary.receita_liquida_centavos)}</strong><em>após comissões e plataforma</em></article>
            <article><span><ArrowDownRight size={18} /></span><small>Custos</small><strong>{money(summary.despesas_centavos)}</strong><em>despesas realizadas no mês</em></article>
            <article className={Number(summary.lucro_estimado_centavos || 0) < 0 ? 'is-negative' : 'is-positive'}><span><TrendingUp size={18} /></span><small>Lucro estimado</small><strong>{money(summary.lucro_estimado_centavos)}</strong><em>margem {percent(summary.margem_percentual)}</em></article>
          </div>

          <div className="producer-finance-secondary-kpis">
            <span><b>{summary.vagas_vendidas || 0}</b><small>vagas vendidas</small></span>
            <span><b>{money(summary.ticket_medio_centavos)}</b><small>ticket médio</small></span>
            <span><b>{money(summary.recebiveis_centavos)}</b><small>{summary.recebiveis_quantidade || 0} recebível(is)</small></span>
            <span><b>{money(summary.comissao_vendedores_centavos)}</b><small>comissões de vendedores</small></span>
            <span><b>{money(summary.taxa_plataforma_centavos)}</b><small>taxas da plataforma</small></span>
            <span><b>{money(summary.premiacao_comprometida_centavos)}</b><small>premiação comprometida</small></span>
          </div>

          <div className="producer-finance-plan-strip">
            <span><small>Receitas previstas</small><b>{money(summary.receitas_previstas_centavos)}</b></span>
            <span><small>Despesas previstas</small><b>{money(summary.despesas_previstas_centavos)}</b></span>
            <span><small>Lucro projetado</small><b>{money(summary.lucro_projetado_centavos)}</b></span>
          </div>

          {scope === 'workspace' ? (
            <section className="producer-finance-goal-card">
              <div className="producer-finance-goal-copy">
                <span className="producer-finance-goal-icon"><Target size={20} /></span>
                <div><p className="eyebrow">Meta mensal</p><h3>{period}</h3><small>{summary.meta_receita_centavos ? `${percent(summary.progresso_meta_receita_percentual)} da meta de faturamento` : 'Defina uma meta para acompanhar o mês.'}</small></div>
              </div>
              <div className="producer-finance-progress"><i style={{ width: `${progress}%` }} /></div>
              <div className="producer-finance-goal-form">
                <label><span>Receita alvo</span><input type="number" min="0" step="0.01" value={goalRevenue} onChange={(event) => setGoalRevenue(event.target.value)} placeholder="25000,00" /></label>
                <label><span>Lucro alvo</span><input type="number" min="0" step="0.01" value={goalProfit} onChange={(event) => setGoalProfit(event.target.value)} placeholder="8000,00" /></label>
                <label><span>Vagas alvo</span><input type="number" min="0" step="1" value={goalSeats} onChange={(event) => setGoalSeats(event.target.value)} placeholder="100" /></label>
                <button type="button" className="button" disabled={busy} onClick={() => void saveGoal()}><Target size={15} /> Salvar metas</button>
              </div>
            </section>
          ) : null}

          {scope === 'workspace' ? (
            <section className="producer-finance-block">
              <header><div><p className="eyebrow">Campeonatos</p><h3>Receita, custo e ocupação</h3></div><Trophy size={20} /></header>
              <div className="producer-finance-champ-list">
                {championshipRows.length === 0 ? <p className="empty">Nenhum campeonato neste workspace.</p> : null}
                {championshipRows.map((champ: any) => (
                  <article key={String(champ.id)}>
                    <div className="producer-finance-champ-name">{champ.logo_url ? <img src={champ.logo_url} alt="" /> : <Trophy size={17} />}<span><strong>{champ.nome}</strong><small>{champ.vagas_vendidas_total || 0}/{champ.vagas_total || '—'} vagas · {percent(champ.ocupacao_percentual)} ocupado</small></span></div>
                    <div><small>Bruto</small><b>{money(champ.receita_bruta_centavos)}</b></div>
                    <div><small>Líquido</small><b>{money(champ.receita_liquida_centavos)}</b></div>
                    <div><small>Custos</small><b>{money(champ.despesas_centavos)}</b></div>
                    <div><small>Lucro</small><b>{money(champ.lucro_estimado_centavos)}</b></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="producer-finance-block">
            <header>
              <div><p className="eyebrow">Lançamentos manuais</p><h3>Receitas e despesas fora do checkout</h3></div>
              <button type="button" className="button" onClick={() => { setEntry(emptyEntry(props.championshipId)); setEntryOpen((value) => !value) }}><Plus size={15} /> Novo lançamento</button>
            </header>
            {entryOpen ? (
              <div className="producer-finance-entry-form">
                <label><span>Tipo</span><select value={entry.tipo} onChange={(event) => setEntry((value) => ({ ...value, tipo: event.target.value as EntryForm['tipo'] }))}><option value="receita">Receita</option><option value="despesa">Despesa</option></select></label>
                <label><span>Categoria</span><select value={entry.categoria} onChange={(event) => setEntry((value) => ({ ...value, categoria: event.target.value }))}>{ENTRY_CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                {scope === 'workspace' ? <label><span>Campeonato</span><select value={entry.campeonato_id} onChange={(event) => setEntry((value) => ({ ...value, campeonato_id: event.target.value }))}><option value="">Produtora / geral</option>{props.championships.map((championship) => <option key={championship.id} value={championship.id}>{titleOfChampionship(championship)}</option>)}</select></label> : null}
                <label className="wide"><span>Descrição</span><input value={entry.descricao} onChange={(event) => setEntry((value) => ({ ...value, descricao: event.target.value }))} placeholder="Ex.: Patrocínio principal, narrador da final, servidor..." /></label>
                <label><span>Valor</span><input type="number" min="0.01" step="0.01" value={entry.valor} onChange={(event) => setEntry((value) => ({ ...value, valor: event.target.value }))} placeholder="0,00" /></label>
                <label><span>Competência</span><input type="date" value={entry.data_competencia} onChange={(event) => setEntry((value) => ({ ...value, data_competencia: event.target.value }))} /></label>
                <label><span>Status</span><select value={entry.status} onChange={(event) => setEntry((value) => ({ ...value, status: event.target.value as EntryForm['status'] }))}><option value="realizado">Realizado</option><option value="previsto">Previsto</option><option value="cancelado">Cancelado</option></select></label>
                <label className="wide"><span>Observação</span><input value={entry.observacao} onChange={(event) => setEntry((value) => ({ ...value, observacao: event.target.value }))} placeholder="Opcional" /></label>
                <div className="producer-finance-form-actions"><button type="button" className="button" disabled={busy} onClick={() => void saveEntry()}>{entry.id ? 'Salvar alteração' : 'Adicionar lançamento'}</button><button type="button" className="button secondary" onClick={() => { setEntry(emptyEntry(props.championshipId)); setEntryOpen(false) }}>Cancelar</button></div>
              </div>
            ) : null}
            <div className="producer-finance-entry-list">
              {entries.length === 0 ? <p className="empty">Nenhum lançamento manual neste mês.</p> : null}
              {entries.map((item: any) => {
                const champ = props.championships.find((championship) => championship.id === item.campeonato_id)
                return (
                  <article key={String(item.id)} className={`is-${item.tipo} ${item.status !== 'realizado' ? 'is-muted' : ''}`}>
                    <span className="producer-finance-entry-icon">{item.tipo === 'receita' ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}</span>
                    <div><strong>{item.descricao}</strong><small>{CATEGORY_LABELS[item.categoria] || item.categoria} · {champ ? titleOfChampionship(champ) : 'Produtora'} · {String(item.data_competencia).split('-').reverse().join('/')} · {item.status}</small></div>
                    <b>{item.tipo === 'receita' ? '+' : '-'} {money(item.valor_centavos)}</b>
                    <button type="button" title="Editar" onClick={() => editEntry(item)}><Pencil size={15} /></button>
                    <button type="button" title="Remover" disabled={busy} onClick={() => void removeEntry(item)}><Trash2 size={15} /></button>
                  </article>
                )
              })}
            </div>
          </section>

          {scope === 'workspace' ? (
            <section className="producer-finance-grid-two">
              <article className="producer-finance-block">
                <header><div><p className="eyebrow">Comercial</p><h3>Desempenho dos vendedores</h3></div><Users size={20} /></header>
                <div className="producer-finance-seller-list">
                  {sellers.length === 0 ? <p className="empty">Nenhuma venda com vendedor neste mês.</p> : null}
                  {sellers.slice(0, 8).map((seller: any, index: number) => <div key={seller.manager_id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{seller.nome}</strong><small>{seller.vagas} vaga(s) · {seller.vendas} venda(s)</small><b>{money(seller.bruto)}</b></div>)}
                </div>
              </article>
              <article className="producer-finance-block producer-finance-notes">
                <header><div><p className="eyebrow">Leitura rápida</p><h3>O que cada número significa</h3></div><BadgeDollarSign size={20} /></header>
                <p><CreditCard size={15} /><span><b>Receita bruta</b> inclui o valor total das vendas confirmadas e receitas manuais realizadas.</span></p>
                <p><CircleDollarSign size={15} /><span><b>Receita líquida</b> desconta comissão do vendedor e taxa da plataforma nas vendas online.</span></p>
                <p><TrendingUp size={15} /><span><b>Lucro projetado</b> soma lançamentos marcados como previstos ao resultado já realizado no mês.</span></p>
                <p><CreditCard size={15} /><span><b>Recebíveis</b> contam cobranças de vagas realmente geradas e ainda pendentes ou aguardando pagamento.</span></p>
                <p><Trophy size={15} /><span><b>Premiação comprometida</b> vem da configuração dos campeonatos e aparece separada dos custos realizados.</span></p>
              </article>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
