'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Input as UiInput } from '@/components/ui/Field'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  Gift,
  Search,
  Shield,
  Swords,
  Trophy,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import type { DropZoneRow } from '@/lib/types'
import { StorefrontHeader } from '@/components/layout/StorefrontHeader'
import { ChampionshipCard } from '@/components/championship'
import type { VacancyCatalogItem } from '@/features/vacancies/VacancyCard'
import { registrationAmount, registrationPriceLabel } from '@/lib/registration-price'
import { championshipCommerceItem, useCommerce } from '@/features/commerce'
import { DEFAULT_HOME_CONFIG, normalizeHomeConfig, type HomeConfig } from './home-config'
import './home-platform-v15.css'

type Props = {
  account: DropZoneRow | null
  accounts: DropZoneRow[]
  onOpenPanel: (target?: DropZoneRow) => void | Promise<void>
}

function priceLabel(item: VacancyCatalogItem) {
  return registrationPriceLabel(item.valor_inscricao)
}

function safeHref(value: string, fallback = '/campeonatos') {
  const raw = String(value || '').trim()
  return raw.startsWith('/') || /^https?:\/\//i.test(raw) ? raw : fallback
}


const CATEGORY_ICONS = [Trophy, Shield, UsersRound, Swords, Gift, UserPlus] as const

