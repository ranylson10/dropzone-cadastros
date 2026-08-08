import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Linking } from 'react-native'
import { Session, User } from '@supabase/supabase-js'
import { env, isValidMobileAuthRedirect, MOBILE_DEEP_LINK_AUTH_CALLBACK } from '@/config/env'
import { dropzoneFetch } from '@/lib/api'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { ProfileType } from '@/types/dropzone'

export type MobileAccount = {
  id: string
  name: string
  username?: string | null
  profile_type: ProfileType
  data?: Record<string, unknown> | null
}

type AuthState = {
  configured: boolean
  redirectConfigured: boolean
  loading: boolean
  authenticating: boolean
  authError: string
  session: Session | null
  user: User | null
  accounts: MobileAccount[]
  activeAccount: MobileAccount | null
  activeProfileType: ProfileType
  setActiveAccountId: (id: string) => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshAccounts: () => Promise<void>
  clearAuthError: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function normalizeProfileType(value: unknown): ProfileType {
  const text = String(value || '').toLowerCase()
  if (text === 'jogador' || text === 'equipe' || text === 'produtora' || text === 'manager' || text === 'broadcast') return text
  return 'jogador'
}

function mapAccount(row: any): MobileAccount {
  return {
    id: String(row.id || row.profile_id || ''),
    name: String(row.name || row.nome || row.username || 'Perfil'),
    username: row.username || null,
    profile_type: normalizeProfileType(row.profile_type || row.tipo || row.type),
    data: row.data || null,
  }
}

function oauthParamsFromUrl(url: string) {
  const questionIndex = url.indexOf('?')
  const hashIndex = url.indexOf('#')
  const queryText = questionIndex >= 0
    ? url.slice(questionIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
    : ''
  const hashText = hashIndex >= 0 ? url.slice(hashIndex + 1) : ''
  const query = new URLSearchParams(queryText)
  const hash = new URLSearchParams(hashText)
  return {
    code: query.get('code') || hash.get('code'),
    error: query.get('error_description') || hash.get('error_description') || query.get('error') || hash.get('error'),
  }
}

function isAuthCallbackUrl(url: string) {
  const base = env.authRedirectUrl.replace(/\/+$/, '')
  const deepLinkBase = MOBILE_DEEP_LINK_AUTH_CALLBACK
  return (
    url === base ||
    url.startsWith(`${base}?`) ||
    url.startsWith(`${base}#`) ||
    url === deepLinkBase ||
    url.startsWith(`${deepLinkBase}?`) ||
    url.startsWith(`${deepLinkBase}#`)
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const redirectConfigured = isValidMobileAuthRedirect()
  const mountedRef = useRef(true)
  const oauthHandlingRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [authenticating, setAuthenticating] = useState(false)
  const [authError, setAuthError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [accounts, setAccounts] = useState<MobileAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState('')

  const refreshAccounts = useCallback(async () => {
    const accessToken = session?.access_token
    if (!accessToken) {
      setAccounts([])
      return
    }
    const result = await dropzoneFetch<{ accounts?: any[]; account?: any }>('/api/me', {
      accessToken,
      cache: 'no-store',
    })
    const rows = result.accounts || (result.account ? [result.account] : [])
    const mapped = rows.map(mapAccount).filter((account) => account.id)
    setAccounts(mapped)
    setActiveAccountId((current) => current || mapped[0]?.id || '')
  }, [session?.access_token])

  const handleOAuthUrl = useCallback(async (url: string | null) => {
    if (!url || !isAuthCallbackUrl(url) || oauthHandlingRef.current) return
    oauthHandlingRef.current = true
    setAuthenticating(true)
    setAuthError('')
    try {
      const params = oauthParamsFromUrl(url)
      if (params.error) throw new Error(params.error)
      if (!params.code) throw new Error('O retorno do Google não trouxe um código de autenticação válido.')

      const { data, error } = await supabase.auth.exchangeCodeForSession(params.code)
      if (error) throw error
      if (!data.session) throw new Error('A sessão não foi criada após o retorno do Google.')
      if (mountedRef.current) setSession(data.session)
    } catch (error: any) {
      if (mountedRef.current) {
        setAuthError(error?.message || 'Não foi possível concluir o login com Google.')
      }
    } finally {
      oauthHandlingRef.current = false
      if (mountedRef.current) setAuthenticating(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!configured) {
      setLoading(false)
      return () => {
        mountedRef.current = false
      }
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mountedRef.current) return
      if (error) setAuthError(error.message)
      setSession(data.session)
      setLoading(false)
    })

    Linking.getInitialURL().then((url) => void handleOAuthUrl(url)).catch(() => null)
    const linkListener = Linking.addEventListener('url', (event) => {
      void handleOAuthUrl(event.url)
    })
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    })
    supabase.auth.startAutoRefresh()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mountedRef.current) return
      setSession(nextSession)
      setAuthenticating(false)
      if (!nextSession) {
        setAccounts([])
        setActiveAccountId('')
      }
    })

    return () => {
      mountedRef.current = false
      supabase.auth.stopAutoRefresh()
      linkListener.remove()
      appStateListener.remove()
      listener.subscription.unsubscribe()
    }
  }, [configured, handleOAuthUrl])

  useEffect(() => {
    if (session?.access_token) void refreshAccounts().catch(() => setAccounts([]))
  }, [refreshAccounts, session?.access_token])

  const activeAccount = accounts.find((account) => account.id === activeAccountId) || accounts[0] || null
  const activeProfileType = activeAccount?.profile_type || 'jogador'

  const value = useMemo<AuthState>(() => ({
    configured,
    redirectConfigured,
    loading,
    authenticating,
    authError,
    session,
    user: session?.user || null,
    accounts,
    activeAccount,
    activeProfileType,
    setActiveAccountId,
    refreshAccounts,
    clearAuthError: () => setAuthError(''),
    async signInWithGoogle() {
      if (!configured) throw new Error('Supabase não configurado no app.')
      if (!redirectConfigured) throw new Error('O redirect mobile precisa ser dropzone://auth/callback.')
      setAuthenticating(true)
      setAuthError('')
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: env.authRedirectUrl,
            skipBrowserRedirect: true,
          },
        })
        if (error) throw error
        if (!data.url) throw new Error('O Supabase não retornou a URL de autenticação do Google.')
        const supported = await Linking.canOpenURL(data.url)
        if (!supported) throw new Error('Não foi possível abrir o navegador para autenticação.')
        await Linking.openURL(data.url)
      } catch (error) {
        setAuthenticating(false)
        throw error
      }
    },
    async signOut() {
      if (!configured) return
      setAuthError('')
      await supabase.auth.signOut()
      setAccounts([])
      setActiveAccountId('')
    },
  }), [accounts, activeAccount, activeProfileType, authError, authenticating, configured, loading, redirectConfigured, refreshAccounts, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider.')
  return value
}
