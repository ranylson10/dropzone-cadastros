'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronRight,
  CirclePlus,
  LayoutDashboard,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { DirectoryListClient } from '@/features/directory/components/DirectoryListClient'
import '@/features/directory/components/championship-directory.css'
import type { DirectoryItem } from '@/features/directory/types'
import type { DropZoneRow } from '@/lib/types'
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
}

type GateKind = 'produtora' | 'equipe' | null




export function AuthenticatedHomeFeed({
  account,
  accounts,
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
          <span className="authenticated-home-kicker">INÍCIO</span>
          <h1>O que você quer fazer?</h1>
          <p>Escolha a próxima ação. O restante aparece quando você precisar.</p>
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


      <section className="authenticated-home-section authenticated-home-access-section">
        <div className="authenticated-home-section-head">
          <div><span>CONTINUAR</span><h2>Seus atalhos</h2></div>
          <button type="button" onClick={() => void onOpenPanel(account)}>Painel atual <ArrowRight size={15} /></button>
        </div>

        <div className="authenticated-home-access-grid" aria-label="Atalhos da conta">
          <button type="button" className="authenticated-home-access-card" onClick={() => void onOpenPanel(account)}>
            <LayoutDashboard size={20} />
            <span><strong>Painel</strong><small>{account.name || account.username || 'Perfil ativo'}</small></span>
          </button>

          <button type="button" className="authenticated-home-access-card" onClick={openTeam}>
            <Users size={20} />
            <span><strong>Equipe</strong><small>{team ? 'Elenco e lines' : 'Criar perfil'}</small></span>
          </button>

          <button type="button" className="authenticated-home-access-card" onClick={openProducerPanel}>
            <Trophy size={20} />
            <span><strong>Campeonatos</strong><small>{producer ? 'Gerenciar' : 'Criar produtora'}</small></span>
          </button>

          <a className="authenticated-home-access-card" href="/carteira">
            <Wallet size={20} />
            <span><strong>Carteira</strong><small>Saldo e pagamentos</small></span>
          </a>

          <a className="authenticated-home-access-card" href="/rank">
            <ShieldCheck size={20} />
            <span><strong>Rank</strong><small>Estatísticas</small></span>
          </a>
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
