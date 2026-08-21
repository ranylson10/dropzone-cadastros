'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, Filter, Flame, Gift, MapPin, Radio, Search, Ticket, Users, X, ZoomIn } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { BuyVacancyModal } from '@/features/billing/BuyVacancyModal'
import { supabase } from '@/lib/supabase-browser'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import './vagas.css'

type VacancyFilter = 'all' | 'mine' | 'today' | 'free' | 'live' | 'prize' | 'last'

function dateLabel(value?: string | null) {
  if (!value) return 'Data a confirmar'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function money(value: unknown) {
  const number = Number(value)
  return number > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number) : 'Grátis'
}

function vacancyRatio(item: any) {
  return Math.max(6, Math.min(100, (Number(item.vagas_livres || 0) / Math.max(1, Number(item.total_vagas || 1))) * 100))
}

function hasPrize(item: any) {
  return Boolean(item.premiacao || item.descricao_premiacao)
}

export default function VacanciesPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<VacancyFilter>('all')
  const [sellerFilter, setSellerFilter] = useState('')
  const [query, setQuery] = useState('')
  const [buyTarget, setBuyTarget] = useState<any | null>(null)
  const [preview, setPreview] = useState<any | null>(null)
  const [gate, setGate] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [scope, setScope] = useState<any | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      setAuthenticated(Boolean(token))
      const params = new URLSearchParams(window.location.search)
      const catalog = new URLSearchParams()
      if (params.get('produtora')) catalog.set('produtora', String(params.get('produtora')))
      if (params.get('vendedor')) catalog.set('vendedor', String(params.get('vendedor')))
      const response = await fetch(`/api/vagas${catalog.size ? `?${catalog}` : ''}`, { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setItems(payload.announcements || [])
      setScope(payload.scope || null)
    } catch (cause: any) {
      setError(cause.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!items.length || buyTarget) return
    const championshipId = new URLSearchParams(window.location.search).get('comprar')
    if (!championshipId) return
    const target = items.find((item) => String(item.id) === championshipId)
    if (target) setBuyTarget(target)
  }, [items, buyTarget])

  const sellerOptions = useMemo(() => {
    const sellers = new Map<string, string>()
    for (const item of items) for (const seller of item.vendedores || []) if (seller.id) sellers.set(seller.id, seller.nome || 'Vendedor')
    return Array.from(sellers.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [items])

  const today = new Date().toISOString().slice(0, 10)
  const visible = useMemo(() => items.filter((item) => {
    const matchesFilter =
      filter === 'all'
      || (filter === 'mine' && item.ja_tem_vaga)
      || (filter === 'today' && item.proxima_data === today)
      || (filter === 'free' && Number(item.valor_inscricao || 0) <= 0)
      || (filter === 'live' && item.tem_live)
      || (filter === 'prize' && hasPrize(item))
      || (filter === 'last' && Number(item.vagas_livres || 0) > 0 && Number(item.vagas_livres || 0) <= 3)
    return matchesFilter
      && (!sellerFilter || (item.vendedores || []).some((seller: any) => seller.id === sellerFilter))
      && `${item.nome} ${item.tipo} ${item.proximo_grupo} ${item.servidor} ${item.plataforma || ''}`.toLowerCase().includes(query.toLowerCase())
  }).sort((a, b) => {
    if (filter === 'last') return Number(a.vagas_livres || 0) - Number(b.vagas_livres || 0)
    return 0
  }), [items, filter, query, sellerFilter, today])

  const returnTo = typeof window === 'undefined' ? '/vagas' : `${window.location.pathname}${window.location.search}`

  function closeBuyModal() {
    setBuyTarget(null)
    const url = new URL(window.location.href)
    if (url.searchParams.has('comprar')) {
      url.searchParams.delete('comprar')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  function openBuyModal(item: any) {
    if (!sellerFilter) {
      setBuyTarget(item)
      return
    }
    const seller = (item.vendedores || []).find((entry: any) => entry.id === sellerFilter)
    if (seller?.contato?.url) {
      setBuyTarget({
        ...item,
        contatos_whatsapp: [seller.contato],
        _vendedor_manager_id: seller.id,
      })
      return
    }
    setBuyTarget({ ...item, _vendedor_manager_id: seller?.id || sellerFilter })
  }

  function continueAsGuest() {
    sessionStorage.setItem('dropzone_vagas_guest', '1')
    setGate(false)
  }

  return (
    <AppShell activeLabel="Vagas abertas" loadSession mainClassName={`vacancies-page page ${scope ? 'is-scoped' : ''}`}>
      <section className="vacancies-hero">
        <div>
          <p className="eyebrow">{scope?.tipo === 'vendedor' ? 'Seleção do vendedor' : scope?.tipo === 'produtora' ? 'Eventos da produtora' : 'Agenda competitiva'}</p>
          <h1>{scope ? `Vagas abertas · ${scope.nome}` : 'Campeonatos com vagas abertas'}</h1>
          <p>Escolha seu campeonato, veja as vagas reais da fase de entrada e garanta a vaga da sua equipe.</p>
        </div>
        {scope?.logo_url ? <img className="vacancies-scope-logo" src={scope.logo_url} alt="" /> : null}
        <div className="vacancies-hero-count"><Ticket /><strong>{items.reduce((sum, item) => sum + Number(item.vagas_livres || 0), 0)}</strong><span>vagas disponíveis</span></div>
      </section>

      <section className={`vacancies-toolbar ${scope ? 'scoped-toolbar' : ''}`}>
        {!scope ? (
          <div className="vacancies-filter">
            <Filter size={15} />
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos</button>
            <button className={filter === 'today' ? 'active' : ''} onClick={() => setFilter('today')}>Hoje</button>
            <button className={filter === 'free' ? 'active' : ''} onClick={() => setFilter('free')}>Grátis</button>
            <button className={filter === 'live' ? 'active' : ''} onClick={() => setFilter('live')}>Com live</button>
            <button className={filter === 'prize' ? 'active' : ''} onClick={() => setFilter('prize')}>Premiação</button>
            <button className={filter === 'last' ? 'active' : ''} onClick={() => setFilter('last')}>Últimas vagas</button>
            <button className={filter === 'mine' ? 'active' : ''} onClick={() => authenticated ? setFilter('mine') : setGate(true)}>Meus</button>
          </div>
        ) : <strong>{visible.length} {visible.length === 1 ? 'campeonato disponível' : 'campeonatos disponíveis'}</strong>}
        {!scope ? <select value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)} aria-label="Filtrar por vendedor">
          <option value="">Todos os vendedores</option>
          {sellerOptions.map((seller) => <option key={seller.id} value={seller.id}>{seller.nome}</option>)}
        </select> : null}
        <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar campeonato" /></label>
      </section>

      {error ? <div className="admin-feedback error">{error}</div> : null}
      {loading ? <DropzoneLoader compact label="Buscando vagas" /> : (
        <section className="vacancies-grid">
          {visible.map((item) => <article className="vacancy-card" key={item.id}>
            <button className="vacancy-banner" type="button" onClick={() => setPreview(item)} aria-label={`Ampliar banner de ${item.nome}`}>
              <img src={item.banner_url} alt={`Banner ${item.nome}`} />
              <span className="vacancy-type-badge">{item.tipo || 'Campeonato'}</span>
              <span className="vacancy-banner-badges">
                {item.tem_live ? <b><Radio size={12} /> Live</b> : null}
                {hasPrize(item) ? <b><Gift size={12} /> Prêmio</b> : null}
                {Number(item.vagas_livres || 0) <= 3 ? <b className="hot"><Flame size={12} /> Últimas</b> : null}
              </span>
              <span className="vacancy-zoom-label"><ZoomIn size={14} /> Ver banner</span>
              {item.ja_tem_vaga ? <span className="vacancy-enrolled"><CheckCircle2 size={14} /> Sua equipe já tem vaga</span> : null}
            </button>
            <div className="vacancy-card-body">
              <header>{item.logo_url ? <img src={item.logo_url} alt="" /> : null}<div><p>{item.tipo}</p><h2>{item.nome}</h2></div></header>
              <div className="vacancy-next-date"><CalendarDays /><div><small>Próxima vaga</small><strong>{dateLabel(item.proxima_data)} {item.proximo_horario ? `· ${String(item.proximo_horario).slice(0, 5)}h` : ''}</strong><span>{item.proximo_grupo}</span></div></div>
              <div className="vacancy-sale-line">
                <span><b>{item.vagas_livres}</b> de {item.total_vagas} vagas reais</span>
                <i><em style={{ width: `${vacancyRatio(item)}%` }} /></i>
              </div>
              <div className="vacancy-meta"><span><Users size={14} /><b>{item.vagas_livres}</b> vagas</span><span><Ticket size={14} /><b>{money(item.valor_inscricao)}</b></span>{item.servidor ? <span><MapPin size={14} />{item.servidor}</span> : null}</div>
              {(hasPrize(item) || item.tem_live) ? <div className="vacancy-commercial-badges">
                {item.tem_live ? <span><Radio size={13} /> Transmissão ao vivo</span> : null}
                {item.premiacao ? <span><Gift size={13} /> Premiação {money(item.premiacao)}</span> : item.descricao_premiacao ? <span><Gift size={13} /> Premiação informada</span> : null}
              </div> : null}
              <div className="vacancy-groups">{(item.grupos || []).slice(0, 3).map((group: any) => <span key={group.id}>{group.nome}<b>{group.vagas_livres} livres</b></span>)}</div>
              <div className="vacancy-persuasion">
                <strong>Garanta sua vaga</strong>
                <span>Compra segura, vaga liberada e inscrição guiada pelo sistema.</span>
              </div>
              <button className="button vacancy-register" type="button" onClick={() => openBuyModal(item)}>
                Garantir minha vaga <ArrowRight size={15} />
              </button>
              <a className="vacancy-details-link" href={`/campeonatos/${item.id}`}>Ver detalhes do campeonato</a>
            </div>
          </article>)}
          {visible.length === 0 ? <div className="vacancies-empty"><Ticket size={32} /><strong>Nenhuma vaga encontrada</strong><span>Tente outro filtro ou volte mais tarde.</span></div> : null}
        </section>
      )}

      {preview ? <div className="vacancy-preview-overlay" onClick={() => setPreview(null)}><button onClick={() => setPreview(null)} aria-label="Fechar banner"><X size={21} /></button><figure onClick={(event) => event.stopPropagation()}><img src={preview.banner_url} alt={`Banner completo de ${preview.nome}`} /><figcaption>{preview.nome}</figcaption></figure></div> : null}

      {buyTarget ? (
        <BuyVacancyModal
          championship={{
            id: buyTarget.id,
            nome: buyTarget.nome,
            valor_inscricao: buyTarget.valor_inscricao,
            contatos_whatsapp: buyTarget.contatos_whatsapp || [],
            proximo_grupo: buyTarget.proximo_grupo,
          }}
          vendedorManagerId={buyTarget._vendedor_manager_id || sellerFilter || null}
          returnTo={returnTo}
          authenticated={authenticated}
          onClose={closeBuyModal}
          onRequireLogin={() => setGate(true)}
        />
      ) : null}

      {gate ? <div className="vacancies-access-gate"><section><button className="gate-close" onClick={continueAsGuest}><X size={18} /></button><img src="/dropzone-icon.png" alt="" /><p className="eyebrow">Identificar sua equipe</p><h2>Entre para continuar</h2><p>O login é necessário somente para pagar online ou consultar vagas da sua equipe.</p><SocialLogin profileType="equipe" returnTo={returnTo} /><button className="continue-guest" onClick={continueAsGuest}>Voltar aos campeonatos</button></section></div> : null}
    </AppShell>
  )
}
