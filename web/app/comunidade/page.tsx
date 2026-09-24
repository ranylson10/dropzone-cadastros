import { Building2, Medal, Search, UsersRound } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import './comunidade.css'

const AREAS = [
  {
    href: '/equipes',
    title: 'Equipes',
    description: 'Encontre equipes, lines e perfis competitivos.',
    Icon: UsersRound,
  },
  {
    href: '/jogadores',
    title: 'Jogadores',
    description: 'Pesquise jogadores e conheça seus perfis competitivos.',
    Icon: Search,
  },
  {
    href: '/rank',
    title: 'Ranking',
    description: 'Acompanhe destaques, posições e desempenho competitivo.',
    Icon: Medal,
  },
  {
    href: '/produtoras',
    title: 'Produtoras',
    description: 'Descubra organizações e campeonatos da comunidade.',
    Icon: Building2,
  },
]

export default function CommunityPage() {
  return (
    <AppShell activeLabel="Comunidade" loadSession mainClassName="community-hub page page-authenticated">
      <section className="community-hub-hero">
        <span>COMUNIDADE</span>
        <h1>Encontre quem faz parte do competitivo</h1>
        <p>Equipes, jogadores, rankings e produtoras organizados em um só lugar.</p>
      </section>

      <section className="community-hub-grid" aria-label="Áreas da comunidade">
        {AREAS.map(({ href, title, description, Icon }) => (
          <a href={href} className="community-hub-card" key={href}>
            <span className="community-hub-icon"><Icon size={22} aria-hidden /></span>
            <span className="community-hub-copy">
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <span className="community-hub-arrow" aria-hidden>›</span>
          </a>
        ))}
      </section>
    </AppShell>
  )
}
