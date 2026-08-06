'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Loader2, LogOut, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { supabase } from '@/lib/supabase-browser'
import { OAUTH_PROFILE_KEY, OAUTH_RETURN_KEY, SocialLogin } from '@/features/auth/SocialLogin'
import { parseProfileType, safeInternalPath } from '@/features/auth/auth-return'
import { signOutEverywhere } from '@/lib/auth-client-state'
import type { DropZoneRow, ProfileType } from '@/lib/types'

const profileLabels: Record<ProfileType, string> = {
  produtora: 'Produtora',
  equipe: 'Equipe',
  jogador: 'Jogador',
  manager: 'Manager',
  broadcast: 'Broadcast',
}

const profileDescriptions: Record<ProfileType, string> = {
  produtora: 'Gerencie campeonatos, equipes, jogos e resultados.',
  equipe: 'Organize elenco, lines e inscrições em campeonatos.',
  jogador: 'Acompanhe convites, escalações e competições.',
  manager: 'Acesse os campeonatos e permissões recebidas.',
  broadcast: 'Controle transmissões, overlays e operações de live.',
}

const PROFILE_TYPES: ProfileType[] = ['produtora', 'equipe', 'jogador', 'manager', 'broadcast']

type LoginStage = 'checking' | 'authenticate' | 'profiles'

function profileImage(profile: DropZoneRow) {
  return String(profile.data?.logo_url || profile.data?.avatar_url || '')
}

