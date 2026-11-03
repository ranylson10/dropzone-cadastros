'use client'

import Link from 'next/link'
import Form from 'next/form'

import { Input as UiInput } from '@/components/ui/Field'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { useDisclosureFocus } from '@/components/ui/useDisclosureFocus'
import { AccountEditDialog } from '@/features/auth/AccountEditDialog'
import { WorkspacePanelSwitcher } from '@/components/workspace/WorkspacePanelSwitcher'
import type { AccountIdentity, DropZoneRow } from '@/lib/types'
import { signOutEverywhere } from '@/lib/auth-client-state'
import { hasPublicDiscoveryNavigation } from './nav'
import {
  CalendarDays, ChevronLeft, ChevronRight, Heart, Home, Menu, MessageCircle,
  LogOut, Pencil, Search, ShoppingBag, Trophy, UserRound, UsersRound, X,
  type LucideIcon,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState, type MouseEvent } from 'react'
import './storefront-header.css'

type Props = {
  authenticated?: boolean
  identity?: AccountIdentity | null
  onAccountClick?: () => void
  onSignOut?: () => void | Promise<void>
  activeAccountId?: string
  onSelectPanel?: (context: DropZoneRow) => void | Promise<void>
}

type StoreNavItem = { label: string; href: string; icon: LucideIcon; shortLabel?: string; active?: boolean }
const PRIMARY_NAV: StoreNavItem[] = [
  { label: 'Início', href: '/', icon: Home },
  { label: 'Campeonatos', href: '/campeonatos', icon: Trophy },
  { label: 'Equipes', href: '/equipes', icon: UsersRound },
  { label: 'Jogadores', href: '/jogadores', icon: UserRound },
]
const SECONDARY_NAV: StoreNavItem[] = [
  { label: 'Produtoras', href: '/produtoras', icon: UsersRound },
  { label: 'Ranking', href: '/rank', icon: Trophy },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays },
  { label: 'Favoritos', href: '/campeonatos?favoritos=1', icon: Heart },
  { label: 'Carrinho', href: '/carrinho', icon: ShoppingBag },
  { label: 'Lili', href: '/lili', icon: MessageCircle },
]

