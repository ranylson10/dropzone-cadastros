'use client'

/**
 * Shell de layout global — header + área de conteúdo.
 * Toda página autenticada ou pública deve usar isto (ou PublicAppShell)
 * para o layout ficar centralizado em um só lugar.
 */
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import { AppHeader } from './AppHeader'
import { APP_NAV, resolveActiveNavLabel, type AppNavItem } from './nav'

const TYPE_LABELS: Record<string, string> = {
  produtora: 'Produtora',
  equipe: 'Equipe',
  jogador: 'Jogador',
  manager: 'Manager',
}

function mediaFor(account?: DropZoneRow | null) {
  return String(account?.data?.logo_url || account?.data?.avatar_url || '')
}

export type AppShellProps = {
  children: React.ReactNode
  /** Força o item ativo; se omitido, deriva do pathname */
  activeLabel?: string
  navItems?: AppNavItem[]
  /** className no <main> */
  mainClassName?: string
  /** id do main (âncoras) */
  mainId?: string
  /**
   * always = sempre mostra header
   * auto = mostra se houver conta ou se forceHeader
   * never = sem header (login custom etc.)
   */
  header?: 'always' | 'auto' | 'never'
  forceHeader?: boolean
  /** Conta já resolvida (painel) — evita segundo /api/me */
  account?: DropZoneRow | null
  accounts?: DropZoneRow[]
  activeAccountId?: string
  switchingAccountId?: string
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: () => void
  onSignOut?: () => void
  /** Se true, carrega sessão via /api/me (páginas públicas) */
  loadSession?: boolean
  loginHref?: string
  /** padding-top do main quando header fixo */
  withAuthOffset?: boolean
}

export function AppShell({
  children,
  activeLabel,
  navItems = APP_NAV,
  mainClassName = '',
  mainId,
  header = 'always',
  forceHeader = false,
  account: accountProp,
  accounts: accountsProp,
  activeAccountId,
  switchingAccountId,
  onSwitchAccount,
  onCreateLinkedProfile,
  onSignOut: onSignOutProp,
  loadSession = false,
  loginHref,
  withAuthOffset = true,
}: AppShellProps) {
  const pathname = usePathname()
  const [sessionAccount, setSessionAccount] = useState<DropZoneRow | null>(null)
  const [sessionAccounts, setSessionAccounts] = useState<DropZoneRow[]>([])

  const controlled = accountProp !== undefined
  const account = controlled ? accountProp : sessionAccount
  const accounts = controlled ? (accountsProp || []) : sessionAccounts

  // Se o editor Stream/modais deixaram overflow travado, libera no shell do sistema
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const onStreamEditor = Boolean(document.querySelector('.stream-editor.stream-gt'))
    if (!onStreamEditor) {
      html.classList.remove('stream-editor-scroll-lock')
      body.classList.remove('stream-editor-scroll-lock')
      if (html.style.overflow === 'hidden') html.style.overflow = ''
      if (body.style.overflow === 'hidden') body.style.overflow = ''
    }
  }, [pathname])

  useEffect(() => {
    if (!loadSession || controlled) return
    let activeRequest = true

    try {
      const cached = JSON.parse(localStorage.getItem('dropzone_recent_profiles') || '[]') as DropZoneRow[]
      const preferred = localStorage.getItem('dropzone_active_profile_type') || ''
      const recent = cached.find((item) => item.profile_type === preferred) || cached[0]
      if (recent) {
        setSessionAccount(recent)
        setSessionAccounts(cached)
      }
    } catch {
      // ignore
    }

    async function loadAccount(accessToken?: string | null) {
      let token = accessToken
      if (!token) {
        const { data } = await supabase.auth.getSession()
        token = data.session?.access_token
      }
      if (!token) {
        if (activeRequest) {
          setSessionAccount(null)
          setSessionAccounts([])
        }
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
      setSessionAccount(payload.account || null)
      setSessionAccounts(payload.accounts || [])
      if (payload.account) {
        localStorage.setItem('dropzone_active_profile_type', String(payload.account.profile_type || ''))
        localStorage.setItem('dropzone_recent_profiles', JSON.stringify(payload.accounts || [payload.account]))
      }
    }

    void loadAccount()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (activeRequest) void loadAccount(session?.access_token)
      }, 0)
    })
    return () => {
      activeRequest = false
      listener.subscription.unsubscribe()
    }
  }, [loadSession, controlled])

  async function defaultSignOut() {
    await supabase.auth.signOut()
    setSessionAccount(null)
    setSessionAccounts([])
    window.location.href = '/'
  }

  function defaultSwitch(next: DropZoneRow) {
    localStorage.setItem('dropzone_active_profile_type', String(next.profile_type || ''))
    setSessionAccount(next)
    // Volta ao painel para carregar o contexto do perfil
    if (pathname !== '/') window.location.href = '/'
  }

  const resolvedActive = activeLabel || resolveActiveNavLabel(pathname)
  const showHeader =
    header === 'always'
    || (header === 'auto' && (forceHeader || Boolean(account)))
    || false

  const mainClasses = useMemo(() => {
    const parts = [mainClassName]
    if (showHeader && withAuthOffset) parts.push('page-authenticated')
    return parts.filter(Boolean).join(' ')
  }, [mainClassName, showHeader, withAuthOffset])

  return (
    <>
      {showHeader ? (
        <AppHeader
          navItems={navItems}
          activeLabel={resolvedActive}
          profileName={account ? (account.name || account.username || 'Conta DropZone') : undefined}
          profileSubtitle={
            account
              ? `${TYPE_LABELS[String(account.profile_type || '')] || 'Conta'} · @${account.username}`
              : undefined
          }
          profileImage={mediaFor(account) || undefined}
          accounts={accounts}
          activeAccountId={activeAccountId || account?.id}
          switchingAccountId={switchingAccountId}
          onSwitchAccount={onSwitchAccount || (loadSession ? defaultSwitch : undefined)}
          onCreateLinkedProfile={onCreateLinkedProfile}
          onSignOut={account ? (onSignOutProp || defaultSignOut) : undefined}
          loginHref={loginHref}
        />
      ) : null}
      <main className={mainClasses} id={mainId}>
        {children}
      </main>
    </>
  )
}
