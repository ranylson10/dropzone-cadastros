'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Filter, MapPin, Search, Ticket, Users, X, ZoomIn } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { BuyVacancyModal } from '@/features/billing/BuyVacancyModal'
import { supabase } from '@/lib/supabase-browser'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import './vagas.css'

function dateLabel(value?: string | null) {
  if (!value) return 'Data a confirmar'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function money(value: unknown) {
  const number = Number(value)
  return number > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number) : 'Consultar'
}

export default function VacanciesPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const [sellerFilter, setSellerFilter] = useState('')
  const [query, setQuery] = useState('')
  const [buyTarget, setBuyTarget] = useState<any | null>(null)
  const [preview, setPreview] = useState<any | null>(null)
  const [gate, setGate] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      setAuthenticated(Boolean(token))
      const response = await fetch('/api/vagas', { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setItems(payload.announcements || [])
    } catch (cause: any) {
      setError(cause.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      const guest = sessionStorage.getItem('dropzone_vagas_guest') === '1'
      setGate(!data.session && !guest)
      await load()
    })()
  }, [])

  const sellerOptions = useMemo(() => {
    const sellers = new Map<string, string>()
    for (const item of items) for (const seller of item.vendedores || []) if (seller.id) sellers.set(seller.id, seller.nome || 'Vendedor')
    return Array.from(sellers.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [items])

  const visible = useMemo(() => items.filter((item) =>
    (filter === 'all' || item.ja_tem_vaga)
    && (!sellerFilter || (item.vendedores || []).some((seller: any) => seller.id === sellerFilter))
    && `${item.nome} ${item.tipo} ${item.proximo_grupo} ${item.servidor}`.toLowerCase().includes(query.toLowerCase())), [items, filter, query, sellerFilter])

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
    <AppShell activeLabel="Vagas abertas" loadSession mainClassName="vacancies-page page">
      <section className="vacancies-hero">
        <div>
          <p className="eyebrow">Agenda competitiva</p>
          <h1>Campeonatos com vagas abertas</h1>
          <p>Pague com PIX ou fale com a organização no WhatsApp para garantir sua vaga.</p>
        </div>
        <div className="vacancies-hero-count"><Ticket /><strong>{items.reduce((sum, item) => sum + item.vagas_livres, 0)}</strong><span>vagas disponíveis</span></div>
      </section>

      <section className="vacancies-toolbar">
        <div className="vacancies-filter"><Filter size={15} /><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Campeonatos gerais</button><button className={filter === 'mine' ? 'active' : ''} onClick={() => authenticated ? setFilter('mine') : setGate(true)}>Meus campeonatos</button></div>
        <select value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)} aria-label="Filtrar por vendedor">
          <option value="">Todos os vendedores</option>
          {sellerOptions.map((seller) => <option key={seller.id} value={seller.id}>{seller.nome}</option>)}
        </select>
        <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar campeonato" /></label>
      </section>

      {error ? <div className="admin-feedback error">{error}</div> : null}
      {loading ? <DropzoneLoader compact label="Buscando vagas" /> : (
        <section className="vacancies-grid">
          {visible.map((item) => <article className="vacancy-card" key={item.id}>
            <button className="vacancy-banner" type="button" onClick={() => setPreview(item)} aria-label={`Ampliar banner de ${item.nome}`}>
              <img src={item.banner_url} alt={`Banner ${item.nome}`} />
              <span className="vacancy-zoom-label"><ZoomIn size={14} /> Ver banner</span>
              {item.ja_tem_vaga ? <span className="vacancy-enrolled"><CheckCircle2 size={14} /> Sua equipe já tem vaga</span> : null}
            </button>
            <div className="vacancy-card-body">
              <header>{item.logo_url ? <img src={item.logo_url} alt="" /> : null}<div><p>{item.tipo}</p><h2>{item.nome}</h2></div></header>
              <div className="vacancy-next-date"><CalendarDays /><div><small>Próxima vaga</small><strong>{dateLabel(item.proxima_data)} {item.proximo_horario ? `· ${String(item.proximo_horario).slice(0, 5)}h` : ''}</strong><span>{item.proximo_grupo}</span></div></div>
              <div className="vacancy-meta"><span><Users size={14} /><b>{item.vagas_livres}</b> vagas</span><span><Ticket size={14} /><b>{money(item.valor_inscricao)}</b></span>{item.servidor ? <span><MapPin size={14} />{item.servidor}</span> : null}</div>
              <div className="vacancy-groups">{item.grupos.slice(0, 3).map((group: any) => <span key={group.id}>{group.nome}<b>{group.vagas_livres} livres</b></span>)}</div>
              <div className="vacancy-persuasion">
                <strong>Garanta sua vaga</strong>
                <span>Pague com PIX ou fale no WhatsApp da organização.</span>
              </div>
              <button className="button vacancy-register" type="button" onClick={() => openBuyModal(item)}>
                Quero me inscrever
              </button>
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
          returnTo="/vagas"
          authenticated={authenticated}
          onClose={() => setBuyTarget(null)}
          onRequireLogin={() => setGate(true)}
        />
      ) : null}

      {gate ? <div className="vacancies-access-gate"><section><button className="gate-close" onClick={continueAsGuest}><X size={18} /></button><img src="/dropzone-icon.png" alt="" /><p className="eyebrow">Vagas abertas</p><h2>Como deseja continuar?</h2><p>Entre para pagar online e identificar campeonatos em que sua equipe já possui vaga.</p><SocialLogin returnTo="/vagas" /><button className="continue-guest" onClick={continueAsGuest}>Continuar sem login</button></section></div> : null}
    </AppShell>
  )
}
