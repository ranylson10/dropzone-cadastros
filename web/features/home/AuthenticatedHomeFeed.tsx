'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  Clock3,
  Flame,
  Gamepad2,
  Gift,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react'
import type { DropZoneRow, ProfileType } from '@/lib/types'
import { VacancyCard, VacancyPreview, vacancyDateLabel, vacancyMoney, type VacancyCatalogItem } from '@/features/vacancies/VacancyCard'
import './authenticated-home.css'

type Vacancy = VacancyCatalogItem

type Props = {
  account: DropZoneRow | null
  accounts: DropZoneRow[]
  onOpenPanel: (target?: DropZoneRow) => void | Promise<void>
}

type HomeNotification = {
  id: string
  tipo: string
  titulo: string
  corpo?: string | null
  status: string
  acao_url?: string | null
  payload?: { public_url?: string | null; expira_em?: string | null; data_jogo?: string | null; horario?: string | null }
}

type AgendaItem = {
  id: string
  titulo: string
  data: string
  horario_inicio: string
  horario_fim?: string | null
  meta?: { campeonato_nome?: string | null; equipe_nome?: string | null; href?: string | null }
}

type LineupSummary = {
  campeonato_equipe_id: string
  campeonato_nome?: string | null
  jogadores_confirmados?: number | null
  limite_jogadores?: number | null
  link_expira_em?: string | null
}

type HomeTask = { id: string; title: string; detail: string; href?: string; urgent?: boolean }

function prizeNumber(item: Vacancy) {
  const value = Number(item.premiacao || 0)
  return Number.isFinite(value) ? value : 0
}

function priceNumber(item: Vacancy) {
  const value = Number(item.valor_inscricao || 0)
  return Number.isFinite(value) ? value : 0
}

function marketHref(params: Record<string, string>) {
  const search = new URLSearchParams(params)
  return `/campeonatos?${search.toString()}`
}

