'use client'

import { ChevronDown, Loader2, LogOut, Menu, Plus, Wallet, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DropZoneRow } from '@/lib/types'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { APP_NAV, type AppNavItem } from './nav'
import { supabase } from '@/lib/supabase-browser'

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
  onCreateLinkedProfile?: () => void
  onSignOut?: () => void
  /** Guest CTA when not logged in */
  loginHref?: string
  loginLabel?: string
  /** Mostra chip de saldo (produtora / manager) */
  showWallet?: boolean
}

function profileMedia(account: DropZoneRow) {
  return account.data?.logo_url || account.data?.avatar_url || ''
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
    borderRadius: '50%',
    border: '2px solid rgba(201, 162, 39, 0.4)',
    background: '#eef0f4',
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
    borderRadius: '50%',
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
}: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [walletSaldo, setWalletSaldo] = useState<number | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const isAuthenticated = Boolean(profileName && onSignOut)

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  useEffect(() => {
    if (!showWallet || !isAuthenticated) {
      setWalletSaldo(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        const res = await fetch('/api/me/carteira', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) {
          setWalletSaldo(Number(json.carteira?.saldo_disponivel_centavos || 0))
        }
      } catch {
        if (!cancelled) setWalletSaldo(null)
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
            <SystemLogo size={44} alt="" fit="contain" />
          </span>
          <span className="app-brand-copy"><strong>DROPZONE</strong><small>COMPETITIVE SYSTEM</small></span>
        </a>

        <button
          className="app-mobile-toggle"
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          aria-expanded={mobileOpen}
          aria-label="Abrir menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className={`app-main-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Navegação principal">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={activeLabel === item.label ? 'active' : ''}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {isAuthenticated ? (
          <div className="app-profile" ref={profileRef} style={{ position: 'relative', maxWidth: 360 }}>
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
            <NotificationBell />
            <button
              type="button"
              className="app-profile-trigger"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                maxWidth: 240,
                minWidth: 0,
                border: 0,
                padding: '6px 8px',
                borderRadius: 8,
                background: 'transparent',
                cursor: 'pointer',
              }}
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
                <small style={{ display: 'block', color: '#6b7280', fontSize: 10 }}>
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
                  border: '1px solid #d5dae3',
                  borderRadius: 8,
                  background: '#fff',
                  boxShadow: '0 18px 50px rgba(15,23,42,.16)',
                  zIndex: 200,
                }}
              >
                <div className="app-profile-menu-head" style={{ padding: 14, borderBottom: '1px solid #d5dae3', background: '#f4f5f8' }}>
                  <strong>Perfis vinculados</strong>
                  <span style={{ display: 'block', marginTop: 3, color: '#6b7280', fontSize: 11 }}>
                    Perfis ligados à mesma conta
                  </span>
                </div>
                {accounts.map((item) => {
                  const media = profileMedia(item)
                  const isActive = item.id === activeAccountId
                  const isSwitching = item.id === switchingAccountId
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`linked-account-option ${isActive ? 'active' : ''} ${isSwitching ? 'is-switching' : ''}`}
                      disabled={isActive || Boolean(switchingAccountId)}
                      onClick={() => {
                        onSwitchAccount?.(item)
                        setProfileOpen(false)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        border: 0,
                        padding: '12px 14px',
                        background: isActive ? '#f4f5f8' : '#fff',
                        cursor: isActive ? 'default' : 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <LockedAvatar
                        src={media || undefined}
                        size={32}
                        fallback={String(item.name || item.username || 'DZ').slice(0, 2).toUpperCase()}
                      />
                      <span style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </b>
                        <small style={{ color: '#6b7280', fontSize: 11 }}>
                          {isSwitching ? 'Abrindo painel...' : `${item.profile_type} · @${item.username}`}
                        </small>
                      </span>
                      {isSwitching ? <Loader2 className="spin linked-account-spinner" size={15} /> : null}
                    </button>
                  )
                })}
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
                      borderTop: '1px solid #d5dae3',
                      padding: '12px 14px',
                      background: '#fff',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    <Plus size={16} /> Criar perfil vinculado
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
                    borderTop: '1px solid #d5dae3',
                    padding: '12px 14px',
                    background: '#fff',
                    color: '#dc2626',
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