export default function LoginPage() {
  const [stage, setStage] = useState<LoginStage>('checking')
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [accounts, setAccounts] = useState<DropZoneRow[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [openingProfile, setOpeningProfile] = useState<string | null>(null)
  const [params, setParams] = useState({
    returnTo: '/',
    profileType: null as ReturnType<typeof parseProfileType>,
    switchAccount: false,
  })

  const accountName = useMemo(() => {
    const metadata = session?.user?.user_metadata || {}
    return String(metadata.full_name || metadata.name || session?.user?.email || 'Conta Google')
  }, [session])

  useEffect(() => {
    let active = true
    const safetyTimer = window.setTimeout(() => {
      if (active) setStage('authenticate')
    }, 12000)

    async function loadAccounts(currentSession: Session) {
      const response = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 404) throw new Error(payload.error || 'Não foi possível carregar seus perfis.')
      const rows = Array.isArray(payload.accounts) ? payload.accounts : payload.account ? [payload.account] : []
      return rows as DropZoneRow[]
    }

    async function checkAdmin(currentSession: Session) {
      try {
        const response = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => ({}))
        return Boolean(payload.isAdmin)
      } catch {
        return false
      }
    }

    async function initialize() {
      const search = new URLSearchParams(window.location.search)
      let storedReturn = ''
      let storedProfile: string | null = null
      try {
        storedReturn = sessionStorage.getItem(OAUTH_RETURN_KEY) || ''
        storedProfile = sessionStorage.getItem(OAUTH_PROFILE_KEY)
      } catch {
        // O navegador pode bloquear o storage em modo privado.
      }

      const returnTo = safeInternalPath(search.get('returnTo') || storedReturn || '/')
      const profileType = parseProfileType(search.get('profileType')) || parseProfileType(storedProfile)
      const switchAccount = search.get('switch') === '1'
      const complete = search.get('complete') === '1'
      if (active) setParams({ returnTo, profileType, switchAccount })

      if (complete) {
        try {
          sessionStorage.removeItem(OAUTH_RETURN_KEY)
          sessionStorage.removeItem(OAUTH_PROFILE_KEY)
        } catch {
          // ignore
        }
      }

      try {
        if (switchAccount && !complete) {
          await signOutEverywhere().catch(() => undefined)
          if (active) {
            setSession(null)
            setAccounts([])
            setStage('authenticate')
          }
          return
        }

        const { data, error: sessionError } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Tempo esgotado ao verificar sessão.')), 8000)),
        ])
        if (sessionError) throw sessionError
        let currentSession = data.session

        if (complete && !currentSession) {
          currentSession = await new Promise<Session | null>((resolve) => {
            let settled = false
            let timer = 0
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
              if (!nextSession || settled) return
              settled = true
              window.clearTimeout(timer)
              subscription.unsubscribe()
              resolve(nextSession)
            })
            timer = window.setTimeout(async () => {
              if (settled) return
              settled = true
              subscription.unsubscribe()
              const current = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
              resolve(current.data.session)
            }, 4000)
          })
        }

        if (!currentSession) {
          if (active) setStage('authenticate')
          return
        }

        const [userAccounts, adminAccess] = await Promise.all([
          loadAccounts(currentSession).catch(() => [] as DropZoneRow[]),
          checkAdmin(currentSession),
        ])

        if (!active) return
        setSession(currentSession)
        setAccounts(userAccounts)
        setIsAdmin(adminAccess)
        setStage('profiles')
      } catch (cause: unknown) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a autenticação.')
        setStage('authenticate')
      } finally {
        window.clearTimeout(safetyTimer)
      }
    }

    void initialize()
    return () => {
      active = false
      window.clearTimeout(safetyTimer)
    }
  }, [])

  function openProfile(profile: DropZoneRow) {
    if (!profile.profile_type) return
    setOpeningProfile(profile.id)
    try {
      localStorage.setItem('dropzone_active_profile_type', profile.profile_type)
      localStorage.setItem('dropzone_recent_profiles', JSON.stringify(accounts))
    } catch {
      // O login continua mesmo sem cache local.
    }
    window.location.assign(params.returnTo || '/')
  }

  function createProfile(type: ProfileType) {
    const next = new URLSearchParams({
      cadastro: type,
      vincular: '1',
      returnTo: params.returnTo || '/',
    })
    window.location.assign(`/?${next.toString()}`)
  }

  async function changeGoogleAccount() {
    await signOutEverywhere().catch(() => undefined)
    setSession(null)
    setAccounts([])
    setIsAdmin(false)
    setStage('authenticate')
  }

  return (
    <AppShell header="never" withAuthOffset={false} mainClassName="login-portal" activeLabel="Início">
      <section className="login-portal-stage">
        <div className="login-portal-media" aria-hidden="true" />
        <div className="login-portal-overlay" aria-hidden="true" />

        <div className="login-portal-content">
          <div className="login-portal-brand">
            <SystemLogo size={52} alt="DropZone" variant="accent" />
            <div><strong>DROPZONE</strong><span>COMPETITIVE SYSTEM</span></div>
          </div>

          <div className="login-portal-copy">
            <span className="login-portal-kicker">Acesso competitivo centralizado</span>
            <h1>ENTRE. ESCOLHA SEU PERFIL. COMPITA.</h1>
            <p>Uma única conta Google conecta todos os seus perfis no DropZone. Depois da autenticação, você escolhe exatamente onde deseja entrar.</p>
          </div>

          <div className="login-portal-panel">
            {stage === 'checking' ? (
              <div className="login-portal-loading" role="status" aria-live="polite">
                <Loader2 className="spin" size={30} />
                <strong>Validando seu acesso</strong>
                <span>Aguarde um instante...</span>
              </div>
            ) : null}

            {stage === 'authenticate' ? (
              <div className="login-auth-step">
                <span className="login-panel-step">PASSO 01</span>
                <h2>ENTRE COM SUA CONTA</h2>
                <p>Use o Google para confirmar sua identidade. Nenhum tipo de perfil precisa ser escolhido agora.</p>
                <SocialLogin profileType={null} returnTo={params.returnTo} />
                <div className="login-security-note"><ShieldCheck size={16} /><span>Autenticação segura. Seus perfis aparecem somente depois do login.</span></div>
                {error ? <div className="message error">{error}</div> : null}
              </div>
            ) : null}

            {stage === 'profiles' ? (
              <div className="login-profile-step">
                <div className="login-profile-head">
                  <div>
                    <span className="login-panel-step">PASSO 02</span>
                    <h2>ESCOLHA SEU PERFIL</h2>
                    <p>Conta autenticada como <strong>{accountName}</strong></p>
                  </div>
                  <button type="button" className="login-change-account" onClick={() => void changeGoogleAccount()}>
                    <LogOut size={15} /> Trocar conta
                  </button>
                </div>

                {accounts.length || isAdmin ? (
                  <div className="login-profile-grid">
                    {accounts.map((profile) => {
                      const image = profileImage(profile)
                      const type = profile.profile_type as ProfileType
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          className="login-profile-card"
                          disabled={Boolean(openingProfile)}
                          onClick={() => openProfile(profile)}
                        >
                          <span className="login-profile-avatar">
                            {image ? <img src={image} alt="" /> : <UserRound size={22} />}
                          </span>
                          <span className="login-profile-card-copy">
                            <small>{profileLabels[type] || 'Perfil'}</small>
                            <strong>{profile.name || profile.username}</strong>
                            <span>@{profile.username}</span>
                          </span>
                          {openingProfile === profile.id ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
                        </button>
                      )
                    })}
                    {isAdmin ? (
                      <button type="button" className="login-profile-card admin" onClick={() => window.location.assign('/admin')}>
                        <span className="login-profile-avatar"><ShieldCheck size={22} /></span>
                        <span className="login-profile-card-copy"><small>Sistema</small><strong>Administrador</strong><span>Controle geral da plataforma</span></span>
                        <ArrowRight size={18} />
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="login-no-profile">
                    <UserRound size={28} />
                    <strong>Você ainda não possui um perfil</strong>
                    <p>Crie seu primeiro perfil para começar a usar o DropZone.</p>
                  </div>
                )}

                <div className="login-create-area">
                  <div className="login-create-title"><Plus size={16} /><span>{accounts.length ? 'Criar outro perfil' : 'Crie seu perfil'}</span></div>
                  <div className="login-create-grid">
                    {PROFILE_TYPES.filter((type) => !accounts.some((profile) => profile.profile_type === type)).map((type) => (
                      <button key={type} type="button" onClick={() => createProfile(type)}>
                        <strong>{profileLabels[type]}</strong>
                        <span>{profileDescriptions[type]}</span>
                        <ArrowRight size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  )
}
