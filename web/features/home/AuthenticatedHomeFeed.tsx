'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  LayoutDashboard,
  Loader2,
  Store,
  Ticket,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { DirectoryListClient } from '@/features/directory/components/DirectoryListClient'
import '@/features/directory/components/championship-directory.css'
import type { DirectoryItem } from '@/features/directory/types'
import type { DropZoneRow } from '@/lib/types'
import type { ProfileType } from '@/lib/types'
import './authenticated-home.css'

type Vacancy = {
  id: string
  nome: string
  tipo?: string
  logo_url?: string | null
  banner_url?: string | null
  valor_inscricao?: number | string | null
  premiacao?: number | string | null
  tem_live?: boolean
  vagas_livres?: number
  total_vagas?: number
  proxima_data?: string | null
  proximo_horario?: string | null
}

type Props = {
  account: DropZoneRow
  accounts: DropZoneRow[]
  onOpenPanel: (target?: DropZoneRow) => void | Promise<void>
  onCreateArea?: (profileType: ProfileType) => void
}

type GateKind = 'produtora' | 'equipe' | null

type HomeNotification = {
  id: string
  tipo: string
  titulo: string
  corpo?: string | null
  status: string
}

type AgendaItem = {
  id: string
  titulo: string
  data: string
  horario_inicio: string
  horario_fim?: string | null
  meta?: { campeonato_nome?: string | null; equipe_nome?: string | null; href?: string | null }
}