export function AuthenticatedHomeFeed({ account, onOpenPanel }: Props) {
  const router = useRouter()
  const [vacancies, setVacancies] = useState<VacancyCatalogItem[]>([])
  const [loadingVacancies, setLoadingVacancies] = useState(true)
  const [homeConfig, setHomeConfig] = useState<HomeConfig>(DEFAULT_HOME_CONFIG)
  const [heroIndex, setHeroIndex] = useState(0)
  const [searchValue, setSearchValue] = useState('')
  const [footerOpen, setFooterOpen] = useState(false)
  const { cartIds, wishlistIds, pendingCartIds, pendingWishlistIds, toggleCart, toggleWishlist } = useCommerce()

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/api/vagas', { cache: 'no-store' }).then((response) => response.json()).catch(() => ({})),
      fetch('/api/site/home', { cache: 'no-store' }).then((response) => response.json()).catch(() => ({})),
    ]).then(([vacancyData, homeData]) => {
      if (!active) return
      const announcements = Array.isArray(vacancyData.announcements) ? vacancyData.announcements : []
      setVacancies(announcements.filter((item: VacancyCatalogItem) => Number(item.vagas_livres || 0) > 0).slice(0, 24))
      setHomeConfig(normalizeHomeConfig(homeData.config))
    }).finally(() => {
      if (active) setLoadingVacancies(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (homeConfig.hero_slides.length <= 1) return
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % homeConfig.hero_slides.length)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [homeConfig.hero_slides.length])

  const hero = homeConfig.hero_slides[heroIndex] || homeConfig.hero_slides[0] || DEFAULT_HOME_CONFIG.hero_slides[0]
  const featured = useMemo(() => {
    return [...vacancies]
      .sort((a, b) => Number(b.premiacao || 0) - Number(a.premiacao || 0))
      .slice(0, 6)
  }, [vacancies])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    const query = searchValue.trim()
    router.push(query ? `/campeonatos?q=${encodeURIComponent(query)}` : '/campeonatos')
  }

  return (
    <div className="store-home home-platform-v15">
      <StorefrontHeader
        authenticated={Boolean(account)}
        onAccountClick={account ? () => void onOpenPanel(account) : undefined}
      />

      <div className="store-home-body">
        <section className={`store-home-hero ${hero.image_url ? 'has-media' : 'no-media'}`} aria-label="Destaques">
          <div className="store-home-hero-media" aria-hidden="true">
            {hero.image_url ? <img src={hero.image_url} alt="" /> : null}
          </div>
          <div className="store-home-hero-shade" />
          <div className="store-home-width store-home-hero-inner">
            <div className="store-home-hero-copy">
              <small>{hero.eyebrow}</small>
              <h1>{hero.title}<em>{hero.accent}</em></h1>
              <p>{hero.description}</p>
              <div className="store-home-hero-buttons">
                <Link className="primary" href={safeHref(hero.primary_href)}>{hero.primary_label}</Link>
                <Link href={safeHref(hero.secondary_href)}>{hero.secondary_label}</Link>
              </div>
              <div className="store-home-hero-dots" aria-label="Selecionar destaque">
                {homeConfig.hero_slides.map((_, index) => (
                  <button
                    type="button"
                    key={index}
                    className={index === heroIndex ? 'active' : ''}
                    onClick={() => setHeroIndex(index)}
                    aria-label={`Destaque ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            {featured.some((item) => item.banner_url || item.logo_url) ? (
              <div className="store-home-hero-previews" aria-label="Campeonatos em destaque">
                {featured.filter((item) => item.banner_url || item.logo_url).slice(0, 3).map((item) => (
                  <Link key={item.id} href={`/campeonatos/${encodeURIComponent(item.id)}`} aria-label={`Ver ${item.nome}`}>
                    <img src={item.banner_url || item.logo_url || ''} alt="" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="store-home-hero-sidecopy">
                <strong>{hero.side_title}</strong>
                <p>{hero.side_text}</p>
                <Link href={safeHref(hero.primary_href)}>VER AGORA <ArrowRight size={14} /></Link>
              </div>
            )}
          </div>
        </section>

        <div className="store-home-width store-home-content">
          <form className="store-home-content-search" onSubmit={submitSearch} role="search">
            <Search size={18} aria-hidden="true" />
            <UiInput type="search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Buscar campeonatos, produtoras e formatos..." aria-label="Buscar campeonatos" />
            <button type="submit">Buscar <ArrowRight size={16} /></button>
          </form>
          <section className="store-home-section">
            <header className="store-home-section-head">
              <h2><span className="store-home-desktop-heading">EXPLORE POR <em>CATEGORIA</em></span><span className="store-home-mobile-heading">Categorias</span></h2>
              <Link href="/campeonatos">Ver todos <ArrowRight size={14} /></Link>
            </header>
            <div className="store-home-categories">
              {homeConfig.categories.map((category, index) => {
                const Icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length]
                return (
                  <Link href={safeHref(category.href)} key={`${category.title}-${index}`}>
                    <span className="store-home-category-media">
                      {category.image_url ? <img src={category.image_url} alt="" /> : <Icon aria-hidden /> }
                    </span>
                    <span className="store-home-category-copy"><strong>{category.title}</strong><small>{category.subtitle} <ArrowRight size={11} /></small></span>
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="store-home-section">
            <header className="store-home-section-head">
              <h2><span className="store-home-desktop-heading">CAMPEONATOS <em>EM DESTAQUE</em></span><span className="store-home-mobile-heading">Campeonatos em destaque</span></h2>
              <Link href="/campeonatos?vagas=1">Ver todos <ArrowRight size={14} /></Link>
            </header>
            <div className="store-home-products">
              {loadingVacancies ? Array.from({ length: 6 }).map((_, index) => <div className="store-home-product-skeleton" key={index} />) : null}
              {!loadingVacancies && featured.map((item) => {
                const href = `/campeonatos/${encodeURIComponent(item.id)}`
                const inCart = cartIds.has(item.id)
                const wishlisted = wishlistIds.has(item.id)
                const freeSlots = Number(item.vagas_livres || 0)
                return (
                  <ChampionshipCard
                    key={item.id}
                    championship={{
                      id: item.id,
                      name: item.nome,
                      href,
                      bannerUrl: item.banner_url || item.logo_url || null,
                      producerLabel: item.produtora_nome || 'Campeonato Free Fire',
                      formatLabel: item.tipo || null,
                      priceLabel: priceLabel(item),
                      freeSlots,
                      totalSlots: Number(item.total_vagas || 0),
                      statusLabel: freeSlots > 0 && freeSlots <= 3 ? 'Últimas vagas' : freeSlots > 0 ? 'Vagas abertas' : 'Sem vagas',
                      secondaryBadge: registrationAmount(item.valor_inscricao) === 0 ? 'Grátis' : null,
                    }}
                    favorite={wishlisted}
                    inCart={inCart}
                    favoritePending={pendingWishlistIds.has(item.id)}
                    cartPending={pendingCartIds.has(item.id)}
                    cartDisabled={(freeSlots <= 0 || registrationAmount(item.valor_inscricao) == null) && !inCart}
                    onFavorite={() => void toggleWishlist(championshipCommerceItem(item))}
                    onCart={() => void toggleCart(championshipCommerceItem(item))}
                  />
                )
              })}
              {!loadingVacancies && !featured.length ? (
                <div className="store-home-products-empty">Nenhum campeonato com vagas abertas no momento.</div>
              ) : null}
            </div>
          </section>

          <section className="store-home-promos">
            {homeConfig.promos.map((promo, index) => (
              <article className={`store-home-promo ${promo.theme}`} key={index}>
                <div className="store-home-promo-media">{promo.image_url ? <img src={promo.image_url} alt="" /> : null}</div>
                <div className="store-home-promo-shade" />
                <div className="store-home-promo-copy">
                  <small>{promo.eyebrow}</small>
                  <h3>{promo.title}</h3>
                  <p>{promo.description}</p>
                  <Link href={safeHref(promo.href)}>{promo.cta_label}</Link>
                </div>
              </article>
            ))}
          </section>
        </div>

        <section className="store-home-newsletter">
          <div className="store-home-width store-home-newsletter-inner">
            <div><strong>ENCONTRE SUA PRÓXIMA DISPUTA</strong><small>Veja campeonatos, inscrições e vagas disponíveis.</small></div>
            <Link className="store-home-discovery-cta" href="/campeonatos?vagas=1">VER CAMPEONATOS <ArrowRight size={16} /></Link>
          </div>
        </section>
      </div>

      <footer className="store-home-footer">
        <button type="button" className="store-home-footer-toggle" aria-expanded={footerOpen}
          aria-controls="store-home-footer-links" onClick={() => setFooterOpen(value => !value)}>
          Ajuda e informações <ChevronDown size={16} aria-hidden="true" />
        </button>
        <div id="store-home-footer-links" className={`store-home-width store-home-footer-grid ${footerOpen ? 'is-open' : ''}`}>
          <div className="store-home-footer-brand">
            <Link className="store-home-brand light" href="/">
              <SystemLogo size={44} alt="" variant="light" />
              <span><strong>DROPZONE</strong><small>COMPETITIVE SYSTEM</small></span>
            </Link>
            <p>Campeonatos, equipes, jogadores e estatísticas de Free Fire.</p>
          </div>
          <div><strong>COMPETIR</strong><Link href="/campeonatos">Campeonatos</Link><Link href="/equipes">Equipes</Link><Link href="/jogadores">Jogadores</Link><Link href="/rank">Ranking</Link></div>
          <div><strong>AJUDA</strong><Link href="/agenda">Agenda</Link><Link href="/equipes">Equipes</Link><Link href="/termos-de-servico">Termos de serviço</Link><Link href="/politica-de-privacidade">Privacidade</Link></div>
          <div><strong>CONTA</strong>{account ? <button type="button" onClick={() => void onOpenPanel(account)}>Minha área</button> : <Link href="/login?returnTo=%2F">Entrar</Link>}<Link href="/carrinho">Carrinho</Link><Link href="/afiliados">Afiliados</Link></div>
        </div>
        <div className="store-home-width store-home-footer-bottom">© {new Date().getFullYear()} DROPZONE. TODOS OS DIREITOS RESERVADOS.</div>
      </footer>

    </div>
  )
}
