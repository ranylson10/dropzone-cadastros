'use client'

/**
 * Shell de layout global — header + área de conteúdo.
 * Toda página autenticada ou pública deve usar isto (ou PublicAppShell)
 * para o layout ficar centralizado em um só lugar.
 */
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { isWebProfileType, type DropZoneRow, type WebProfileType } from '@/lib/types'
import { AppHeader } from './AppHeader'
import { APP_NAV, resolveActiveNavLabel, type AppNavItem } from './nav'
import { signOutEverywhere } from '@/lib/auth-client-state'

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
  /** Identidade da sessão quando ainda não existe cadastro operacional. */
  identity?: { name?: string | null; username?: string | null; email?: string | null; avatar_url?: string | null; complete?: boolean } | null
  accounts?: DropZoneRow[]
  activeAccountId?: string
  switchingAccountId?: string
  onSwitchAccount?: (account: DropZoneRow) => void
  onCreateLinkedProfile?: (profileType?: WebProfileType) => void
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
  identity: identityProp,
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
  const [sessionIdentity, setSessionIdentity] = useState<{ name?: string | null; username?: string | null; email?: string | null; avatar_url?: string | null; complete?: boolean } | null>(null)

  const controlled = accountProp !== undefined
  const controlledAccounts = (accountsProp || []).filter((item) => isWebProfileType(item.profile_type))
  const controlledAccount = accountProp === null ? null : accountProp && isWebProfileType(accountProp.profile_type) ? accountProp : controlledAccounts[0] || null
  const account = controlled ? controlledAccount : sessionAccount
  const accounts = controlled ? controlledAccounts : sessionAccounts
  const identity = identityProp || sessionIdentity

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
      const cached = (JSON.parse(localStorage.getItem('dropzone_recent_profiles') || '[]') as DropZoneRow[])
        .filter((item) => isWebProfileType(item.profile_type))
      const preferred = localStorage.getItem('dropzone_active_profile_type') || ''
      const preferredId = localStorage.getItem('dropzone_active_profile_id') || ''
      const recent = cached.find((item) => item.id === preferredId) || cached.find((item) => item.profile_type === preferred) || cached[0]
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
          setSessionIdentity(null)
        }
        return
      }

      const preferred = localStorage.getItem('dropzone_active_profile_type') || ''
      const preferredId = localStorage.getItem('dropzone_active_profile_id') || ''
      const response = await fetch('/api/me', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(preferred ? { 'X-Profile-Type': preferred } : {}),
          ...(preferredId ? { 'X-Profile-Id': preferredId } : {}),
        },
      })
      if (!response.ok) return
      const payload = await response.json()
      if (!activeRequest) return
      setSessionIdentity({
        email: String(payload.user?.email || ''),
        name: String(payload.user?.name || payload.user?.email || 'Conta DropZone'),
        username: String(payload.user?.username || ''),
        avatar_url: String(payload.user?.avatar_url || ''),
        complete: payload.user?.complete !== false,
      })
      const webAccounts = (Array.isArray(payload.accounts) ? payload.accounts : payload.account ? [payload.account] : [])
        .filter((item: DropZoneRow) => isWebProfileType(item.profile_type))
      const preferredWeb = isWebProfileType(preferred) ? preferred : null
      const webAccount = webAccounts.find((item: DropZoneRow) => item.id === preferredId)
        || webAccounts.find((item: DropZoneRow) => item.profile_type === preferredWeb)
        || webAccounts[0]
        || null
      setSessionAccount(webAccount)
      setSessionAccounts(webAccounts)
      if (webAccount) {
        localStorage.setItem('dropzone_active_profile_type', String(webAccount.profile_type || ''))
        localStorage.setItem('dropzone_active_profile_id', webAccount.id)
        localStorage.setItem('dropzone_recent_profiles', JSON.stringify(webAccounts))
      } else {
        localStorage.removeItem('dropzone_active_profile_type')
        localStorage.removeItem('dropzone_active_profile_id')
        localStorage.setItem('dropzone_recent_profiles', '[]')
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
    try {
      await signOutEverywhere()
    } finally {
      setSessionAccount(null)
      setSessionAccounts([])
      setSessionIdentity(null)
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/'
      window.location.href = `/login?switch=1&returnTo=${encodeURIComponent(returnTo)}`
    }
  }

  function defaultSwitch(next: DropZoneRow) {
    localStorage.setItem('dropzone_active_profile_type', String(next.profile_type || ''))
    localStorage.setItem('dropzone_active_profile_id', next.id)
    setSessionAccount(next)
    // Volta ao painel para carregar o contexto do perfil
    if (pathname !== '/') window.location.href = '/'
  }

  const resolvedActive = activeLabel || resolveActiveNavLabel(pathname)
  const showHeader =
    header === 'always'
    || (header === 'auto' && (forceHeader || Boolean(account) || Boolean(identity)))
    || false

  const mainClasses = useMemo(() => {
    const parts = ['app-shell-main', mainClassName]
    if (showHeader && withAuthOffset) parts.push('page-authenticated')
    return parts.filter(Boolean).join(' ')
  }, [mainClassName, showHeader, withAuthOffset])

  const resolvedMainId = mainId || 'main-content'

  return (
    <>
      <a className="app-skip-link" href={`#${resolvedMainId}`}>Pular para o conteúdo</a>
      {showHeader ? (
        <AppHeader
          navItems={navItems}
          activeLabel={resolvedActive}
          profileName={identity?.name || account?.name || account?.username || 'Conta DropZone'}
          profileSubtitle={
            identity?.username
              ? `@${identity.username}`
              : account?.username
                ? `@${account.username}`
                : 'Conta DropZone'
          }
          profileImage={identity?.avatar_url || mediaFor(account) || undefined}
          accounts={accounts}
          activeAccountId={activeAccountId || account?.id}
          switchingAccountId={switchingAccountId}
          onSwitchAccount={onSwitchAccount || (loadSession ? defaultSwitch : undefined)}
          onCreateLinkedProfile={onCreateLinkedProfile}
          onSignOut={account || identity ? (onSignOutProp || defaultSignOut) : undefined}
          loginHref={loginHref}
          showWallet={
            Boolean(account)
            && (account?.profile_type === 'produtora' || account?.profile_type === 'manager')
          }
        />
      ) : null}
      <main className={mainClasses} id={resolvedMainId} tabIndex={-1}>
        {children}
      </main>
    </>
  )
}
