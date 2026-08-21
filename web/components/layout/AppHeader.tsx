'use client'

import { CalendarDays, ChevronDown, Globe2, Home, LayoutDashboard, Loader2, LogOut, Menu, Plus, Shield, Trophy, UsersRound, Wallet, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DropZoneRow, ProfileType } from '@/lib/types'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { APP_NAV, type AppNavItem } from './nav'
import { supabase } from '@/lib/supabase-browser'
import { useGlobalLocale } from '@/features/i18n/global-locale'

export type AppHeaderNavItem = AppNavItem

type AppHeaderProps = {
  /** Defaults to global APP_NAV — change only in nav.ts */
  navItems?: AppHeaderNavItem[]
  activeLabel?: string
  profileName?: string
  profileSubtitle?: string
  profileImage?: string
  accounts?: DropZoneRow[]
  activeAccountId?: string
  switchingAccountId?: string
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: (profileType?: ProfileType) => void
  onSignOut?: () => void
  /** Guest CTA when not logged in */
  loginHref?: string
  loginLabel?: string
  /** Mostra chip de saldo (produtora / manager) */
  showWallet?: boolean
  /** Link para /admin se for admin do sistema */
  showAdmin?: boolean
}

function profileMedia(account: DropZoneRow) {
  return account.data?.logo_url || account.data?.avatar_url || ''
}

function areaLabel(type?: string | null) {
  if (type === 'equipe') return 'Minha equipe'
  if (type === 'jogador') return 'Perfil competitivo'
  if (type === 'produtora') return 'Minha produtora'
  if (type === 'manager') return 'Afiliados'
  if (type === 'broadcast') return 'Transmissão'
  return 'Área da conta'
}

/**
 * Avatar com tamanho travado em style inline + attrs HTML.
 * Não depende de CSS global — evita logo estourar a tela.
 */
function LockedAvatar({
  src,
  size,
  fallback,
}: {
  src?: string
  size: number
  fallback: string
}) {
  const box: CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    overflow: 'hidden',
    borderRadius: '10px',
    border: 0,
    background: 'var(--ui-surface-soft, #202125)',
    flex: `0 0 ${size}px`,
    boxSizing: 'border-box',
  }
  const img: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    objectFit: 'cover',
    display: 'block',
    borderRadius: '10px',
  }
  return (
    <span style={box} className="app-profile-avatar" data-locked-avatar={size}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} style={img} />
      ) : (
        <b style={{ fontSize: Math.max(10, size * 0.32), fontWeight: 900 }}>{fallback}</b>
      )}
    </span>
  )
}

