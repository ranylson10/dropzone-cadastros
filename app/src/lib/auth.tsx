import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
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
  loading: boolean
  session: Session | null
  user: User | null
  accounts: MobileAccount[]
  activeAccount: MobileAccount | null
  activeProfileType: ProfileType
  setActiveAccountId: (id: string) => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshAccounts: () => Promise<void>
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setAccounts([])
        setActiveAccountId('')
      }
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [configured])

  useEffect(() => {
    if (session?.access_token) void refreshAccounts().catch(() => setAccounts([]))
  }, [refreshAccounts, session?.access_token])

  const activeAccount = accounts.find((account) => account.id === activeAccountId) || accounts[0] || null
  const activeProfileType = activeAccount?.profile_type || 'jogador'

  const value = useMemo<AuthState>(() => ({
    configured,
    loading,
    session,
    user: session?.user || null,
    accounts,
    activeAccount,
    activeProfileType,
    setActiveAccountId,
    refreshAccounts,
    async signInWithGoogle() {
      if (!configured) throw new Error('Supabase não configurado no app.')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'dropzone://auth/callback',
        },
      })
      if (error) throw error
    },
    async signOut() {
      if (!configured) return
      await supabase.auth.signOut()
      setAccounts([])
      setActiveAccountId('')
    },
  }), [accounts, activeAccount, activeProfileType, configured, loading, refreshAccounts, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider.')
  return value
}
