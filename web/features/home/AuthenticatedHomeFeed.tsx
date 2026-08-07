'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CirclePlus,
  Coins,
  LayoutDashboard,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import './authenticated-home.css'

type Vacancy = {
  id: string
  nome: string
  tipo?: string
  logo_url?: string | null
  valor_inscricao?: number | string | null
  vagas_livres?: number
  total_vagas?: number
  proxima_data?: string | null
  proximo_horario?: string | null
}

type Props = {
  account: DropZoneRow
  accounts: DropZoneRow[]
  championshipsCount: number
  teamsCount: number
  registrationsCount: number
  onOpenPanel: (target?: DropZoneRow) => void | Promise<void>
}

type GateKind = 'produtora' | 'equipe' | null

function money(value: Vacancy['valor_inscricao']) {
  const amount = Number(value || 0)
  return amount <= 0 ? 'Grátis' : amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dateLabel(value?: string | null) {
  if (!value) return 'Data a confirmar'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Data a confirmar'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}

export function AuthenticatedHomeFeed({
  account,
  accounts,
  championshipsCount,
  teamsCount,
  registrationsCount,
  onOpenPanel,
}: Props) {
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(true)
  const [gate, setGate] = useState<GateKind>(null)

  const producer = accounts.find((item) => item.profile_type === 'produtora')
  const team = accounts.find((item) => item.profile_type === 'equipe')

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

  const availableVacancies = useMemo(
    () => vacancies.reduce((sum, item) => sum + Number(item.vagas_livres || 0), 0),
    [vacancies],
  )

  const openProducerPanel = () => {
    if (!producer) {
      setGate('produtora')
      return
    }
    void onOpenPanel(producer)
  }

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

  const openTeam = () => {
    if (!team) {
      setGate('equipe')
      return
    }
    void onOpenPanel(team)
  }

  return (
    <div className="authenticated-home">
      <section className="authenticated-home-intro">
        <div className="authenticated-home-intro-copy">
          <span className="authenticated-home-kicker">DROPZONE COMPETITIVE</span>
          <h1>O que você quer fazer agora?</h1>
          <p>Encontre campeonatos, garanta vagas ou continue a gestão do seu perfil sem precisar procurar cada ferramenta.</p>
        </div>
        <div className="authenticated-home-primary-actions">
          <button type="button" className="authenticated-home-action primary" onClick={createChampionship}>
            <CirclePlus size={19} />
            <span><strong>Criar campeonato</strong><small>Publique e venda vagas</small></span>
            <ChevronRight size={18} />
          </button>
          <a className="authenticated-home-action" href="/vagas">
            <Ticket size={19} />
            <span><strong>Encontrar vaga</strong><small>Campeonatos com inscrições abertas</small></span>
            <ChevronRight size={18} />
          </a>
        </div>
      </section>

      <section className="authenticated-home-overview" aria-label="Resumo rápido">
        <div><strong>{championshipsCount}</strong><span>campeonatos no meu acesso</span></div>
        <div><strong>{teamsCount}</strong><span>equipes relacionadas</span></div>
        <div><strong>{registrationsCount}</strong><span>inscrições</span></div>
        <div><strong>{availableVacancies}</strong><span>vagas disponíveis agora</span></div>
      </section>

      <section className="authenticated-home-section authenticated-home-access-section">
        <div className="authenticated-home-section-head">
          <div><span>ACESSO RÁPIDO</span><h2>Minha área</h2></div>
          <button type="button" onClick={() => void onOpenPanel(account)}>Abrir painel atual <ArrowRight size={15} /></button>
        </div>

        <div className="authenticated-home-access-grid">
          <button type="button" className="authenticated-home-access-card" onClick={openTeam}>
            <span className="authenticated-home-access-icon"><Users size={20} /></span>
            <span><strong>Minha equipe</strong><small>{team ? 'Elenco, lines e campeonatos' : 'Crie seu perfil de equipe para começar'}</small></span>
            <ChevronRight size={18} />
          </button>

          <button type="button" className="authenticated-home-access-card" onClick={openProducerPanel}>
            <span className="authenticated-home-access-icon"><Trophy size={20} /></span>
            <span><strong>Meus campeonatos</strong><small>{producer ? 'Criação, vendas e administração' : 'Crie uma produtora para publicar campeonatos'}</small></span>
            <ChevronRight size={18} />
          </button>

          <a className="authenticated-home-access-card" href="/agenda">
            <span className="authenticated-home-access-icon"><CalendarDays size={20} /></span>
            <span><strong>Agenda</strong><small>Próximos jogos e compromissos</small></span>
            <ChevronRight size={18} />
          </a>

          <a className="authenticated-home-access-card" href="/carteira">
            <span className="authenticated-home-access-icon"><Wallet size={20} /></span>
            <span><strong>Carteira</strong><small>Saldo, pagamentos e saques</small></span>
            <ChevronRight size={18} />
          </a>

          <a className="authenticated-home-access-card" href="/rank">
            <span className="authenticated-home-access-icon"><ShieldCheck size={20} /></span>
            <span><strong>Rank e estatísticas</strong><small>Acompanhe o cenário competitivo</small></span>
            <ChevronRight size={18} />
          </a>

          <button type="button" className="authenticated-home-access-card" onClick={() => void onOpenPanel(account)}>
            <span className="authenticated-home-access-icon"><LayoutDashboard size={20} /></span>
            <span><strong>Meu painel</strong><small>Ferramentas do perfil ativo</small></span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <section className="authenticated-home-section">
        <div className="authenticated-home-section-head">
          <div><span>OPORTUNIDADES</span><h2>Campeonatos com vagas abertas</h2></div>
          <a href="/vagas">Ver todas <ArrowRight size={15} /></a>
        </div>

        {loadingVacancies ? (
          <div className="authenticated-home-vacancy-grid" aria-label="Carregando vagas">
            {Array.from({ length: 4 }).map((_, index) => <div className="authenticated-home-vacancy-card is-loading" key={index} />)}
          </div>
        ) : vacancies.length ? (
          <div className="authenticated-home-vacancy-grid">
            {vacancies.slice(0, 6).map((item) => (
              <article className="authenticated-home-vacancy-card" key={item.id}>
                <div className="authenticated-home-vacancy-head">
                  <span className="authenticated-home-vacancy-logo">{item.logo_url ? <img src={item.logo_url} alt="" /> : <Trophy size={22} />}</span>
                  <div><small>{item.tipo || 'Campeonato'}</small><strong>{item.nome}</strong></div>
                </div>
                <div className="authenticated-home-vacancy-meta">
                  <span><CalendarDays size={13} /> {dateLabel(item.proxima_data)}</span>
                  <span>{item.proximo_horario || 'Horário a confirmar'}</span>
                </div>
                <div className="authenticated-home-vacancy-status">
                  <span><b>{item.vagas_livres || 0}</b> de {item.total_vagas || 0} vagas livres</span>
                  <strong>{money(item.valor_inscricao)}</strong>
                </div>
                <footer>
                  <a href={`/campeonatos/${item.id}`}>Ver campeonato</a>
                  <a className="buy" href={`/vagas?comprar=${item.id}`}>Garantir vaga <ArrowRight size={14} /></a>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="authenticated-home-empty">
            <Coins size={26} />
            <strong>Nenhuma vaga aberta agora</strong>
            <span>Os próximos campeonatos aparecerão aqui assim que abrirem inscrições.</span>
          </div>
        )}
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
