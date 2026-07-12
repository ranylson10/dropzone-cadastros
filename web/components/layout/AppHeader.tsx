'use client'

import { ChevronDown, LogOut, Menu, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DropZoneRow } from '@/lib/types'

export type AppHeaderNavItem = { label: string; href: string }

type AppHeaderProps = {
  navItems: AppHeaderNavItem[]
  activeLabel?: string
  profileName: string
  profileSubtitle?: string
  profileImage?: string
  accounts?: DropZoneRow[]
  activeAccountId?: string
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: () => void
  onSignOut: () => void
}

function profileMedia(account: DropZoneRow) {
  return account.data?.logo_url || account.data?.avatar_url || ''
}

export function AppHeader({
  navItems,
  activeLabel,
  profileName,
  profileSubtitle,
  profileImage,
  accounts = [],
  activeAccountId,
  onSwitchAccount,
  onCreateLinkedProfile,
  onSignOut,
}: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

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
        <a className="app-brand" href="#painel-inicio" aria-label="Ir para o início do painel">
          <span className="app-brand-logo"><img src="/dropzone-icon.png" alt="" /></span>
          <span className="app-brand-copy"><strong>DROPZONE</strong><small>COMPETITIVE SYSTEM</small></span>
        </a>

        <button className="app-mobile-toggle" type="button" onClick={() => setMobileOpen((v) => !v)} aria-expanded={mobileOpen} aria-label="Abrir menu">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className={`app-main-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Navegação principal">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className={activeLabel === item.label ? 'active' : ''} onClick={() => setMobileOpen(false)}>{item.label}</a>
          ))}
        </nav>

        <div className="app-profile" ref={profileRef}>
          <button type="button" className="app-profile-trigger" onClick={() => setProfileOpen((v) => !v)} aria-expanded={profileOpen}>
            <span className="app-profile-avatar">{profileImage ? <img src={profileImage} alt="" /> : <b>{profileName.slice(0, 2).toUpperCase()}</b>}</span>
            <span className="app-profile-copy"><strong>{profileName}</strong><small>{profileSubtitle || 'Conta DropZone'}</small></span>
            <ChevronDown size={16} className={profileOpen ? 'rotated' : ''} />
          </button>

          {profileOpen ? (
            <div className="app-profile-menu linked-account-menu">
              <div className="app-profile-menu-head"><strong>Perfis vinculados</strong><span>Vinculados à mesma conta</span></div>
              {accounts.map((item) => {
                const media = profileMedia(item)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`linked-account-option ${item.id === activeAccountId ? 'active' : ''}`}
                    onClick={() => { onSwitchAccount?.(item); setProfileOpen(false) }}
                  >
                    <span className="linked-account-avatar">{media ? <img src={media} alt="" /> : String(item.name || item.username || 'DZ').slice(0, 2).toUpperCase()}</span>
                    <span><b>{item.name}</b><small>{item.profile_type} · @{item.username}</small></span>
                  </button>
                )
              })}
              {onCreateLinkedProfile ? (
                <button type="button" onClick={() => { onCreateLinkedProfile(); setProfileOpen(false) }}><Plus size={16} /> Criar perfil vinculado</button>
              ) : null}
              <button type="button" onClick={onSignOut}><LogOut size={16} /> Sair de todos</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