export function AuthenticatedHomeFeed({
  account,
  accounts,
  onOpenPanel,
  onCreateArea,
}: Props) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(true)
  const [gate, setGate] = useState<GateKind>(null)
  const [notifications, setNotifications] = useState<HomeNotification[]>([])
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [priorityLoading, setPriorityLoading] = useState(true)
  const [respondingNotification, setRespondingNotification] = useState('')

  const producer = accounts.find((item) => item.profile_type === 'produtora')
  const isPlayer = account.profile_type === 'jogador'
  const isTeam = account.profile_type === 'equipe'
  const isProducer = account.profile_type === 'produtora'

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
        const [notificationsResponse, agendaResponse] = await Promise.all([
          fetch('/api/notificacoes?limit=12', { headers, cache: 'no-store' }),
          fetch('/api/agenda?scope=me&year=2026&month=1&from=2000-01-01&to=2100-12-31', { headers, cache: 'no-store' }),
        ])
        const notificationsJson = await notificationsResponse.json().catch(() => ({}))
        const agendaJson = await agendaResponse.json().catch(() => ({}))
        if (!active) return
        setNotifications(Array.isArray(notificationsJson.items) ? notificationsJson.items : [])
        setAgenda(Array.isArray(agendaJson.items) ? agendaJson.items : [])
      } finally {
        if (active) setPriorityLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const championshipItems = useMemo<DirectoryItem[]>(
    () => vacancies.map((item) => ({
      id: item.id,
      kind: 'campeonatos',
      name: item.nome,
      image: item.logo_url || undefined,
      banner: item.banner_url || undefined,
      eyebrow: item.tipo || 'Campeonato',
      description: item.tipo || 'Campeonato',
      commercial: {
        valor_inscricao: Number(item.valor_inscricao || 0),
        premiacao: Number(item.premiacao || 0),
        tem_live: Boolean(item.tem_live),
        vagas_livres: Number(item.vagas_livres || 0),
        total_vagas: Number(item.total_vagas || 0),
        data_jogo: item.proxima_data || null,
      },
      meta: [],
      searchText: `${item.nome} ${item.tipo || ''}`.toLowerCase(),
    })),
    [vacancies],
  )

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

  return (
    <div className="authenticated-home">
      <section className="authenticated-home-intro">
        <div className="authenticated-home-intro-copy">
          <span className="authenticated-home-kicker">INÍCIO</span>
          <h1>{isPlayer ? 'Seu jogo começa aqui' : isTeam ? 'Organize o próximo jogo' : isProducer ? 'Seu campeonato em movimento' : 'Sua próxima ação'}</h1>
          <p>{isPlayer ? 'Convites, escalações e sua agenda aparecem primeiro.' : isTeam ? 'Inscrição, elenco e agenda ficam à frente da gestão.' : isProducer ? 'Crie, organize e acompanhe seus campeonatos ativos.' : 'O que importa agora aparece primeiro.'}</p>
        </div>
        <div className="authenticated-home-primary-actions">
          {isPlayer && playerInvite ? <button type="button" className="authenticated-home-action primary" onClick={() => void acceptPriorityNotification()} disabled={respondingNotification === playerInvite.id}>
            {respondingNotification === playerInvite.id ? <Loader2 className="spin" size={19} /> : <Check size={19} />}
            <span><strong>Aceitar convite</strong><small>{playerInvite.titulo}</small></span><ChevronRight size={18} />
          </button> : null}
          {isPlayer && !playerInvite ? <a className="authenticated-home-action primary" href="/agenda"><CalendarDays size={19} /><span><strong>Ver minha agenda</strong><small>Jogos e escalações programadas</small></span><ChevronRight size={18} /></a> : null}
          {isTeam ? <a className="authenticated-home-action primary" href="/vagas"><Ticket size={19} /><span><strong>Inscrever equipe</strong><small>Campeonatos com vagas abertas</small></span><ChevronRight size={18} /></a> : null}
          {isProducer ? <button type="button" className="authenticated-home-action primary" onClick={createChampionship}><CirclePlus size={19} /><span><strong>Criar campeonato</strong><small>Comece um novo evento</small></span><ChevronRight size={18} /></button> : null}
          {!isPlayer && !isTeam && !isProducer ? <a className="authenticated-home-action primary" href="/vagas"><Ticket size={19} /><span><strong>Encontrar vaga</strong><small>Campeonatos com inscrições abertas</small></span><ChevronRight size={18} /></a> : null}

          {isPlayer ? <a className="authenticated-home-action" href="/agenda"><CalendarDays size={19} /><span><strong>Próximo jogo</strong><small>{nextAgendaItem ? `${nextAgendaItem.data} · ${nextAgendaItem.horario_inicio}` : 'Confira sua disponibilidade'}</small></span><ChevronRight size={18} /></a> : null}
          {isTeam ? <button type="button" className="authenticated-home-action" onClick={() => openPanelAt(account, 'jogadores')}><Users size={19} /><span><strong>Escalar elenco</strong><small>Prepare a equipe para jogar</small></span><ChevronRight size={18} /></button> : null}
          {isProducer ? <button type="button" className="authenticated-home-action" onClick={() => openPanelAt(account, 'equipes')}><Users size={19} /><span><strong>Organizar equipes</strong><small>Adicionar e posicionar participantes</small></span><ChevronRight size={18} /></button> : null}
        </div>
      </section>

      <section className="authenticated-home-section authenticated-home-priority-section">
        <div className="authenticated-home-section-head">
          <div><span>AGORA</span><h2>{isPlayer ? 'Seu próximo compromisso' : isTeam ? 'Operação da equipe' : isProducer ? 'Campeonato ativo' : 'Continue de onde parou'}</h2></div>
          <a href="/agenda">Ver agenda <ArrowRight size={15} /></a>
        </div>
        <div className="authenticated-home-priority-card">
          {priorityLoading ? <Loader2 className="spin" size={18} /> : <CalendarDays size={18} />}
          <div><strong>{nextAgendaItem ? nextAgendaItem.titulo : isPlayer ? 'Nenhum jogo agendado' : 'Agenda da conta'}</strong><small>{nextAgendaItem ? `${nextAgendaItem.data} · ${nextAgendaItem.horario_inicio}${nextAgendaItem.horario_fim ? `–${nextAgendaItem.horario_fim}` : ''} · ${nextAgendaItem.meta?.campeonato_nome || nextAgendaItem.meta?.equipe_nome || 'DropZone'}` : 'Acompanhe datas, jogos e compromissos em um só lugar.'}</small></div>
          <a href={nextAgendaItem?.meta?.href || '/agenda'}>Abrir <ChevronRight size={16} /></a>
        </div>
      </section>

      <section className="authenticated-home-section authenticated-home-areas" id="minhas-areas">
        <div className="authenticated-home-section-head">
          <div><span>MINHA CONTA</span><h2>Minhas áreas</h2></div>
        </div>
        <div className="authenticated-home-areas-grid">
          {accounts.map((item) => {
            const type = item.profile_type as ProfileType
            const label = type === 'equipe' ? 'Minha equipe' : type === 'jogador' ? 'Perfil competitivo' : type === 'produtora' ? 'Minha produtora' : type === 'manager' ? 'Afiliados' : 'Transmissão'
            const Icon = type === 'manager' ? Store : type === 'produtora' ? Trophy : type === 'equipe' ? Users : LayoutDashboard
            return <button key={item.id} type="button" className="authenticated-home-area-card" onClick={() => void onOpenPanel(item)}>
              <Icon size={19} /><span><strong>{label}</strong><small>{item.name || item.username}</small></span><ChevronRight size={16} />
            </button>
          })}
          {!accounts.some((item) => item.profile_type === 'manager') && onCreateArea ? <button type="button" className="authenticated-home-area-card is-add" onClick={() => onCreateArea('manager')}>
            <CirclePlus size={19} /><span><strong>Ativar afiliados</strong><small>Divulgue campeonatos e acompanhe vendas</small></span><ChevronRight size={16} />
          </button> : null}
        </div>
      </section>

      <section className="authenticated-home-section">
        <div className="authenticated-home-section-head">
          <div><span>OPORTUNIDADES</span><h2>Campeonatos com vagas abertas</h2></div>
          <a href="/vagas">Ver todas <ArrowRight size={15} /></a>
        </div>

        <div className="authenticated-home-directory-preview directory-market-page">
          {loadingVacancies ? (
            <div className="directory-champ-card-grid authenticated-home-directory-loading" aria-label="Carregando campeonatos">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="directory-champ-card authenticated-home-directory-loading-card" key={index} />
              ))}
            </div>
          ) : (
            <DirectoryListClient items={championshipItems} cardsOnly />
          )}
        </div>
      </section>

      {gate ? (
        <div className="authenticated-home-gate-backdrop" role="presentation" onMouseDown={() => setGate(null)}>
          <section className="authenticated-home-gate" role="dialog" aria-modal="true" aria-labelledby="authenticated-home-gate-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="authenticated-home-gate-close" onClick={() => setGate(null)} aria-label="Fechar"><X size={18} /></button>
            <span className="authenticated-home-gate-icon">{gate === 'produtora' ? <Trophy size={25} /> : <Users size={25} />}</span>
            <small>ANTES DE CONTINUAR</small>
            <h2 id="authenticated-home-gate-title">{gate === 'produtora' ? 'Crie sua produtora' : 'Crie sua equipe'}</h2>
            <p>{gate === 'produtora'
              ? 'Para criar, vender vagas e administrar campeonatos no DropZone, primeiro você precisa ter uma produtora vinculada à sua conta.'
              : 'Para gerenciar elenco, lines e inscrições como equipe, primeiro crie um perfil de equipe vinculado à sua conta.'}</p>
            <div className="authenticated-home-gate-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const target = gate === 'produtora' ? 'produtora' : 'equipe'
                  const returnTo = target === 'produtora'
                    ? '/?painel=1&acao=criar-campeonato'
                    : '/?painel=1'
                  window.location.assign(`/?cadastro=${target}&returnTo=${encodeURIComponent(returnTo)}`)
                }}
              >
                {gate === 'produtora' ? 'Criar minha produtora' : 'Criar minha equipe'} <ArrowRight size={16} />
              </button>
              <button type="button" onClick={() => setGate(null)}>Agora não</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
