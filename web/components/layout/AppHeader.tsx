'use client'

import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type AppHeaderNavItem = {
  label: string
  href: string
}

type AppHeaderProps = {
  navItems: AppHeaderNavItem[]
  activeLabel?: string
  profileName: string
  profileSubtitle?: string
  profileImage?: string
  onSignOut: () => void
}

export function AppHeader({
  navItems,
  activeLabel,
  profileName,
  profileSubtitle,
  profileImage,
  onSignOut,
}: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a className="app-brand" href="#painel-inicio" aria-label="Ir para o início do painel">
          <span className="app-brand-logo">
            <img src="/dropzone-icon.png" alt="" />
          </span>
          <span className="app-brand-copy">
            <strong>DROPZONE</strong>
            <small>COMPETITIVE SYSTEM</small>
          </span>
        </a>

        <button
          className="app-mobile-toggle"
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
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

        <div className="app-profile" ref={profileRef}>
          <button
            type="button"
            className="app-profile-trigger"
            onClick={() => setProfileOpen((current) => !current)}
            aria-expanded={profileOpen}
          >
            <span className="app-profile-avatar">
              {profileImage ? <img src={profileImage} alt="" /> : <b>{profileName.slice(0, 2).toUpperCase()}</b>}
            </span>
            <span className="app-profile-copy">
              <strong>{profileName}</strong>
              <small>{profileSubtitle || 'Conta DropZone'}</small>
            </span>
            <ChevronDown size={16} className={profileOpen ? 'rotated' : ''} />
          </button>

          {profileOpen ? (
            <div className="app-profile-menu">
              <div className="app-profile-menu-head">
                <strong>{profileName}</strong>
                <span>{profileSubtitle}</span>
              </div>
              <a href="#perfil" onClick={() => setProfileOpen(false)}>Minha conta</a>
              <button type="button" onClick={onSignOut}>
                <LogOut size={16} /> Sair
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
