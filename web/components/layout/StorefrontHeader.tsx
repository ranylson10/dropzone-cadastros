'use client'

import { Input as UiInput } from '@/components/ui/Field'
import {
  CalendarDays, ChevronLeft, ChevronRight, Heart, Home, Menu,
  Search, ShoppingBag, Trophy, UserRound, UsersRound, X,
  type LucideIcon,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import './storefront-header.css'

type Props = {
  authenticated?: boolean
  onAccountClick?: () => void
}

type StoreNavItem = { label: string; href: string; icon: LucideIcon }
const PRIMARY_NAV: StoreNavItem[] = [
  { label: 'Início', href: '/', icon: Home },
  { label: 'Campeonatos', href: '/campeonatos', icon: Trophy },
  { label: 'Equipes', href: '/equipes', icon: UsersRound },
  { label: 'Jogadores', href: '/jogadores', icon: UserRound },
  { label: 'Ranking', href: '/rank', icon: Trophy },
  { label: 'Produtoras', href: '/produtoras', icon: UsersRound },
]
const SECONDARY_NAV: StoreNavItem[] = [
  { label: 'Agenda', href: '/agenda', icon: CalendarDays },
  { label: 'Favoritos', href: '/campeonatos?favoritos=1', icon: Heart },
  { label: 'Carrinho', href: '/carrinho', icon: ShoppingBag },
]

function isActive(pathname: string, href: string) {
  const path = href.split('?')[0]
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

/** Only the catalog, community and public profiles receive the discovery sidebar.
 * Checkout, token flows, live/OBS and workspace screens remain unchanged. */
function isDiscoveryPage(pathname: string) {
  if (['/', '/rank', '/agenda', '/carrinho', '/carteira',
    '/lili', '/afiliados', '/termos-de-servico', '/politica-de-privacidade',
    '/exclusao-de-dados'].includes(pathname)) return true
  if (/^\/campeonatos\/[^/]+\/regulamento\/?$/.test(pathname)) return true
  return /^\/(?:campeonatos|equipes|jogadores|produtoras|managers)(?:\/[^/]+)?\/?$/.test(pathname)
}

function StoreNavLink({ item, pathname, onNavigate }: {
  item: StoreNavItem; pathname: string; onNavigate?: () => void
}) {
  const Icon = item.icon
  const active = isActive(pathname, item.href)
  return (
    <a href={item.href} className={active ? 'active' : ''}
      aria-current={active ? 'page' : undefined} title={item.label} onClick={onNavigate}>
      <Icon size={19} aria-hidden="true" />
      <span>{item.label}</span>
    </a>
  )
}

export function StorefrontHeader({ authenticated = false, onAccountClick }: Props) {
  const pathname = usePathname() || '/'
  const returnTo = encodeURIComponent(pathname)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const discovery = isDiscoveryPage(pathname)
  const profileHref = authenticated ? '/?painel=1' : `/login?returnTo=${returnTo}`

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('dz_discovery_sidebar_collapsed') === '1') } catch { /* private mode */ }
  }, [])
  useEffect(() => { setMobileOpen(false) }, [pathname])

  function toggleSidebar() {
    setCollapsed((value) => {
      try { localStorage.setItem('dz_discovery_sidebar_collapsed', value ? '0' : '1') } catch { /* private mode */ }
      return !value
    })
  }

  return (
    <>
      <header className={`store-home-header ${discovery ? 'store-home-header--with-discovery' : ''}`} data-collapsed={collapsed ? 'true' : 'false'}>
        <div className={`store-home-width store-home-header-inner ${discovery ? 'store-home-header-inner--unified' : ''} ${pathname === '/campeonatos' ? 'store-home-header-inner--catalog' : ''}`}>
          <a className="store-home-brand" href="/" aria-label="DropZone — início">
            <img src="/branding/dropzone-platform.png" alt="" />
            <span><strong>DROPZONE</strong><small>COMPETITIVE SYSTEM</small></span>
          </a>

          <form className="store-home-header-search" action="/campeonatos" role="search">
            <Search size={18} aria-hidden="true" />
            <UiInput name="q" placeholder="Buscar campeonatos" aria-label="Buscar campeonatos" />
          </form>

          <div className="store-home-header-actions">
            <a href="/campeonatos?vagas=1" className="store-home-open-slots">Vagas abertas</a>
            <a href="/campeonatos?favoritos=1" aria-label="Favoritos" title="Favoritos"><Heart size={20} /></a>
            <a className="store-home-cart" href="/carrinho" aria-label="Carrinho" title="Carrinho"><ShoppingBag size={20} /></a>
            {authenticated && onAccountClick ? (
              <button type="button" onClick={onAccountClick} aria-label="Abrir minha área" title="Minha área"><UserRound size={20} /></button>
            ) : (
              <a href={profileHref} aria-label={authenticated ? 'Minha área' : 'Entrar'} title={authenticated ? 'Minha área' : 'Entrar'}><UserRound size={20} /></a>
            )}
            <button className="store-home-mobile-toggle" type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-expanded={mobileOpen} aria-controls="dz-public-mobile-menu"
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}>
              {mobileOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <div id="dz-public-mobile-menu" className="store-home-mobile-menu">
            <form action="/campeonatos" role="search">
              <Search size={17} /><UiInput name="q" placeholder="Buscar campeonatos" aria-label="Buscar campeonatos" />
              <button type="submit">Buscar</button>
            </form>
            <nav aria-label="Menu completo">
              {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
                <StoreNavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              ))}
            </nav>
          </div>
        ) : null}
      </header>

      {discovery ? (
        <>
          <aside className="dz-discovery-sidebar" aria-label="Navegação da plataforma"
            data-collapsed={collapsed ? 'true' : 'false'}>
            <div className="dz-discovery-sidebar-scroll">
              <div className="dz-discovery-sidebar-heading">
                <span>EXPLORAR</span>
                <button type="button" onClick={toggleSidebar}
                  aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                  aria-expanded={!collapsed} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
                  {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
              </div>
              <nav aria-label="Navegação principal">
                {PRIMARY_NAV.map((item) => <StoreNavLink key={item.href} item={item} pathname={pathname} />)}
              </nav>
              <div className="dz-discovery-sidebar-divider" />
              <div className="dz-discovery-sidebar-section">ACESSO RÁPIDO</div>
              <nav aria-label="Acesso rápido">
                {SECONDARY_NAV.map((item) => <StoreNavLink key={item.href} item={item} pathname={pathname} />)}
              </nav>
              <a href="/campeonatos?vagas=1" className="dz-discovery-sidebar-cta" title="Campeonatos com vagas abertas">
                <Trophy size={19} aria-hidden="true" />
                <span>Encontre seu próximo campeonato</span>
              </a>
            </div>
          </aside>
          <nav className="dz-public-bottom-nav" aria-label="Navegação inferior">
            {[
              PRIMARY_NAV[0], PRIMARY_NAV[1], PRIMARY_NAV[2], SECONDARY_NAV[0],
              { label: 'Minha área', href: profileHref, icon: UserRound },
            ].map((item) => <StoreNavLink key={item.href} item={item} pathname={pathname} />)}
          </nav>
        </>
      ) : null}
    </>
  )
}
