'use client'

import { ChevronDown, Loader2, LogOut, Menu, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { DropZoneRow } from '@/lib/types'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { APP_NAV, type AppNavItem } from './nav'

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
}: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const isAuthenticated = Boolean(profileName && onSignOut)

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a className="app-brand" href="/" aria-label="DropZone — início">
          <span className="app-brand-logo">
            <SystemLogo size={42} alt="" fit="cover" />
          </span>
          <span className="app-brand-copy">
            <strong>DROPZONE</strong>
            <small>COMPETITIVE SYSTEM</small>
          </span>
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
          <div className="app-profile" ref={profileRef}>
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
              <span className="app-profile-copy">
                <strong>{profileName}</strong>
                <small>{profileSubtitle || 'Conta DropZone'}</small>
              </span>
              <ChevronDown size={16} className={profileOpen ? 'rotated' : ''} />
            </button>

            {profileOpen ? (
              <div className="app-profile-menu linked-account-menu">
                <div className="app-profile-menu-head">
                  <strong>Perfis vinculados</strong>
                  <span>Perfis ligados à mesma conta</span>
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
                    >
                      <LockedAvatar
                        src={media || undefined}
                        size={32}
                        fallback={String(item.name || item.username || 'DZ').slice(0, 2).toUpperCase()}
                      />
                      <span>
                        <b>{item.name}</b>
                        <small>
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
                    className="app-profile-menu-action"
                    onClick={() => {
                      onCreateLinkedProfile()
                      setProfileOpen(false)
                    }}
                  >
                    <Plus size={16} /> Criar perfil vinculado
                  </button>
                ) : null}
                <button type="button" className="app-profile-menu-action is-danger" onClick={onSignOut}>
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
