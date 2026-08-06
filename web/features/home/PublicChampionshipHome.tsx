'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, Filter, Flame, Search, ShieldCheck, Sparkles, Ticket, Trophy, Users } from 'lucide-react'
import { SystemLogo } from '@/components/brand/SystemLogo'

type Vacancy = {
  id: string
  nome: string
  tipo?: string
  logo_url?: string | null
  banner_url?: string | null
  valor_inscricao?: number | string | null
  plataforma?: string | null
  servidor?: string | null
  vagas_livres?: number
  total_vagas?: number
  proxima_data?: string | null
  proximo_horario?: string | null
}

type Props = { onAccess: () => void }

function money(value: Vacancy['valor_inscricao']) {
  const amount = Number(value || 0)
  return amount <= 0 ? 'Grátis' : amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dateLabel(value?: string | null) {
  if (!value) return 'Data a confirmar'
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(date)
}

export function PublicChampionshipHome({ onAccess }: Props) {
  const [items, setItems] = useState<Vacancy[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'todos' | 'hoje' | 'gratis' | 'ultimas'>('todos')

  useEffect(() => {
    let active = true
    fetch('/api/vagas', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => { if (active) setItems(Array.isArray(data.announcements) ? data.announcements : []) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = !query.trim() || `${item.nome} ${item.tipo || ''} ${item.plataforma || ''}`.toLowerCase().includes(query.trim().toLowerCase())
    if (!matchesQuery) return false
    if (filter === 'hoje') return item.proxima_data === today
    if (filter === 'gratis') return Number(item.valor_inscricao || 0) <= 0
    if (filter === 'ultimas') return Number(item.vagas_livres || 0) <= 3
    return true
  }), [items, query, filter, today])

  const featured = filtered[0] || items[0]
  const urgent = items.filter((item) => Number(item.vagas_livres || 0) > 0 && Number(item.vagas_livres || 0) <= 3).slice(0, 4)

  return (
    <main className="public-home">
      <header className="public-home-header">
        <a className="public-home-brand" href="/" aria-label="DropZone início"><SystemLogo size={42} alt="DropZone" /><span><b>DropZone</b><small>Campeonatos</small></span></a>
        <nav className="public-home-nav" aria-label="Navegação principal"><a href="#vagas">Vagas</a><a href="#tipos">Categorias</a><a href="/campeonatos">Resultados</a></nav>
        <button type="button" className="public-home-access" onClick={onAccess}>Entrar <ArrowRight size={16} /></button>
      </header>

      <section className="public-home-hero">
        <div className="public-home-hero-copy home-reveal">
          <span className="home-kicker"><Sparkles size={15} /> Sua próxima queda começa aqui</span>
          <h1>Encontre campeonatos, garanta sua vaga e jogue hoje.</h1>
          <p>Vagas abertas, horários, premiações e inscrições reunidos em uma experiência rápida para equipe, jogador e produtora.</p>
          <div className="public-home-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar campeonato, tipo ou plataforma" /><button type="button" onClick={() => document.querySelector('#vagas')?.scrollIntoView({ behavior: 'smooth' })}>Buscar</button></div>
          <div className="public-home-trust"><span><ShieldCheck size={16} /> Campeonatos aprovados</span><span><Ticket size={16} /> Compra segura</span><span><Clock3 size={16} /> Vagas em tempo real</span></div>
        </div>

        <div className="featured-championship home-reveal home-delay-1">
          {featured ? <>
            <div className="featured-media" style={featured.banner_url ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(10,13,18,.9)), url(${featured.banner_url})` } : undefined}>
              <span className="featured-badge"><Flame size={14} /> Destaque</span>
              <div className="featured-title">{featured.logo_url ? <img src={featured.logo_url} alt="" /> : <Trophy size={28} />}<div><small>{featured.tipo || 'Campeonato'}</small><strong>{featured.nome}</strong></div></div>
            </div>
            <div className="featured-details"><span><CalendarDays size={15} /> {dateLabel(featured.proxima_data)}</span><span><Clock3 size={15} /> {featured.proximo_horario || 'Horário a confirmar'}</span><span><Users size={15} /> {featured.vagas_livres || 0} vagas</span></div>
            <div className="featured-cta"><div><small>A partir de</small><strong>{money(featured.valor_inscricao)}</strong></div><a href={`/vagas?comprar=${featured.id}`}>Garantir vaga <ArrowRight size={16} /></a></div>
          </> : <div className="featured-empty"><Trophy size={34} /><strong>Novos campeonatos em breve</strong><span>Entre no sistema para acompanhar suas inscrições.</span></div>}
        </div>
      </section>

      <section className="home-stat-strip home-reveal home-delay-2">
        <div><b>{items.length}</b><span>campeonatos com vagas</span></div><div><b>{items.reduce((sum, item) => sum + Number(item.vagas_livres || 0), 0)}</b><span>vagas disponíveis</span></div><div><b>{items.filter((item) => Number(item.valor_inscricao || 0) <= 0).length}</b><span>eventos gratuitos</span></div>
      </section>

      <section id="vagas" className="public-home-section">
        <div className="public-section-head"><div><span className="home-kicker">Vitrine de campeonatos</span><h2>Vagas abertas</h2></div><a href="/vagas">Ver todas <ArrowRight size={15} /></a></div>
        <div className="home-filter-row"><Filter size={16} />{([['todos','Todos'],['hoje','Hoje'],['gratis','Gratuitos'],['ultimas','Últimas vagas']] as const).map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
        {loading ? <div className="home-card-grid">{Array.from({ length: 4 }).map((_, index) => <div className="home-card-skeleton" key={index}><i /><b /><span /><span /></div>)}</div> : filtered.length ? <div className="home-card-grid">{filtered.slice(0, 8).map((item, index) => <article className="home-champ-card home-reveal" style={{ animationDelay: `${Math.min(index, 5) * 70}ms` }} key={item.id}>
          <div className="home-champ-media" style={item.banner_url ? { backgroundImage: `linear-gradient(180deg, transparent 30%, rgba(10,13,18,.88)), url(${item.banner_url})` } : undefined}><span>{item.tipo || 'Campeonato'}</span>{item.logo_url ? <img src={item.logo_url} alt="" /> : <Trophy size={25} />}</div>
          <div className="home-champ-content"><h3>{item.nome}</h3><div className="home-champ-meta"><span><CalendarDays size={14} /> {dateLabel(item.proxima_data)}</span><span><Clock3 size={14} /> {item.proximo_horario || '--:--'}</span></div><div className="home-vacancy-line"><span>{item.vagas_livres || 0} de {item.total_vagas || 0} vagas livres</span><i><em style={{ width: `${Math.max(8, Math.min(100, (Number(item.vagas_livres || 0) / Math.max(1, Number(item.total_vagas || 1))) * 100))}%` }} /></i></div><footer><strong>{money(item.valor_inscricao)}</strong><a href={`/vagas?comprar=${item.id}`}>Ver vaga <ArrowRight size={14} /></a></footer></div>
        </article>)}</div> : <div className="home-empty-state"><Search size={30} /><strong>Nenhum campeonato encontrado</strong><span>Tente outro filtro ou termo de busca.</span></div>}
      </section>

      {urgent.length ? <section className="public-home-section home-urgent-section"><div className="public-section-head"><div><span className="home-kicker"><Flame size={14} /> Quase lotando</span><h2>Últimas vagas</h2></div></div><div className="urgent-list">{urgent.map((item) => <a href={`/vagas?comprar=${item.id}`} key={item.id}><span>{item.logo_url ? <img src={item.logo_url} alt="" /> : <Trophy size={20} />}</span><div><strong>{item.nome}</strong><small>{dateLabel(item.proxima_data)} · {item.proximo_horario || 'horário a confirmar'}</small></div><b>{item.vagas_livres} restantes</b><ArrowRight size={17} /></a>)}</div></section> : null}

      <section id="tipos" className="public-home-section home-categories"><div className="public-section-head"><div><span className="home-kicker">Encontre seu formato</span><h2>Jogue do seu jeito</h2></div></div><div className="category-grid">{[['Diário','Partidas rápidas todos os dias'],['Copa','Eliminatórias e grandes finais'],['Liga','Temporadas e classificação'],['Xtreino','Treino competitivo organizado']].map(([title,text]) => <button key={title} onClick={() => { setQuery(title); document.querySelector('#vagas')?.scrollIntoView({ behavior: 'smooth' }) }}><Trophy size={20} /><strong>{title}</strong><span>{text}</span><ArrowRight size={16} /></button>)}</div></section>

      <section className="home-how"><div><span className="home-kicker">Simples do início ao fim</span><h2>Escolha, garanta e jogue</h2></div><ol><li><b>1</b><span><strong>Encontre</strong><small>Use data, valor e formato.</small></span></li><li><b>2</b><span><strong>Garanta a vaga</strong><small>Inscrição rápida e segura.</small></span></li><li><b>3</b><span><strong>Acompanhe</strong><small>Escalação, grupos e jogos.</small></span></li></ol><button type="button" onClick={onAccess}>Acessar meu painel <ArrowRight size={16} /></button></section>

      <footer className="public-home-footer"><div className="public-home-brand"><SystemLogo size={34} alt="DropZone" /><span><b>DropZone</b><small>Onde campeonatos acontecem</small></span></div><span>© 2026 DropZone</span></footer>
    </main>
  )
}