function isActive(pathname: string, href: string) {
  const path = href.split('?')[0]
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

function StoreNavLink({ item, pathname, onNavigate }: {
  item: StoreNavItem; pathname: string; onNavigate?: () => void
}) {
  const Icon = item.icon
  const active = item.active ?? isActive(pathname, item.href)
  return (
    <Link href={item.href} className={active ? 'active' : ''}
      aria-current={active ? 'page' : undefined} aria-label={item.label} title={item.label} onClick={onNavigate}>
      <Icon size={19} aria-hidden="true" />
      <span>{item.shortLabel || item.label}</span>
    </Link>
  )
}

export function StorefrontHeader({ authenticated = false, identity, onAccountClick, onSignOut, activeAccountId, onSelectPanel }: Props) {
  const pathname = usePathname() || '/'
  const returnTo = encodeURIComponent(pathname)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(false)
  const [savedIdentity, setSavedIdentity] = useState<AccountIdentity | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [accountError, setAccountError] = useState('')
  const accountMenuId = useId()
  const accountPopup = useDisclosureFocus(accountOpen, () => setAccountOpen(false))
  const mobilePopup = useDisclosureFocus(mobileOpen, () => setMobileOpen(false), true, true)
  const [collapsed, setCollapsed] = useState(false)
  const discovery = hasPublicDiscoveryNavigation(pathname)
  const isAuthenticated = authenticated || Boolean(identity)
  const profile = savedIdentity || identity || {}
  const profileName = profile.name || profile.username || 'Conta DropZone'
  const profileHref = isAuthenticated ? '/?painel=1' : `/login?returnTo=${returnTo}`

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('dz_discovery_sidebar_collapsed') === '1') } catch { /* private mode */ }
  }, [])
  useEffect(() => { setMobileOpen(false); setAccountOpen(false) }, [pathname])
  useEffect(() => { setSavedIdentity(null) }, [identity?.name, identity?.username, identity?.email, identity?.avatar_url])

  function toggleAccount(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.focus({ preventScroll: true })
    setMobileOpen(false)
    setAccountOpen((value) => !value)
  }

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setAccountError('')
    try {
      if (onSignOut) await onSignOut()
      else {
        await signOutEverywhere()
        window.location.assign('/')
      }
      setAccountOpen(false)
      setSavedIdentity(null)
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : 'Não foi possível sair da conta.')
    } finally {
      setSigningOut(false)
    }
  }

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
          <Link className="store-home-brand" href="/" aria-label="DropZone. O seu jogo começa aqui — início">
            <SystemLogo size={44} alt="" variant="accent" />
            <span><strong>DROPZONE<span className="dz-brand-period" aria-hidden="true">.</span></strong><small aria-hidden="true">O SEU JOGO COMEÇA AQUI</small></span>
          </Link>

          <Form className="store-home-header-search" action="/campeonatos" role="search">
            <Search size={18} aria-hidden="true" />
            <UiInput name="q" placeholder="Buscar campeonatos" aria-label="Buscar campeonatos" />
          </Form>

          <div className="store-home-header-actions">
            <Link href="/campeonatos?vagas=1" className="store-home-open-slots">Vagas abertas</Link>
            <Link href="/campeonatos?favoritos=1" aria-label="Favoritos" title="Favoritos"><Heart size={20} /></Link>
            <Link className="store-home-cart" href="/carrinho" aria-label="Carrinho" title="Carrinho"><ShoppingBag size={20} /></Link>
            {isAuthenticated ? (
              <div className="store-home-account">
                <button type="button" className="store-home-account-toggle" onClick={toggleAccount}
                  aria-label="Abrir menu da conta" title={profileName} aria-expanded={accountOpen} aria-controls={accountMenuId}>
                  {profile.avatar_url ? <img src={profile.avatar_url} alt="Foto do perfil" width={32} height={32} /> : <span aria-hidden="true">{profileName.slice(0, 2).toUpperCase()}</span>}
                </button>
                {accountOpen ? (
                  <div ref={accountPopup.panelRef} id={accountMenuId} className="store-home-account-menu" role="region" aria-label="Minha conta">
                    <div className="store-home-account-info"><strong>{profileName}</strong><small>{profile.username ? `@${profile.username}` : profile.email}</small></div>
                    <button type="button" onClick={() => { accountPopup.close(true); setEditingAccount(true) }}><Pencil size={17} /> Editar informações</button>
                    {onAccountClick ? (
                      <button type="button" onClick={() => { setAccountOpen(false); onAccountClick() }}><UserRound size={17} /> Minha área</button>
                    ) : (
                      <Link href="/?painel=1" onClick={() => setAccountOpen(false)}><UserRound size={17} /> Minha área</Link>
                    )}
                    <button type="button" disabled={signingOut} onClick={() => void signOut()}><LogOut size={17} /> {signingOut ? 'Saindo…' : 'Sair da conta'}</button>
                    {accountError ? <p role="alert">{accountError}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href={profileHref} aria-label="Entrar" title="Entrar"><UserRound size={20} /></Link>
            )}
            <button className="store-home-mobile-toggle" type="button"
              onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setAccountOpen(false); setMobileOpen((value) => !value) }}
              aria-expanded={mobileOpen} aria-controls="dz-public-mobile-menu"
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}>
              {mobileOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <>
            <button type="button" className="dz-public-menu-scrim"
              aria-label="Fechar menu de navegação" onClick={() => mobilePopup.close(true)} />
            <div ref={mobilePopup.panelRef} id="dz-public-mobile-menu" className="store-home-mobile-menu" tabIndex={-1}
              role="dialog" aria-modal="true" aria-label="Menu completo do DropZone">
              <div className="dz-public-menu-heading">
                <span className="dz-public-menu-handle" aria-hidden="true" />
                <div><small>FORA DO LOBBY. DENTRO DO JOGO.</small><strong>Seu próximo movimento<span className="dz-brand-period">.</span></strong></div>
                <button type="button" aria-label="Fechar menu" onClick={() => mobilePopup.close(true)}><X size={21} aria-hidden="true" /></button>
              </div>
              <Form action="/campeonatos" role="search" aria-label="Busca no menu de navegação" onSubmit={() => setMobileOpen(false)}>
                <Search size={17} /><UiInput name="q" placeholder="Buscar campeonatos" aria-label="Buscar campeonatos" />
                <button type="submit">Buscar</button>
              </Form>
              <div className="dz-menu-account-entry">
                <UserRound size={22} aria-hidden="true" />
                <div><strong>{isAuthenticated ? profileName : 'Faça parte do jogo'}</strong><span>{isAuthenticated ? 'Suas equipes, jogadores e competições' : 'Sua equipe e suas competições, no mesmo lugar.'}</span></div>
                <Link href={profileHref} onClick={() => setMobileOpen(false)} aria-label={isAuthenticated ? 'Abrir minha área' : 'Entrar na minha conta'}><ChevronRight size={22} /></Link>
              </div>
              <nav className="dz-menu-primary" aria-label="Explorar">
                {PRIMARY_NAV.map((item) => (
                  <StoreNavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                ))}
              </nav>
              <div className="dz-menu-section-label">ACOMPANHE E ORGANIZE</div>
              <nav className="dz-menu-secondary" aria-label="Mais destinos">
                {SECONDARY_NAV.map((item) => <StoreNavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />)}
              </nav>
              <div className="dz-menu-footer"><span>DROPZONE / FREE FIRE</span><Link href="/termos-de-servico">Termos de uso</Link></div>
            </div>
          </>
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
              <Link href="/campeonatos?vagas=1" className="dz-discovery-sidebar-cta" title="Campeonatos com vagas abertas">
                <Trophy size={19} aria-hidden="true" />
                <span>Encontre seu próximo campeonato</span>
              </Link>
            </div>
          </aside>
          <nav className="dz-public-bottom-nav" aria-label="Navegação inferior do aplicativo">
            {PRIMARY_NAV.map((item) => <StoreNavLink key={item.href} item={item} pathname={pathname} />)}
            <WorkspacePanelSwitcher activeAccountId={activeAccountId} onSelect={onSelectPanel}
              onBeforeOpen={() => { setMobileOpen(false); setAccountOpen(false) }} />
          </nav>
        </>
      ) : null}
      {editingAccount && isAuthenticated ? <AccountEditDialog identity={profile} onClose={() => setEditingAccount(false)} onSaved={(next) => { setSavedIdentity(next); setEditingAccount(false) }} /> : null}
    </>
  )
}