export function AppHeader({
  navItems = APP_NAV,
  activeLabel,
  profileName,
  profileSubtitle,
  profileImage,
  accounts = [],
  activeAccountId,
  switchingAccountId,
  onSwitchAccount,
  onCreateLinkedProfile,
  onSignOut,
  loginHref = '/login?returnTo=%2F',
  loginLabel = 'Entrar no sistema',
  showWallet = false,
  showAdmin = false,
}: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [walletSaldo, setWalletSaldo] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [globalLocale, changeGlobalLocale] = useGlobalLocale()
  const profileRef = useRef<HTMLDivElement>(null)
  const languageRef = useRef<HTMLDivElement>(null)
  const isAuthenticated = Boolean(profileName && onSignOut)

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      const mobileProfileTrigger = target?.closest('.app-mobile-profile-switcher')
      if (profileRef.current && !profileRef.current.contains(event.target as Node) && !mobileProfileTrigger) setProfileOpen(false)
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) setLanguageOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setWalletSaldo(null)
      setIsAdmin(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return

        if (showWallet) {
          const res = await fetch('/api/me/carteira', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          const json = await res.json().catch(() => ({}))
          if (!cancelled && res.ok) {
            setWalletSaldo(Number(json.carteira?.saldo_disponivel_centavos || 0))
          }
        } else if (!cancelled) {
          setWalletSaldo(null)
        }

        // Sempre revalida admin no backend (não confiar no prop sozinho)
        const adminRes = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const adminJson = await adminRes.json().catch(() => ({}))
        if (!cancelled) setIsAdmin(Boolean(adminJson.isAdmin))
      } catch {
        if (!cancelled) {
          setWalletSaldo(null)
          setIsAdmin(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showWallet, isAuthenticated, activeAccountId])

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a className="app-brand" href="/" aria-label="DropZone — início">
          <span className="app-brand-logo">
            <SystemLogo size={44} alt="" fit="contain" variant="default" />
          </span>
          <span className="app-brand-copy">
            <strong aria-label="DropZone"><span>Drop</span><span>Zone</span></strong>
            <small>COMPETITIVE SYSTEM</small>
          </span>
        </a>

        <button
          className="app-mobile-toggle"
          type="button"
          onClick={() => {
            setProfileOpen(false)
            setLanguageOpen(false)
            setMobileOpen((value) => !value)
          }}
          aria-expanded={mobileOpen}
          aria-label="Abrir menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {mobileOpen ? (
          <button
            type="button"
            className="app-mobile-nav-backdrop"
            aria-label="Fechar navegação"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <nav className={`app-main-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Navegação principal">
          {navItems.map((item) => {
            const hasChildren = Boolean(item.children?.length)
            if (!hasChildren) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={activeLabel === item.label ? 'active' : ''}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              )
            }
            return (
              <div
                key={item.label}
                className={`app-nav-dropdown ${activeLabel === item.label ? 'active' : ''}`}
              >
                <a
                  href={item.href}
                  className={`app-nav-parent ${activeLabel === item.label ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                  <ChevronDown size={14} className="app-nav-caret" aria-hidden />
                </a>
                <div className="app-nav-submenu" role="menu">
                  {item.children!.map((child) => (
                    <a
                      key={child.href}
                      href={child.href}
                      role="menuitem"
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              </div>
            )
          })}
          {isAuthenticated ? (
            <div className="app-mobile-nav-account">
              <a href="/?painel=1" onClick={() => setMobileOpen(false)}>
                <LayoutDashboard size={16} />
                <span>Meu painel</span>
              </a>
              {showWallet ? (
                <a href="/carteira" onClick={() => setMobileOpen(false)}>
                  <Wallet size={16} />
                  <span>Carteira</span>
                  <strong>
                    {walletSaldo == null
                      ? 'Abrir'
                      : new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(walletSaldo / 100)}
                  </strong>
                </a>
              ) : null}
              {isAdmin || showAdmin ? (
                <a href="/admin" onClick={() => setMobileOpen(false)}>
                  <Shield size={16} />
                  <span>Administração</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </nav>

        <nav className="app-mobile-dock" aria-label="Navegação rápida">
          <a href="/" className={activeLabel === 'Início' ? 'active' : ''} onClick={() => setMobileOpen(false)}>
            <Home size={19} aria-hidden />
            <span>Início</span>
          </a>
          <a href="/campeonatos" className={activeLabel === 'Campeonatos' ? 'active' : ''} onClick={() => setMobileOpen(false)}>
            <Trophy size={19} aria-hidden />
            <span>Campeonatos</span>
          </a>
          <a href="/agenda" className={activeLabel === 'Agenda' ? 'active' : ''} onClick={() => setMobileOpen(false)}>
            <CalendarDays size={19} aria-hidden />
            <span>Agenda</span>
          </a>
          <a href="/equipes" className={activeLabel === 'Equipes' ? 'active' : ''} onClick={() => setMobileOpen(false)}>
            <UsersRound size={19} aria-hidden />
            <span>Equipes</span>
          </a>
          {isAuthenticated ? (
            <button
              type="button"
              className={`app-mobile-profile-switcher ${profileOpen ? 'active' : ''}`}
              onClick={() => {
                setMobileOpen(false)
                setLanguageOpen(false)
                setProfileOpen((value) => !value)
              }}
              aria-expanded={profileOpen}
              aria-label="Abrir minha conta"
            >
              <LockedAvatar
                src={profileImage || undefined}
                size={24}
                fallback={String(profileName).slice(0, 2).toUpperCase()}
              />
              <span>Conta</span>
            </button>
          ) : (
            <a href={loginHref} className="app-mobile-profile-switcher">
              <UsersRound size={19} aria-hidden />
              <span>Entrar</span>
            </a>
          )}
        </nav>

        <div className="app-global-language" data-no-translate aria-label="Language" ref={languageRef}>
          <button
            type="button"
            className="app-global-language-trigger"
            aria-expanded={languageOpen}
            aria-label="Alterar idioma"
            onClick={() => setLanguageOpen((value) => !value)}
          >
            <Globe2 size={14} />
            <span>{globalLocale === 'pt-BR' ? 'PT' : globalLocale.toUpperCase()}</span>
            <ChevronDown size={14} className={languageOpen ? 'rotated' : ''} />
          </button>
          {languageOpen ? (
            <div className="app-global-language-menu" role="menu">
              {(['pt-BR', 'es', 'en'] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={globalLocale === item ? 'active' : ''}
                  onClick={() => {
                    changeGlobalLocale(item)
                    setLanguageOpen(false)
                  }}
                >
                  <span>{item === 'pt-BR' ? 'PT' : item.toUpperCase()}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {isAuthenticated ? (
          <div className="app-profile" ref={profileRef}>
            {showWallet ? (
              <a
                href="/carteira"
                className="app-wallet-chip"
                title="Abrir carteira"
                onClick={() => setMobileOpen(false)}
              >
                <Wallet size={15} />
                <span>
                  {walletSaldo == null
                    ? 'Carteira'
                    : new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(walletSaldo / 100)}
                </span>
              </a>
            ) : null}
            {isAdmin || showAdmin ? (
              <a
                href="/admin"
                className="app-admin-chip"
                title="Administração do sistema"
                onClick={() => setMobileOpen(false)}
              >
                Admin
              </a>
            ) : null}
            <NotificationBell />
            <button
              type="button"
              className="app-profile-trigger"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
            >
              <LockedAvatar
                src={profileImage || undefined}
                size={40}
                fallback={String(profileName).slice(0, 2).toUpperCase()}
              />
              <span className="app-profile-copy" style={{ minWidth: 0, overflow: 'hidden' }}>
                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profileName}
                </strong>
                <small style={{ display: 'block', color: 'var(--ui-muted)', fontSize: 10 }}>
                  {profileSubtitle || 'Conta DropZone'}
                </small>
              </span>
              <ChevronDown size={16} className={profileOpen ? 'rotated' : ''} />
            </button>

            {profileOpen ? (
              <div
                className="app-profile-menu linked-account-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 280,
                  maxWidth: '90vw',
                  maxHeight: '70vh',
                  overflow: 'auto',
                  border: '1px solid var(--ui-line)',
                  borderRadius: 8,
                  background: 'var(--ui-surface-raised)',
                  boxShadow: '0 18px 50px rgba(0,0,0,.32)',
                  zIndex: 200,
                }}
              >
                <div className="app-profile-menu-head" style={{ padding: 14, borderBottom: '1px solid var(--ui-line)', background: 'var(--ui-surface)' }}>
                  <strong>Minha conta</strong>
                  <span style={{ display: 'block', marginTop: 3, color: 'var(--ui-muted)', fontSize: 11 }}>
                    Áreas liberadas nesta conta
                  </span>
                </div>
                <a
                  href="/#minhas-areas"
                  onClick={() => {
                    setProfileOpen(false)
                    setMobileOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    padding: '13px 14px',
                    background: 'linear-gradient(135deg, var(--ui-primary, #c9b766), var(--ui-primary-light, #dfcf85))',
                    color: '#171717',
                    textDecoration: 'none',
                    fontWeight: 900,
                    borderBottom: '1px solid rgba(0,0,0,.22)',
                    boxShadow: 'inset 0 -1px rgba(255,255,255,.2)',
                  }}
                >
                  <LayoutDashboard size={17} strokeWidth={2.5} /> Minhas áreas
                </a>
                {showWallet ? (
                  <a
                    href="/carteira"
                    onClick={() => {
                      setProfileOpen(false)
                      setMobileOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      width: '100%',
                      borderTop: '1px solid var(--ui-line)',
                      padding: '12px 14px',
                      background: 'transparent',
                      color: 'var(--ui-text)',
                      textDecoration: 'none',
                      fontWeight: 800,
                    }}
                  >
                    <Wallet size={16} />
                    {walletSaldo == null
                      ? 'Carteira'
                      : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(walletSaldo / 100)}
                  </a>
                ) : null}
                {onCreateLinkedProfile ? (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateLinkedProfile()
                      setProfileOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      width: '100%',
                      border: 0,
                      borderTop: '1px solid var(--ui-line)',
                      padding: '12px 14px',
                      background: 'transparent',
                      color: 'var(--ui-text)',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                  <Plus size={16} /> Ativar nova área
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onSignOut}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    border: 0,
                    borderTop: '1px solid var(--ui-line)',
                    padding: '12px 14px',
                    background: 'transparent',
                    color: 'var(--ui-danger, #d76c6c)',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  <LogOut size={16} /> Sair de todos
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <a className="app-header-login" href={loginHref}>
            {loginLabel}
          </a>
        )}
      </div>
    </header>
  )
}
