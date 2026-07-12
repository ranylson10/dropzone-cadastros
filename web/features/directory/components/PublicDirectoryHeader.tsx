'use client'

import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import { DIRECTORY_NAV } from '../config'

function media(account?: DropZoneRow | null) {
  return account?.data?.logo_url || account?.data?.avatar_url || ''
}

function typeLabel(value?: string | null) {
  return ({ produtora: 'Produtora', equipe: 'Equipe', jogador: 'Jogador', manager: 'Manager' } as Record<string, string>)[String(value || '')] || 'Conta DropZone'
}

export function PublicDirectoryHeader({ active }: { active?: string }) {
  const [account, setAccount] = useState<DropZoneRow | null>(null)
  const [accounts, setAccounts] = useState<DropZoneRow[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activeRequest = true

    async function loadAccount() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        if (activeRequest) { setAccount(null); setAccounts([]) }
        return
      }

      const preferred = localStorage.getItem('dropzone_active_profile_type') || ''
      const response = await fetch('/api/me', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(preferred ? { 'X-Profile-Type': preferred } : {}),
        },
      })
      if (!response.ok) return
      const payload = await response.json()
      if (!activeRequest) return
      setAccount(payload.account || null)
      setAccounts(payload.accounts || [])
    }

    loadAccount()
    const { data: listener } = supabase.auth.onAuthStateChange(() => loadAccount())
    return () => {
      activeRequest = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  function switchAccount(next: DropZoneRow) {
    localStorage.setItem('dropzone_active_profile_type', String(next.profile_type || ''))
    setAccount(next)
    setProfileOpen(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAccount(null)
    setAccounts([])
    window.location.href = '/'
  }

  return (
    <header className="public-directory-header">
      <div className="public-directory-header-inner">
        <a className="app-brand" href="/" aria-label="DropZone">
          <span className="app-brand-logo"><img src="/dropzone-icon.png" alt="" /></span>
          <span className="app-brand-copy"><strong>DROPZONE</strong><small>COMPETITIVE SYSTEM</small></span>
        </a>

        <button className="directory-mobile-toggle" type="button" onClick={() => setMobileOpen((value) => !value)} aria-label="Abrir menu">
          {mobileOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <nav className={`public-directory-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Navegação pública">
          {DIRECTORY_NAV.map((item) => <a key={item.label} className={active === item.label ? 'active' : ''} href={item.href}>{item.label}</a>)}
        </nav>

        {account ? (
          <div className="directory-account" ref={profileRef}>
            <button className="directory-account-trigger" type="button" onClick={() => setProfileOpen((value) => !value)}>
              <span>{media(account) ? <img src={media(account)} alt="" /> : <b>{String(account.name || account.username || 'DZ').slice(0, 2).toUpperCase()}</b>}</span>
              <div><strong>{account.name || account.username}</strong><small>{typeLabel(account.profile_type)} · @{account.username}</small></div>
              <ChevronDown size={15} />
            </button>
            {profileOpen ? (
              <div className="directory-account-menu">
                <a href="/">Abrir meu painel</a>
                {accounts.length > 1 ? <small>Perfis vinculados</small> : null}
                {accounts.map((item) => (
                  <button key={item.id} type="button" className={item.id === account.id ? 'active' : ''} onClick={() => switchAccount(item)}>
                    {item.name || item.username}<span>{typeLabel(item.profile_type)}</span>
                  </button>
                ))}
                <button type="button" onClick={signOut}><LogOut size={14} /> Sair</button>
              </div>
            ) : null}
          </div>
        ) : <a className="public-directory-access" href="/login?returnTo=%2F">Entrar no sistema</a>}
      </div>
    </header>
  )
}