export function AuthenticatedHomeFeed({ account, accounts, onOpenPanel }: Props) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(true)
  const [notifications, setNotifications] = useState<HomeNotification[]>([])
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [priorityLoading, setPriorityLoading] = useState(Boolean(account))
  const [lineups, setLineups] = useState<LineupSummary[]>([])
  const [tokenValue, setTokenValue] = useState('')
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [marketQuery, setMarketQuery] = useState('')
  const [vacancyPreview, setVacancyPreview] = useState<VacancyCatalogItem | null>(null)

  const producer = accounts.find((item) => item.profile_type === 'produtora')
  const isPlayer = account?.profile_type === 'jogador'
  const isTeam = account?.profile_type === 'equipe'
  const isProducer = account?.profile_type === 'produtora'
  const isManager = account?.profile_type === 'manager'

  useEffect(() => {
    let active = true
    fetch('/api/vagas', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return
        const items = Array.isArray(data.announcements) ? data.announcements : []
        setVacancies(items.filter((item: Vacancy) => Number(item.vagas_livres || 0) > 0).slice(0, 24))
      })
      .catch(() => { if (active) setVacancies([]) })
      .finally(() => { if (active) setLoadingVacancies(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!account) {
      setPriorityLoading(false)
      return
    }
    let active = true
    ;(async () => {
      try {
        const { supabase } = await import('@/lib/supabase-browser')
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        const headers = { Authorization: `Bearer ${token}` }
        const [notificationsResponse, agendaResponse, lineupsResponse] = await Promise.all([
          fetch('/api/notificacoes?limit=12', { headers, cache: 'no-store' }),
          fetch('/api/agenda?scope=me&year=2026&month=1&from=2000-01-01&to=2100-12-31', { headers, cache: 'no-store' }),
          fetch('/api/equipe/escalacoes', { headers, cache: 'no-store' }),
        ])
        const notificationsJson = await notificationsResponse.json().catch(() => ({}))
        const agendaJson = await agendaResponse.json().catch(() => ({}))
        const lineupsJson = lineupsResponse.ok ? await lineupsResponse.json().catch(() => ({})) : {}
        if (!active) return
        setNotifications(Array.isArray(notificationsJson.items) ? notificationsJson.items : [])
        setAgenda(Array.isArray(agendaJson.items) ? agendaJson.items : [])
        setLineups(Array.isArray(lineupsJson.escalacoes) ? lineupsJson.escalacoes : [])
      } finally {
        if (active) setPriorityLoading(false)
      }
    })()
    return () => { active = false }
  }, [account])

  const nextAgendaItem = useMemo(() => {
    const now = new Date()
    return agenda
      .filter((item) => new Date(`${item.data}T${item.horario_inicio || '00:00'}:00`) >= now)
      .sort((a, b) => `${a.data} ${a.horario_inicio}`.localeCompare(`${b.data} ${b.horario_inicio}`))[0] || null
  }, [agenda])

  const homeTasks = useMemo<HomeTask[]>(() => {
    const now = Date.now()
    const tasks: HomeTask[] = []
    for (const lineup of lineups) {
      const required = Math.max(1, Number(lineup.limite_jogadores || 0))
      const confirmed = Number(lineup.jogadores_confirmados || 0)
      if (confirmed >= required) continue
      const deadline = lineup.link_expira_em ? new Date(lineup.link_expira_em).getTime() : null
      const hours = deadline ? Math.ceil((deadline - now) / 3_600_000) : null
      if (deadline && hours != null && hours < 0) continue
      tasks.push({
        id: `lineup-${lineup.campeonato_equipe_id}`,
        title: `Completar escalação · ${lineup.campeonato_nome || 'campeonato'}`,
        detail: hours == null ? `${confirmed}/${required} jogadores confirmados.` : `${confirmed}/${required} jogadores · prazo em ${Math.max(1, hours)}h.`,
        href: '/?painel=1&section=jogadores',
        urgent: hours != null && hours <= 24,
      })
    }
    for (const notification of notifications.filter((item) => item.status === 'nao_lida').slice(0, 3)) {
      tasks.push({
        id: `notification-${notification.id}`,
        title: notification.titulo,
        detail: notification.corpo || 'Há uma ação aguardando você.',
        href: notification.acao_url || notification.payload?.public_url || '/agenda',
        urgent: /prazo|escala|convite/i.test(`${notification.titulo} ${notification.corpo || ''}`),
      })
    }
    return tasks.slice(0, 4)
  }, [lineups, notifications])

  const featured = useMemo(() => {
    const withBanner = vacancies.filter((item) => item.banner_url)
    return [...(withBanner.length ? withBanner : vacancies)]
      .sort((a, b) => prizeNumber(b) - prizeNumber(a) || Number(a.vagas_livres || 0) - Number(b.vagas_livres || 0))[0] || null
  }, [vacancies])

  const showcase = useMemo(() => vacancies.filter((item) => item.id !== featured?.id).slice(0, 8), [featured?.id, vacancies])
  const lastVacancies = useMemo(() => vacancies.filter((item) => Number(item.vagas_livres || 0) > 0 && Number(item.vagas_livres || 0) <= 4).slice(0, 4), [vacancies])
  const biggestPrizes = useMemo(() => [...vacancies].sort((a, b) => prizeNumber(b) - prizeNumber(a)).filter((item) => prizeNumber(item) > 0).slice(0, 4), [vacancies])

  const createChampionship = () => {
    if (!producer) return
    const url = new URL(window.location.href)
    url.searchParams.set('acao', 'criar-campeonato')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    void onOpenPanel(producer)
  }

  const submitMarketSearch = (event: FormEvent) => {
    event.preventDefault()
    const clean = marketQuery.trim()
    window.location.assign(clean ? `/campeonatos?q=${encodeURIComponent(clean)}` : '/campeonatos')
  }

  const submitToken = async () => {
    const raw = tokenValue.trim()
    if (!raw) return
    const urlMatch = raw.match(/\/(convite\/equipe|convite\/grupo|equipe\/entrar|escala|i|vagas\/compra)\/([^/?#]+)/i)
    if (urlMatch) {
      window.location.assign(`/${urlMatch[1].toLowerCase()}/${encodeURIComponent(decodeURIComponent(urlMatch[2]))}`)
      return
    }
    setTokenBusy(true)
    setTokenError('')
    try {
      const response = await fetch(`/api/convites/resolver/${encodeURIComponent(raw.replace(/\s/g, ''))}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.href) throw new Error(payload.error || 'Token não reconhecido.')
      window.location.assign(String(payload.href))
    } catch (error: any) {
      setTokenError(error?.message || 'Confira o token ou cole o link completo.')
    } finally {
      setTokenBusy(false)
    }
  }

  const accountAction = account
    ? isProducer
      ? { label: 'Painel da produtora', detail: 'Campeonatos, financeiro e equipe', icon: LayoutDashboard, action: () => void onOpenPanel(account) }
      : isTeam
        ? { label: 'Minha equipe', detail: 'Elenco, inscrições e competições', icon: Users, action: () => void onOpenPanel(account) }
        : isPlayer
          ? { label: 'Minhas competições', detail: 'Agenda, histórico e resultados', icon: Gamepad2, action: () => void onOpenPanel(account) }
          : { label: 'Central de afiliados', detail: 'Campanhas, vendas e comissões', icon: Store, action: () => void onOpenPanel(account) }
    : null

  const profileLabel = isProducer ? 'Produtora' : isTeam ? 'Equipe' : isPlayer ? 'Jogador' : isManager ? 'Afiliado' : 'Conta'
  const AccountIcon = accountAction?.icon || LayoutDashboard

  return (
    <div className="market-home">
      <section className="market-home-search-zone" aria-label="Buscar campeonatos">
        <div className="market-home-search-copy">
          <span><Sparkles size={14} /> MARKETPLACE DROPZONE</span>
          <h1>Encontre seu próximo campeonato.</h1>
          <p>Compare vagas, preço, premiação e data. Entre pela sua equipe e acompanhe tudo no mesmo lugar.</p>
        </div>
        <form className="market-home-search" onSubmit={submitMarketSearch}>
          <Search size={20} aria-hidden />
          <input
            value={marketQuery}
            onChange={(event) => setMarketQuery(event.target.value)}
            placeholder="Buscar campeonato, produtora ou formato..."
            aria-label="Buscar campeonato, produtora ou formato"
          />
          <button type="submit">Buscar</button>
        </form>
        <nav className="market-home-shortcuts" aria-label="Atalhos do marketplace">
          <a href={marketHref({ vagas: '1' })}><Flame size={14} /> Vagas abertas</a>
          <a href={marketHref({ gratis: '1' })}><Gift size={14} /> Grátis</a>
          <a href={marketHref({ ordem: 'premio' })}><Trophy size={14} /> Maior premiação</a>
          <a href={marketHref({ ultimas: '1' })}><Ticket size={14} /> Vagas acabando</a>
          <a href={marketHref({ hoje: '1' })}><Clock3 size={14} /> Começa hoje</a>
          {account ? <a href={marketHref({ meus: '1' })}><Check size={14} /> Meus campeonatos</a> : null}
        </nav>
      </section>

      <section className="market-home-hero" aria-label="Campeonato em destaque">
        {loadingVacancies ? (
          <div className="market-home-hero-skeleton"><Loader2 className="spin" size={24} /> Carregando destaques...</div>
        ) : featured ? (
          <>
            <a className="market-home-hero-main" href={`/campeonatos/${encodeURIComponent(featured.id)}`}>
              <span className="market-home-hero-media">
                {featured.banner_url ? <img src={featured.banner_url} alt="" /> : <span className="market-home-hero-fallback"><Trophy size={54} /></span>}
              </span>
              <span className="market-home-hero-overlay" />
              <span className="market-home-hero-content">
                <small>{featured.tipo || 'CAMPEONATO'} · EM DESTAQUE</small>
                <strong>{featured.nome}</strong>
                {featured.produtora_nome ? <em>por {featured.produtora_nome}</em> : null}
                <span className="market-home-hero-facts">
                  <b>{vacancyMoney(featured.valor_inscricao)}<i>por vaga</i></b>
                  <b>{Number(featured.vagas_livres || 0)}<i>vagas livres</i></b>
                  {featured.premiacao ? <b>{vacancyMoney(featured.premiacao)}<i>premiação</i></b> : null}
                  <b>{vacancyDateLabel(featured.proxima_data)}<i>próximo jogo</i></b>
                </span>
                <span className="market-home-hero-cta">Ver campeonato <ArrowRight size={17} /></span>
              </span>
            </a>
            <div className="market-home-hero-side">
              {showcase.slice(0, 2).map((item) => (
                <a href={`/campeonatos/${encodeURIComponent(item.id)}`} key={item.id}>
                  <span>{item.banner_url ? <img src={item.banner_url} alt="" /> : <Trophy size={30} />}</span>
                  <div><small>{Number(item.vagas_livres || 0)} vagas livres</small><strong>{item.nome}</strong><b>{priceNumber(item) > 0 ? `${vacancyMoney(item.valor_inscricao)} / vaga` : 'Inscrição grátis'}</b></div>
                  <ChevronRight size={18} />
                </a>
              ))}
              <a className="market-home-see-all" href="/campeonatos"><span><small>EXPLORE MAIS</small><strong>Todos os campeonatos</strong></span><ArrowRight size={19} /></a>
            </div>
          </>
        ) : (
          <div className="market-home-hero-empty"><Trophy size={42} /><strong>Novos campeonatos aparecerão aqui.</strong><a href="/campeonatos">Explorar marketplace</a></div>
        )}
      </section>

      {account ? (
        <section className="market-home-account-strip" aria-label="Sua conta">
          <div className="market-home-account-identity">
            <span>{profileLabel}</span>
            <strong>{account.name || account.username}</strong>
            <small>{priorityLoading ? 'Atualizando sua conta...' : homeTasks.length ? `${homeTasks.length} ${homeTasks.length === 1 ? 'ação pendente' : 'ações pendentes'}` : 'Tudo em dia'}</small>
          </div>
          {accountAction ? <button type="button" onClick={accountAction.action}><AccountIcon size={18} /><span><strong>{accountAction.label}</strong><small>{accountAction.detail}</small></span><ChevronRight size={17} /></button> : null}
          <a href="/agenda"><CalendarDays size={18} /><span><strong>{nextAgendaItem ? 'Próximo compromisso' : 'Minha agenda'}</strong><small>{nextAgendaItem ? `${nextAgendaItem.data} · ${nextAgendaItem.horario_inicio}` : 'Ver datas e jogos'}</small></span><ChevronRight size={17} /></a>
          {isProducer ? <button type="button" onClick={createChampionship}><CirclePlus size={18} /><span><strong>Criar campeonato</strong><small>Publicar uma nova competição</small></span><ChevronRight size={17} /></button> : null}
        </section>
      ) : (
        <section className="market-home-onboarding-strip">
          <div><small>QUER COMPETIR?</small><strong>Crie seu perfil quando precisar entrar em uma competição.</strong></div>
          <a href="/?cadastro=equipe&returnTo=%2Fcampeonatos"><Users size={17} /> Cadastrar equipe</a>
          <a href="/?cadastro=jogador&returnTo=%2Fcampeonatos"><Gamepad2 size={17} /> Sou jogador</a>
          <span><ShieldCheck size={16} /> Produtoras somente por convite da administração</span>
        </section>
      )}

      <section className="market-home-section" id="destaques">
        <div className="market-home-section-head">
          <div><small>VITRINE</small><h2>Campeonatos em destaque</h2><p>Vagas abertas para entrar agora.</p></div>
          <a href="/campeonatos?vagas=1">Ver todos <ArrowRight size={16} /></a>
        </div>
        <div className="vacancies-page market-home-card-surface">
          {loadingVacancies ? (
            <div className="vacancies-grid vacancy-catalog-grid market-home-loading">
              {Array.from({ length: 4 }).map((_, index) => <div className="market-home-card-skeleton" key={index} />)}
            </div>
          ) : showcase.length ? (
            <div className="vacancies-grid vacancy-catalog-grid">
              {showcase.slice(0, 8).map((item) => <VacancyCard key={item.id} item={item} onPreview={setVacancyPreview} onBuy={(target) => window.location.assign(`/campeonatos/${encodeURIComponent(target.id)}?comprar=1`)} />)}
            </div>
          ) : (
            <div className="market-home-empty"><Ticket size={30} /><strong>Nenhuma vaga disponível agora</strong><span>Assim que uma produtora abrir inscrições, o campeonato aparece aqui.</span></div>
          )}
        </div>
      </section>

      {lastVacancies.length ? (
        <section className="market-home-section market-home-section-urgent">
          <div className="market-home-section-head">
            <div><small>ÚLTIMA CHANCE</small><h2>Vagas acabando</h2><p>Competições com poucas vagas restantes.</p></div>
            <a href="/campeonatos?ultimas=1">Ver todas <ArrowRight size={16} /></a>
          </div>
          <div className="vacancies-page market-home-card-surface"><div className="vacancies-grid vacancy-catalog-grid">{lastVacancies.map((item) => <VacancyCard key={item.id} item={item} onPreview={setVacancyPreview} onBuy={(target) => window.location.assign(`/campeonatos/${encodeURIComponent(target.id)}?comprar=1`)} buyLabel="Garantir vaga" />)}</div></div>
        </section>
      ) : null}

      {biggestPrizes.length ? (
        <section className="market-home-section">
          <div className="market-home-section-head">
            <div><small>PREMIAÇÃO</small><h2>Maiores premiações</h2><p>Campeonatos com os maiores prêmios publicados.</p></div>
            <a href="/campeonatos?ordem=premio">Ver ranking <ArrowRight size={16} /></a>
          </div>
          <div className="market-home-prize-list">
            {biggestPrizes.map((item, index) => <a href={`/campeonatos/${encodeURIComponent(item.id)}`} key={item.id}><b>{String(index + 1).padStart(2, '0')}</b><span>{item.logo_url ? <img src={item.logo_url} alt="" /> : <Trophy size={20} />}</span><div><strong>{item.nome}</strong><small>{item.produtora_nome || item.tipo || 'Campeonato'}</small></div><em>{vacancyMoney(item.premiacao)}</em><ChevronRight size={17} /></a>)}
          </div>
        </section>
      ) : null}

      {account && homeTasks.length ? (
        <section className="market-home-section market-home-attention">
          <div className="market-home-section-head"><div><small>SUA CONTA</small><h2>Precisa da sua atenção</h2></div><a href="/agenda">Abrir agenda <ArrowRight size={16} /></a></div>
          <div className="market-home-task-grid">
            {homeTasks.map((task) => <a className={task.urgent ? 'urgent' : ''} href={task.href || '/agenda'} key={task.id}><span><strong>{task.title}</strong><small>{task.detail}</small></span><ChevronRight size={17} /></a>)}
          </div>
        </section>
      ) : null}

      <section className="market-home-utility-row">
        <details className="market-home-token-box">
          <summary><KeyRound size={17} /><span><strong>Tenho um token ou link</strong><small>Inscrição, grupo, escalação ou convite</small></span><ChevronRight size={16} /></summary>
          <form onSubmit={(event) => { event.preventDefault(); void submitToken() }}>
            <input value={tokenValue} onChange={(event) => { setTokenValue(event.target.value); setTokenError('') }} placeholder="Cole o token ou link aqui" aria-label="Token ou link de inscrição" />
            <button type="submit" disabled={tokenBusy}>{tokenBusy ? 'Verificando…' : 'Continuar'}</button>
            {tokenError ? <small role="alert">{tokenError}</small> : null}
          </form>
        </details>

        {accounts.length > 1 ? <div className="market-home-areas"><span>Trocar área</span>{accounts.map((item) => {
          const type = item.profile_type as ProfileType
          const label = type === 'equipe' ? 'Equipe' : type === 'jogador' ? 'Jogador' : type === 'produtora' ? 'Produtora' : 'Afiliado'
          return <button key={item.id} type="button" onClick={() => void onOpenPanel(item)}><strong>{label}</strong><small>{item.name || item.username}</small></button>
        })}</div> : null}
      </section>

      <VacancyPreview item={vacancyPreview} onClose={() => setVacancyPreview(null)} />
    </div>
  )
}
