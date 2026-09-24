'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Store,
  Ticket,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import type { ProfileType } from '@/lib/types'
import { VacancyCard, VacancyPreview, type VacancyCatalogItem } from '@/features/vacancies/VacancyCard'
import './authenticated-home.css'

type Vacancy = VacancyCatalogItem

type Props = {
  account: DropZoneRow | null
  accounts: DropZoneRow[]
  onOpenPanel: (target?: DropZoneRow) => void | Promise<void>
}

type GateKind = 'produtora' | 'equipe' | null

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
  equipe_nome?: string | null
  jogadores_confirmados?: number | null
  limite_jogadores?: number | null
  link_expira_em?: string | null
}

type HomeTask = { id: string; title: string; detail: string; href?: string; action?: () => void; urgent?: boolean }




export function AuthenticatedHomeFeed({
  account,
  accounts,
  onOpenPanel,
}: Props) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(true)
  const [gate, setGate] = useState<GateKind>(null)
  const [notifications, setNotifications] = useState<HomeNotification[]>([])
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [priorityLoading, setPriorityLoading] = useState(true)
  const [respondingNotification, setRespondingNotification] = useState('')
  const [lineups, setLineups] = useState<LineupSummary[]>([])
  const [tokenValue, setTokenValue] = useState('')
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [vacancyPreview, setVacancyPreview] = useState<VacancyCatalogItem | null>(null)

  const producer = accounts.find((item) => item.profile_type === 'produtora')
  const isPlayer = account?.profile_type === 'jogador'
  const isTeam = account?.profile_type === 'equipe'
  const isProducer = account?.profile_type === 'produtora'

  useEffect(() => {
    let active = true
    fetch('/api/vagas', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return
        const items = Array.isArray(data.announcements) ? data.announcements : []
        setVacancies(items.filter((item: Vacancy) => Number(item.vagas_livres || 0) > 0).slice(0, 8))
      })
      .catch(() => { if (active) setVacancies([]) })
      .finally(() => { if (active) setLoadingVacancies(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
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
  }, [])

  const createChampionship = () => {
    if (!producer) {
      setGate('produtora')
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set('acao', 'criar-campeonato')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    void onOpenPanel(producer)
  }

  const openPanelAt = (target: DropZoneRow, section?: string) => {
    if (section) {
      const url = new URL(window.location.href)
      url.searchParams.set('section', section)
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
    void onOpenPanel(target)
  }

  const nextAgendaItem = useMemo(() => {
    const now = new Date()
    return agenda
      .filter((item) => new Date(`${item.data}T${item.horario_inicio || '00:00'}:00`) >= now)
      .sort((a, b) => `${a.data} ${a.horario_inicio}`.localeCompare(`${b.data} ${b.horario_inicio}`))[0] || null
  }, [agenda])

  const playerInvite = notifications.find((item) => item.status === 'nao_lida' && (
    item.tipo === 'convite_jogador_equipe_direto' || item.tipo === 'pedido_jogador_equipe' || item.tipo === 'convite_escalacao_jogador'
  ))

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
        href: '/?painel=1&section=jogadores', urgent: hours != null && hours <= 24,
      })
    }
    for (const notification of notifications.filter((item) => item.status === 'nao_lida').slice(0, 4)) {
      tasks.push({ id: `notification-${notification.id}`, title: notification.titulo, detail: notification.corpo || 'Há uma ação aguardando você.', href: notification.acao_url || notification.payload?.public_url || '/agenda', urgent: /prazo|escala|convite/i.test(`${notification.titulo} ${notification.corpo || ''}`) })
    }
    if (nextAgendaItem) tasks.push({ id: `agenda-${nextAgendaItem.id}`, title: nextAgendaItem.titulo, detail: `Hoje/próximo: ${nextAgendaItem.data} · ${nextAgendaItem.horario_inicio}`, href: nextAgendaItem.meta?.href || '/agenda' })
    return tasks.slice(0, 5)
  }, [lineups, notifications, nextAgendaItem])

  const submitToken = async () => {
    const raw = tokenValue.trim()
    if (!raw) return
    const urlMatch = raw.match(/\/(convite\/equipe|convite\/grupo|equipe\/entrar|escala|i|vagas\/compra)\/([^/?#]+)/i)
    if (urlMatch) { window.location.assign(`/${urlMatch[1].toLowerCase()}/${encodeURIComponent(decodeURIComponent(urlMatch[2]))}`); return }
    setTokenBusy(true); setTokenError('')
    try {
      const response = await fetch(`/api/convites/resolver/${encodeURIComponent(raw.replace(/\s/g, ''))}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.href) throw new Error(payload.error || 'Token não reconhecido.')
      window.location.assign(String(payload.href))
    } catch (error: any) { setTokenError(error?.message || 'Confira o token ou cole o link completo.') } finally { setTokenBusy(false) }
  }

  const acceptPriorityNotification = async () => {
    if (!playerInvite) return
    setRespondingNotification(playerInvite.id)
    try {
      const { supabase } = await import('@/lib/supabase-browser')
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sessão expirada.')
      const response = await fetch(`/api/notificacoes/${playerInvite.id}/aceitar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Não foi possível aceitar o convite.')
      setNotifications((current) => current.filter((item) => item.id !== playerInvite.id))
    } finally {
      setRespondingNotification('')
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const profileLabel = isProducer ? 'Produtora' : isTeam ? 'Equipe' : isPlayer ? 'Jogador' : account?.profile_type === 'manager' ? 'Afiliado' : 'Conta'
  const primaryTask = homeTasks[0] || null
  const visibleTasks = homeTasks.slice(0, 3)
  const showOpportunities = !account || isPlayer || isTeam

  return (
    <div className="authenticated-home">
      <section className="authenticated-home-focus" aria-label="Resumo da conta">
        <div className="authenticated-home-focus-copy">
          <span className="authenticated-home-kicker">INÍCIO</span>
          <div className="authenticated-home-focus-title">
            <div>
              <h1>{greeting}, {account?.name || account?.username || 'bem-vindo'}</h1>
              <p>{primaryTask ? 'Você tem algo que merece atenção agora.' : 'Tudo certo por aqui. Escolha o que deseja fazer.'}</p>
            </div>
            {account ? <span className="authenticated-home-profile-chip">{profileLabel}</span> : null}
          </div>
        </div>

        <div className="authenticated-home-focus-status">
          <span className={`authenticated-home-focus-count ${homeTasks.length ? 'has-items' : 'is-clear'}`}>
            <strong>{priorityLoading ? '…' : homeTasks.length}</strong>
            <small>{homeTasks.length === 1 ? 'ação pendente' : 'ações pendentes'}</small>
          </span>
          {primaryTask ? (
            <a className="authenticated-home-focus-next" href={primaryTask.href || '/agenda'}>
              <span><small>PRÓXIMA AÇÃO</small><strong>{primaryTask.title}</strong></span>
              <ChevronRight size={18} />
            </a>
          ) : (
            <a className="authenticated-home-focus-next" href="/agenda">
              <span><small>PRÓXIMO PASSO</small><strong>Ver minha agenda</strong></span>
              <ChevronRight size={18} />
            </a>
          )}
        </div>
      </section>

      <section className="authenticated-home-section authenticated-home-quick-section">
        <div className="authenticated-home-section-head compact">
          <div><span>ACESSO RÁPIDO</span><h2>O que você quer fazer?</h2></div>
        </div>
        <div className="authenticated-home-quick-grid">
          {isProducer ? <>
            <button type="button" className="authenticated-home-quick primary" onClick={createChampionship}><CirclePlus size={20}/><span><strong>Criar campeonato</strong><small>Novo evento</small></span><ChevronRight size={16}/></button>
            {account ? <button type="button" className="authenticated-home-quick" onClick={() => void onOpenPanel(account)}><LayoutDashboard size={20}/><span><strong>Meu painel</strong><small>Gerenciar produtora</small></span><ChevronRight size={16}/></button> : null}
            <a className="authenticated-home-quick" href="/agenda"><CalendarDays size={20}/><span><strong>Agenda</strong><small>Datas e jogos</small></span><ChevronRight size={16}/></a>
          </> : isTeam ? <>
            {account ? <button type="button" className="authenticated-home-quick primary" onClick={() => void onOpenPanel(account)}><Users size={20}/><span><strong>Minha equipe</strong><small>Elenco e inscrições</small></span><ChevronRight size={16}/></button> : null}
            <a className="authenticated-home-quick" href="/campeonatos?vagas=1"><Ticket size={20}/><span><strong>Encontrar campeonato</strong><small>Vagas abertas</small></span><ChevronRight size={16}/></a>
            <a className="authenticated-home-quick" href="/agenda"><CalendarDays size={20}/><span><strong>Agenda</strong><small>Próximos jogos</small></span><ChevronRight size={16}/></a>
          </> : isPlayer ? <>
            {playerInvite ? <button type="button" className="authenticated-home-quick primary" onClick={() => void acceptPriorityNotification()} disabled={respondingNotification === playerInvite.id}>{respondingNotification === playerInvite.id ? <Loader2 className="spin" size={20}/> : <Check size={20}/>}<span><strong>Aceitar convite</strong><small>{playerInvite.titulo}</small></span><ChevronRight size={16}/></button> : <a className="authenticated-home-quick primary" href="/agenda"><CalendarDays size={20}/><span><strong>Minha agenda</strong><small>Jogos e escalações</small></span><ChevronRight size={16}/></a>}
            {account ? <button type="button" className="authenticated-home-quick" onClick={() => void onOpenPanel(account)}><LayoutDashboard size={20}/><span><strong>Meu perfil</strong><small>Dados competitivos</small></span><ChevronRight size={16}/></button> : null}
            <a className="authenticated-home-quick" href="/campeonatos?vagas=1"><Trophy size={20}/><span><strong>Campeonatos</strong><small>Encontrar oportunidades</small></span><ChevronRight size={16}/></a>
          </> : account?.profile_type === 'manager' ? <>
            <button type="button" className="authenticated-home-quick primary" onClick={() => void onOpenPanel(account)}><Store size={20}/><span><strong>Meus afiliados</strong><small>Vendas e campeonatos</small></span><ChevronRight size={16}/></button>
            <a className="authenticated-home-quick" href="/agenda"><CalendarDays size={20}/><span><strong>Agenda</strong><small>Compromissos</small></span><ChevronRight size={16}/></a>
            <a className="authenticated-home-quick" href="/campeonatos"><Trophy size={20}/><span><strong>Competições</strong><small>Ver campeonatos</small></span><ChevronRight size={16}/></a>
          </> : account ? <>
            <button type="button" className="authenticated-home-quick primary" onClick={() => void onOpenPanel(account)}><LayoutDashboard size={20}/><span><strong>Meu painel</strong><small>Abrir área principal</small></span><ChevronRight size={16}/></button>
            <a className="authenticated-home-quick" href="/agenda"><CalendarDays size={20}/><span><strong>Agenda</strong><small>Compromissos</small></span><ChevronRight size={16}/></a>
            <a className="authenticated-home-quick" href="/campeonatos"><Trophy size={20}/><span><strong>Competições</strong><small>Ver campeonatos</small></span><ChevronRight size={16}/></a>
          </> : <>
            <a className="authenticated-home-quick primary" href="/campeonatos?vagas=1"><Ticket size={20}/><span><strong>Encontrar campeonato</strong><small>Vagas abertas</small></span><ChevronRight size={16}/></a>
            <button type="button" className="authenticated-home-quick" onClick={createChampionship}><CirclePlus size={20}/><span><strong>Criar campeonato</strong><small>Começar evento</small></span><ChevronRight size={16}/></button>
          </>}
        </div>
      </section>

      {account ? <section className="authenticated-home-section authenticated-home-command-center">
        <div className="authenticated-home-section-head compact">
          <div><span>AGORA</span><h2>{visibleTasks.length ? 'Precisa da sua atenção' : 'Sem pendências'}</h2></div>
          <a href="/agenda">Ver tudo <ArrowRight size={15}/></a>
        </div>
        <div className="authenticated-home-now-grid">
          <div className="authenticated-home-tasks" aria-busy={priorityLoading}>
            {priorityLoading ? <div className="authenticated-home-tasks-empty"><Loader2 className="spin" size={17}/><span><strong>Carregando</strong><small>Buscando suas próximas ações.</small></span></div> : visibleTasks.length ? visibleTasks.map((task) => <a className={task.urgent ? 'is-urgent' : ''} href={task.href || '/agenda'} key={task.id}><span><strong>{task.title}</strong><small>{task.detail}</small></span><ChevronRight size={16}/></a>) : <div className="authenticated-home-tasks-empty"><Check size={17}/><span><strong>Nada pendente agora</strong><small>Quando surgir algo importante, aparece aqui.</small></span></div>}
          </div>
          <div className="authenticated-home-next-event">
            <span>PRÓXIMO COMPROMISSO</span>
            <div><CalendarDays size={18}/><p><strong>{nextAgendaItem ? nextAgendaItem.titulo : 'Nenhum compromisso agendado'}</strong><small>{nextAgendaItem ? `${nextAgendaItem.data} · ${nextAgendaItem.horario_inicio}${nextAgendaItem.horario_fim ? `–${nextAgendaItem.horario_fim}` : ''}` : 'Sua agenda está livre no momento.'}</small></p></div>
            <a href={nextAgendaItem?.meta?.href || '/agenda'}>Abrir agenda <ChevronRight size={15}/></a>
          </div>
        </div>
      </section> : null}

      <details className="authenticated-home-more">
        <summary><KeyRound size={17}/><span><strong>Tenho um token ou link</strong><small>Inscrição, grupo, escalação ou convite</small></span><ChevronRight size={16}/></summary>
        <form className="authenticated-home-token" onSubmit={(event) => { event.preventDefault(); void submitToken() }}>
          <input value={tokenValue} onChange={(event) => { setTokenValue(event.target.value); setTokenError('') }} placeholder="Cole o token ou link aqui" aria-label="Token ou link de inscrição" />
          <button type="submit" disabled={tokenBusy}>{tokenBusy ? 'Verificando…' : 'Continuar'}</button>
          {tokenError ? <small className="authenticated-home-token-error" role="alert">{tokenError}</small> : null}
        </form>
      </details>

      {showOpportunities ? <section className="authenticated-home-section authenticated-home-catalog">
        <div className="authenticated-home-section-head compact">
          <div><span>OPORTUNIDADES</span><h2>Campeonatos com vagas</h2></div>
          <a href="/campeonatos?vagas=1">Ver todos <ArrowRight size={15}/></a>
        </div>
        <div className="vacancies-page authenticated-home-vacancies-surface">
          {loadingVacancies ? (
            <div className="vacancies-grid authenticated-home-vacancies-loading" aria-label="Carregando campeonatos">
              {Array.from({ length: 2 }).map((_, index) => <div className="authenticated-home-vacancy-skeleton" key={index} />)}
            </div>
          ) : vacancies.length ? (
            <div className="vacancies-grid vacancy-catalog-grid">
              {vacancies.slice(0, 4).map((item) => <VacancyCard key={item.id} item={item} onPreview={setVacancyPreview} onBuy={(target) => window.location.assign(`/campeonatos/${encodeURIComponent(target.id)}?comprar=1`)} />)}
            </div>
          ) : (
            <div className="vacancies-empty"><Ticket size={32}/><strong>Nenhuma vaga disponível agora</strong><span>Novos campeonatos aparecerão aqui quando abrirem inscrições.</span></div>
          )}
        </div>
      </section> : null}

      {accounts.length > 1 ? <section className="authenticated-home-section authenticated-home-areas" id="meus-cadastros">
        <div className="authenticated-home-section-head compact"><div><span>CONTA</span><h2>Trocar área</h2></div></div>
        <div className="authenticated-home-areas-grid">
          {accounts.map((item) => {
            const type = item.profile_type as ProfileType
            const label = type === 'equipe' ? 'Minha equipe' : type === 'jogador' ? 'Perfil competitivo' : type === 'produtora' ? 'Minha produtora' : type === 'manager' ? 'Afiliados' : 'Área da conta'
            const Icon = type === 'manager' ? Store : type === 'produtora' ? Trophy : type === 'equipe' ? Users : LayoutDashboard
            return <button key={item.id} type="button" className="authenticated-home-area-card" onClick={() => void onOpenPanel(item)}><Icon size={19}/><span><strong>{label}</strong><small>{item.name || item.username}</small></span><ChevronRight size={16}/></button>
          })}
        </div>
      </section> : null}

      {gate ? (
        <div className="authenticated-home-gate-backdrop" role="presentation" onMouseDown={() => setGate(null)}>
          <section className="authenticated-home-gate" role="dialog" aria-modal="true" aria-labelledby="authenticated-home-gate-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="authenticated-home-gate-close" onClick={() => setGate(null)} aria-label="Fechar"><X size={18}/></button>
            <span className="authenticated-home-gate-icon">{gate === 'produtora' ? <Trophy size={25}/> : <Users size={25}/>}</span>
            <small>ANTES DE CONTINUAR</small>
            <h2 id="authenticated-home-gate-title">{gate === 'produtora' ? 'Cadastre sua produtora' : 'Cadastre sua equipe'}</h2>
            <p>{gate === 'produtora' ? 'Para criar, vender vagas e administrar campeonatos, precisamos primeiro dos dados da sua produtora.' : 'Para gerenciar elenco, lines e inscrições, precisamos primeiro dos dados da sua equipe.'}</p>
            <div className="authenticated-home-gate-actions">
              <button type="button" className="primary" onClick={() => { const target = gate === 'produtora' ? 'produtora' : 'equipe'; const returnTo = target === 'produtora' ? '/?painel=1&acao=criar-campeonato' : '/?painel=1'; window.location.assign(`/?cadastro=${target}&returnTo=${encodeURIComponent(returnTo)}`) }}>{gate === 'produtora' ? 'Cadastrar produtora' : 'Cadastrar equipe'} <ArrowRight size={16}/></button>
              <button type="button" onClick={() => setGate(null)}>Agora não</button>
            </div>
          </section>
        </div>
      ) : null}
      <VacancyPreview item={vacancyPreview} onClose={() => setVacancyPreview(null)} />
    </div>
  )
}
