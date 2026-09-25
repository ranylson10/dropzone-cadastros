import { ArrowRight, CalendarDays, Flame, Gift, Search, Ticket, Trophy } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { DIRECTORY_CONFIG } from '../config'
import { listDirectory } from '../server'
import type { DirectoryItem, DirectoryKind } from '../types'
import { DirectoryListClient } from './DirectoryListClient'

function marketMoney(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}

function marketDate(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return 'Data a confirmar'
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw)
  if (Number.isNaN(date.getTime())) return 'Data a confirmar'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function ChampionshipMarketplaceIntro({ items }: { items: DirectoryItem[] }) {
  const sorted = [...items].sort((a, b) => Number(b.commercial?.premiacao || 0) - Number(a.commercial?.premiacao || 0) || Number(b.commercial?.vagas_livres || 0) - Number(a.commercial?.vagas_livres || 0))
  const featured = sorted.find((item) => item.banner) || sorted[0] || null
  const side = sorted.filter((item) => item.id !== featured?.id).slice(0, 2)

  return (
    <section className="champ-market-intro">
      <div className="champ-market-titlebar">
        <div><small>MARKETPLACE DROPZONE</small><h1>Campeonatos</h1><p>Compare vagas, preço, premiação e próxima data. Depois acompanhe tudo pela sua conta.</p></div>
        <a href="#marketplace-catalog"><Search size={16} /> Explorar catálogo</a>
      </div>

      {featured ? (
        <div className="champ-market-hero">
          <a className="champ-market-feature" href={`/campeonatos/${featured.id}`}>
            <span className="champ-market-feature-media">{featured.banner ? <img src={featured.banner} alt="" /> : <Trophy size={54} />}</span>
            <span className="champ-market-feature-overlay" />
            <span className="champ-market-feature-copy">
              <small>DESTAQUE DA VITRINE</small>
              <strong>{featured.name}</strong>
              {featured.producerName ? <em>por {featured.producerName}</em> : null}
              <span className="champ-market-feature-facts">
                <b>{marketMoney(featured.commercial?.valor_inscricao)}<i>por vaga</i></b>
                <b>{Number(featured.commercial?.vagas_livres || 0)}<i>vagas livres</i></b>
                <b>{marketMoney(featured.commercial?.premiacao)}<i>premiação</i></b>
                <b>{marketDate(featured.commercial?.data_jogo)}<i>próximo jogo</i></b>
              </span>
              <span className="champ-market-feature-cta">Ver campeonato <ArrowRight size={17} /></span>
            </span>
          </a>
          <div className="champ-market-side">
            {side.map((item) => (
              <a href={`/campeonatos/${item.id}`} key={item.id}>
                <span>{item.banner ? <img src={item.banner} alt="" /> : <Trophy size={28} />}</span>
                <div><small>{Number(item.commercial?.vagas_livres || 0)} vagas livres</small><strong>{item.name}</strong><b>{marketMoney(item.commercial?.valor_inscricao)} / vaga</b></div>
                <ArrowRight size={16} />
              </a>
            ))}
            <a className="champ-market-side-cta" href="/campeonatos?vagas=1"><span><small>ENTRE AGORA</small><strong>Ver só vagas abertas</strong></span><Ticket size={20} /></a>
          </div>
        </div>
      ) : null}

      <nav className="champ-market-categories" aria-label="Categorias do marketplace">
        <a href="/campeonatos?vagas=1"><span><Flame size={22} /></span><b>Vagas abertas</b><small>Prontas para entrar</small></a>
        <a href="/campeonatos?gratis=1"><span><Gift size={22} /></span><b>Grátis</b><small>Sem taxa de vaga</small></a>
        <a href="/campeonatos?ordem=premio"><span><Trophy size={22} /></span><b>Maior premiação</b><small>Prêmios em destaque</small></a>
        <a href="/campeonatos?ultimas=1"><span><Ticket size={22} /></span><b>Últimas vagas</b><small>Quase lotando</small></a>
        <a href="/campeonatos?hoje=1"><span><CalendarDays size={22} /></span><b>Começa hoje</b><small>Competições do dia</small></a>
      </nav>
    </section>
  )
}

export async function DirectoryPage({ kind }: { kind: DirectoryKind }) {
  const config = DIRECTORY_CONFIG[kind]
  const items = await listDirectory(kind)
  const isMarketplace = kind === 'campeonatos'
  return (
    <AppShell
      activeLabel={isMarketplace ? 'Competições' : undefined}
      loadSession
      withAuthOffset={!isMarketplace}
      mainClassName={`directory-page directory-theme-${kind} ${isMarketplace ? 'directory-market-page marketplace-shell-page' : ''} ${isMarketplace ? '' : 'page page-authenticated'}`}
    >
      <div className="directory-page-body directory-page-body-with-banner directory-immersive-shell">
        {isMarketplace ? (
          <ChampionshipMarketplaceIntro items={items} />
        ) : (
          <section className={`directory-hero directory-hero-banner directory-immersive-hero theme-${kind}`} data-theme={kind}>
            <span className="directory-hero-character" aria-hidden="true" />
            <div className="directory-hero-inner directory-immersive-content">
              <small>DIRETÓRIO PÚBLICO</small>
              <h1>{config.title}</h1>
              <p>{config.description}</p>
              {kind === 'equipes' || kind === 'jogadores' ? (
                <a
                  className="button primary directory-context-action"
                  href={`/?login=${kind === 'equipes' ? 'equipe' : 'jogador'}&returnTo=%2F%3Fpainel%3D1`}
                >
                  {kind === 'equipes' ? 'Minha equipe' : 'Meu perfil de jogo'}
                </a>
              ) : null}
            </div>
          </section>
        )}
        <div id={isMarketplace ? 'marketplace-catalog' : undefined}>
          <DirectoryListClient items={items} kind={kind} />
        </div>
      </div>
    </AppShell>
  )
}
