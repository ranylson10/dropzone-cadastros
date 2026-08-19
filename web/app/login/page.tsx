'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Eye, EyeOff, Loader2, LogOut, Mail, Plus, ShieldCheck, UserRound } from 'lucide-react'
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
type EmailMode = 'entrar' | 'criar' | 'confirmar-cadastro' | 'recuperar' | 'confirmar-recuperacao' | 'nova-senha'

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchBearerJson(path: string, currentSession: Session, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(path, {
      headers: { Authorization: `Bearer ${currentSession.access_token}` },
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    return { response, payload }
  } finally {
    window.clearTimeout(timeout)
  }
}

function profileImage(profile: DropZoneRow) {
  return String(profile.data?.logo_url || profile.data?.avatar_url || '')
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function passwordIssue(password: string) {
  if (password.length < 8) return 'Use pelo menos 8 caracteres.'
  if (!/[a-z]/.test(password)) return 'Inclua pelo menos uma letra minúscula.'
  if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.'
  if (!/\d/.test(password)) return 'Inclua pelo menos um número.'
  return ''
}

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar.'
  if (/user already registered|already registered/i.test(message)) return 'Este e-mail já possui uma conta. Entre ou recupere sua senha.'
  if (/password should be at least/i.test(message)) return 'A senha não atende aos requisitos de segurança.'
  if (/otp.*expired|token.*expired|expired.*token/i.test(message)) return 'Este código expirou. Solicite um novo código.'
  if (/token.*invalid|invalid.*token|otp.*invalid/i.test(message)) return 'Código inválido. Confira os 6 dígitos e tente novamente.'
  if (/rate limit|too many requests|email rate limit/i.test(message)) return 'Muitas tentativas. Aguarde um pouco antes de solicitar outro código.'
  return message || 'Não foi possível concluir a autenticação.'
}

async function loadAccounts(currentSession: Session) {
  let lastError = 'Não foi possível carregar seus perfis.'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { response, payload } = await fetchBearerJson('/api/me', currentSession, 4_500)
      if (response.ok || response.status === 404) {
        const rows = Array.isArray(payload.accounts) ? payload.accounts : payload.account ? [payload.account] : []
        return rows as DropZoneRow[]
      }
      if (response.status === 401 && /conta nao encontrada|conta não encontrada/i.test(String(payload.error || ''))) {
        return [] as DropZoneRow[]
      }
      lastError = payload.error || lastError
      if (![401, 429, 500, 502, 503, 504].includes(response.status)) break
    } catch (cause: unknown) {
      lastError = cause instanceof DOMException && cause.name === 'AbortError'
        ? 'O carregamento dos perfis demorou demais.'
        : cause instanceof Error
          ? cause.message
          : lastError
    }
    if (attempt === 0) await wait(350)
  }
  throw new Error(lastError)
}

async function checkAdmin(currentSession: Session) {
  try {
    const { payload } = await fetchBearerJson('/api/admin/session', currentSession, 5000)
    return Boolean(payload.isAdmin)
  } catch {
    return false
  }
}

export default function LoginPage() {
  const [stage, setStage] = useState<LoginStage>('checking')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [existingEmailDetected, setExistingEmailDetected] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [accounts, setAccounts] = useState<DropZoneRow[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [openingProfile, setOpeningProfile] = useState<string | null>(null)
  const [emailMode, setEmailMode] = useState<EmailMode>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [profileLoadError, setProfileLoadError] = useState('')
  const [params, setParams] = useState({
    returnTo: '/',
    profileType: null as ReturnType<typeof parseProfileType>,
    switchAccount: false,
  })

  const accountName = useMemo(() => {
    const metadata = session?.user?.user_metadata || {}
    return String(metadata.full_name || metadata.name || session?.user?.email || 'Conta DropZone')
  }, [session])

  async function openAuthenticatedSession(currentSession: Session) {
    // A autenticação já está concluída neste ponto. Falha/timeout de /api/me não
    // pode jogar o usuário de volta para o formulário como se estivesse deslogado.
    setSession(currentSession)
    setStage('profiles')
    setProfilesLoading(true)
    setProfileLoadError('')

    // Admin também não participa do caminho crítico de carregamento dos perfis.
    void checkAdmin(currentSession).then((adminAccess) => setIsAdmin(adminAccess))

    try {
      const userAccounts = await loadAccounts(currentSession)
      setAccounts(userAccounts)
    } catch (cause: unknown) {
      setAccounts([])
      setProfileLoadError(
        friendlyAuthError(cause instanceof Error ? cause.message : 'Não foi possível carregar seus perfis.'),
      )
    } finally {
      setProfilesLoading(false)
    }
  }

  async function retryProfiles() {
    if (!session || profilesLoading) return
    setProfilesLoading(true)
    setProfileLoadError('')
    try {
      const userAccounts = await loadAccounts(session)
      setAccounts(userAccounts)
    } catch (cause: unknown) {
      setProfileLoadError(
        friendlyAuthError(cause instanceof Error ? cause.message : 'Não foi possível carregar seus perfis.'),
      )
    } finally {
      setProfilesLoading(false)
    }
  }

  function clearOAuthReturnState() {
    try {
      sessionStorage.removeItem(OAUTH_RETURN_KEY)
      sessionStorage.removeItem(OAUTH_PROFILE_KEY)
    } catch {
      // O navegador pode bloquear o storage em modo privado.
    }
  }

  useEffect(() => {
    let active = true

    async function getSessionOnce(timeoutMs: number) {
      let timeout: number | undefined
      try {
        const { data, error: sessionError } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => {
            timeout = window.setTimeout(() => reject(new Error('Tempo esgotado ao verificar sessão.')), timeoutMs)
          }),
        ])
        if (sessionError) throw sessionError
        return data.session
      } finally {
        if (timeout) window.clearTimeout(timeout)
      }
    }

    async function waitForOAuthSession(complete: boolean) {
      const first = await getSessionOnce(3500).catch(() => null)
      if (first || !complete) return first

      return new Promise<Session | null>((resolve) => {
        let finished = false
        let pollTimer: number | undefined
        let deadlineTimer: number | undefined
        let subscription: { unsubscribe: () => void } | null = null

        const finish = (nextSession: Session | null) => {
          if (finished) return
          finished = true
          if (pollTimer) window.clearTimeout(pollTimer)
          if (deadlineTimer) window.clearTimeout(deadlineTimer)
          subscription?.unsubscribe()
          resolve(nextSession)
        }

        const poll = async () => {
          if (finished) return
          const current = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
          if (current.data.session) {
            finish(current.data.session)
            return
          }
          pollTimer = window.setTimeout(() => void poll(), 250)
        }

        const listener = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (nextSession) finish(nextSession)
        })
        subscription = listener.data.subscription
        deadlineTimer = window.setTimeout(() => finish(null), 6500)
        void poll()
      })
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
      const passwordUpdated = search.get('passwordUpdated') === '1'
      const recoveryRequested = search.get('recovery') === '1'
      const oauthError = search.get('error_description') || search.get('error') || ''

      if (active) {
        setParams({ returnTo, profileType, switchAccount })
        if (passwordUpdated) setNotice('Senha atualizada. Entre com seu e-mail e a nova senha.')
        if (recoveryRequested) setEmailMode('recuperar')
      }

      try {
        if (oauthError) throw new Error(decodeURIComponent(oauthError.replace(/\+/g, ' ')))

        if (switchAccount && !complete) {
          await signOutEverywhere().catch(() => undefined)
          if (active) {
            setSession(null)
            setAccounts([])
            setStage('authenticate')
          }
          return
        }

        const currentSession = await waitForOAuthSession(complete)
        if (!currentSession) {
          if (complete) {
            throw new Error('O Google retornou, mas a sessão não foi confirmada. Tente novamente; se persistir, atualize a página uma vez.')
          }
          if (active) setStage('authenticate')
          return
        }

        if (!active) return

        // Depois que o Supabase confirmou a sessão, remove o marcador de callback.
        // Assim um F5 não reexecuta o caminho especial do OAuth nem parece logout.
        if (complete) {
          const cleanUrl = new URL(window.location.href)
          cleanUrl.searchParams.delete('complete')
          cleanUrl.searchParams.delete('error')
          cleanUrl.searchParams.delete('error_description')
          cleanUrl.hash = ''
          window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}`)
        }

        await openAuthenticatedSession(currentSession)
      } catch (cause: unknown) {
        if (!active) return
        setError(friendlyAuthError(cause instanceof Error ? cause.message : 'Não foi possível concluir a autenticação.'))
        setStage('authenticate')
      }
    }

    void initialize()
    return () => {
      active = false
    }
  }, [])

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailLoading(true)
    setError('')
    setNotice('')
    setExistingEmailDetected(false)

    try {
      const normalizedEmail = normalizeEmail(email)
      if (!normalizedEmail || !normalizedEmail.includes('@')) throw new Error('Informe um e-mail válido.')

      if (emailMode === 'entrar') {
        if (!password) throw new Error('Informe sua senha.')
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
        if (signInError || !data.session) throw new Error(friendlyAuthError(signInError?.message || 'Sessão não criada.'))
        await openAuthenticatedSession(data.session)
        return
      }

      if (emailMode === 'criar') {
        const issue = passwordIssue(password)
        if (issue) throw new Error(issue)
        if (password !== confirmPassword) throw new Error('A confirmação da senha não confere.')

        const emailStatusResponse = await fetch('/api/auth/email-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
          cache: 'no-store',
        })
        const emailStatus = await emailStatusResponse.json().catch(() => ({}))
        if (!emailStatusResponse.ok) {
          throw new Error(String(emailStatus?.error || 'Não foi possível validar este e-mail.'))
        }
        if (emailStatus?.exists) {
          setExistingEmailDetected(true)
          throw new Error('Este e-mail já possui uma conta no DropZone. Entre com sua senha ou recupere o acesso.')
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        })
        if (signUpError) throw new Error(friendlyAuthError(signUpError.message))

        if (data.session) {
          await openAuthenticatedSession(data.session)
          return
        }

        setEmail(normalizedEmail)
        setOtpCode('')
        setEmailMode('confirmar-cadastro')
        setNotice(`Enviamos um código de 6 dígitos para ${normalizedEmail}.`)
        return
      }

      if (emailMode === 'confirmar-cadastro') {
        if (!/^\d{6}$/.test(otpCode)) throw new Error('Digite o código de 6 dígitos enviado para seu e-mail.')
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: otpCode,
          type: 'email',
        })
        if (verifyError || !data.session) throw new Error(friendlyAuthError(verifyError?.message || 'Código inválido ou expirado.'))
        await openAuthenticatedSession(data.session)
        return
      }

      if (emailMode === 'recuperar') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail)
        if (resetError) throw new Error(friendlyAuthError(resetError.message))
        setEmail(normalizedEmail)
        setOtpCode('')
        setEmailMode('confirmar-recuperacao')
        setNotice(`Se existe uma conta com ${normalizedEmail}, enviamos um código de recuperação.`)
        return
      }

      if (emailMode === 'confirmar-recuperacao') {
        if (!/^\d{6}$/.test(otpCode)) throw new Error('Digite o código de 6 dígitos enviado para seu e-mail.')
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: otpCode,
          type: 'recovery',
        })
        if (verifyError || !data.session) throw new Error(friendlyAuthError(verifyError?.message || 'Código inválido ou expirado.'))
        setPassword('')
        setConfirmPassword('')
        setOtpCode('')
        setEmailMode('nova-senha')
        setNotice('Código confirmado. Defina sua nova senha.')
        return
      }

      if (emailMode === 'nova-senha') {
        const issue = passwordIssue(password)
        if (issue) throw new Error(issue)
        if (password !== confirmPassword) throw new Error('A confirmação da senha não confere.')

        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw new Error(friendlyAuthError(updateError.message))

        await supabase.auth.signOut().catch(() => undefined)
        setPassword('')
        setConfirmPassword('')
        setEmailMode('entrar')
        setNotice('Senha atualizada. Entre com seu e-mail e a nova senha.')
      }
    } catch (cause: unknown) {
      setError(friendlyAuthError(cause instanceof Error ? cause.message : 'Não foi possível concluir a autenticação.'))
    } finally {
      setEmailLoading(false)
    }
  }

  async function resendCode(kind: 'signup' | 'recovery') {
    setEmailLoading(true)
    setError('')
    setNotice('')
    try {
      const normalizedEmail = normalizeEmail(email)
      if (kind === 'signup') {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: normalizedEmail,
        })
        if (resendError) throw resendError
      } else {
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(normalizedEmail)
        if (resendError) throw resendError
      }
      setOtpCode('')
      setNotice(`Novo código enviado para ${normalizedEmail}.`)
    } catch (cause: unknown) {
      setError(friendlyAuthError(cause instanceof Error ? cause.message : 'Não foi possível reenviar o código.'))
    } finally {
      setEmailLoading(false)
    }
  }

  function changeEmailMode(nextMode: EmailMode) {
    setEmailMode(nextMode)
    setPassword('')
    setConfirmPassword('')
    setOtpCode('')
    setError('')
    setNotice('')
    setExistingEmailDetected(false)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  function openProfile(profile: DropZoneRow) {
    if (!profile.profile_type) return
    clearOAuthReturnState()
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
    clearOAuthReturnState()
    const next = new URLSearchParams({
      cadastro: type,
      vincular: '1',
      returnTo: params.returnTo || '/',
    })
    window.location.assign(`/?${next.toString()}`)
  }

  async function changeAccount() {
    clearOAuthReturnState()
    await signOutEverywhere().catch(() => undefined)
    setSession(null)
    setAccounts([])
    setIsAdmin(false)
    setProfilesLoading(false)
    setProfileLoadError('')
    setEmailMode('entrar')
    setPassword('')
    setConfirmPassword('')
    setOtpCode('')
    setStage('authenticate')
  }

  const authTitle = emailMode === 'criar'
    ? 'CRIE SUA CONTA'
    : emailMode === 'confirmar-cadastro'
      ? 'CONFIRME SEU CÓDIGO'
      : emailMode === 'recuperar' || emailMode === 'confirmar-recuperacao' || emailMode === 'nova-senha'
        ? 'RECUPERE SUA SENHA'
        : 'ENTRE COM SUA CONTA'

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
            <p>Uma única conta conecta todos os seus perfis no DropZone. Entre com Google ou e-mail e escolha exatamente onde deseja acessar.</p>
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
                <h2>{authTitle}</h2>
                <p>
                  {emailMode === 'criar'
                    ? 'Cadastre seu e-mail e senha. Vamos enviar um código de 6 dígitos para confirmar sua conta.'
                    : emailMode === 'confirmar-cadastro'
                      ? 'Digite abaixo o código de 6 dígitos enviado para seu e-mail.'
                      : emailMode === 'recuperar'
                        ? 'Informe o e-mail da sua conta para receber um código de recuperação.'
                        : emailMode === 'confirmar-recuperacao'
                          ? 'Digite o código de recuperação enviado para seu e-mail.'
                          : emailMode === 'nova-senha'
                            ? 'Código confirmado. Agora defina sua nova senha.'
                            : 'Entre com seu e-mail e senha. Se preferir, o acesso com Google continua disponível como alternativa.'}
                </p>

                <form className="login-email-form" onSubmit={handleEmailAuth}>
                  {emailMode !== 'nova-senha' ? (
                    emailMode === 'confirmar-cadastro' || emailMode === 'confirmar-recuperacao' ? (
                      <div className="login-email-sent"><Mail size={22} /><strong>{email}</strong></div>
                    ) : (
                      <label className="login-email-field">
                        <span>E-mail</span>
                        <input
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="voce@email.com"
                          required
                        />
                      </label>
                    )
                  ) : null}

                  {emailMode === 'confirmar-cadastro' || emailMode === 'confirmar-recuperacao' ? (
                    <label className="login-otp-field">
                      <span>Código de 6 dígitos</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        aria-label="Código de 6 dígitos"
                        required
                      />
                    </label>
                  ) : null}

                  {emailMode === 'entrar' || emailMode === 'criar' || emailMode === 'nova-senha' ? (
                    <label className="login-email-field">
                      <span>{emailMode === 'nova-senha' ? 'Nova senha' : 'Senha'}</span>
                      <span className="login-password-control">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={emailMode === 'entrar' ? 'current-password' : 'new-password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder={emailMode === 'nova-senha' ? 'Nova senha' : 'Sua senha'}
                          required
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </span>
                    </label>
                  ) : null}

                  {emailMode === 'criar' || emailMode === 'nova-senha' ? (
                    <>
                      <label className="login-email-field">
                        <span>Confirmar {emailMode === 'nova-senha' ? 'nova senha' : 'senha'}</span>
                        <span className="login-password-control">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            placeholder="Repita a senha"
                            required
                          />
                          <button
                            type="button"
                            className="login-password-toggle"
                            aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                            aria-pressed={showConfirmPassword}
                            onClick={() => setShowConfirmPassword((value) => !value)}
                          >
                            {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </span>
                      </label>
                      <small className="login-password-hint">Mínimo de 8 caracteres, com letra minúscula, maiúscula e número.</small>
                    </>
                  ) : null}

                  <button type="submit" className="login-email-primary" disabled={emailLoading}>
                    {emailLoading ? <Loader2 className="spin" size={16} /> : null}
                    {emailMode === 'criar'
                      ? 'Criar conta com e-mail'
                      : emailMode === 'confirmar-cadastro'
                        ? 'Confirmar conta'
                        : emailMode === 'recuperar'
                          ? 'Enviar código de recuperação'
                          : emailMode === 'confirmar-recuperacao'
                            ? 'Confirmar código'
                            : emailMode === 'nova-senha'
                              ? 'Atualizar senha'
                              : 'Entrar com e-mail'}
                  </button>

                  {emailMode === 'confirmar-cadastro' ? (
                    <button type="button" className="login-email-link otp-resend" disabled={emailLoading} onClick={() => void resendCode('signup')}>Reenviar código</button>
                  ) : null}
                  {emailMode === 'confirmar-recuperacao' ? (
                    <button type="button" className="login-email-link otp-resend" disabled={emailLoading} onClick={() => void resendCode('recovery')}>Reenviar código</button>
                  ) : null}
                </form>

                {emailMode === 'entrar' ? (
                  <>
                    <div className="login-email-actions" aria-label="Ações da conta">
                      <button type="button" className="login-account-action recovery" onClick={() => changeEmailMode('recuperar')}>
                        Esqueci minha senha
                      </button>
                      <span className="login-create-account">
                        Ainda não tem conta?
                        <button type="button" onClick={() => changeEmailMode('criar')}>Criar conta</button>
                      </span>
                    </div>
                    <div className="login-auth-divider login-auth-divider-secondary"><span>ou</span></div>
                    <div className="login-social-secondary">
                      <SocialLogin profileType={null} returnTo={params.returnTo} />
                    </div>
                  </>
                ) : null}

                <div className="login-email-switch">
                  {emailMode === 'entrar' ? null : emailMode === 'confirmar-cadastro' ? (
                    <button type="button" onClick={() => changeEmailMode('criar')}>← Alterar e-mail</button>
                  ) : emailMode === 'confirmar-recuperacao' ? (
                    <button type="button" onClick={() => changeEmailMode('recuperar')}>← Alterar e-mail</button>
                  ) : emailMode === 'nova-senha' ? null : (
                    <button type="button" onClick={() => changeEmailMode('entrar')}>← Voltar para entrar</button>
                  )}
                </div>

                {notice ? <div className="message">{notice}</div> : null}
                {error ? <div className="message error">{error}</div> : null}
                {existingEmailDetected ? (
                  <div className="login-existing-account-actions" aria-label="Conta já existente">
                    <button type="button" onClick={() => changeEmailMode('entrar')}>Entrar com este e-mail</button>
                    <button type="button" onClick={() => changeEmailMode('recuperar')}>Recuperar senha</button>
                  </div>
                ) : null}
                <div className="login-security-note"><ShieldCheck size={16} /><span>Autenticação segura pelo Supabase. Códigos de confirmação e recuperação são enviados pelo e-mail oficial do DropZone.</span></div>
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
                  <button type="button" className="login-change-account" onClick={() => void changeAccount()}>
                    <LogOut size={15} /> Trocar conta
                  </button>
                </div>

                {profilesLoading ? (
                  <div className="login-no-profile" role="status" aria-live="polite">
                    <Loader2 className="spin" size={28} />
                    <strong>Carregando seus perfis</strong>
                    <p>Sua conta já está autenticada. Estamos buscando os acessos vinculados.</p>
                  </div>
                ) : profileLoadError ? (
                  <div className="login-no-profile">
                    <UserRound size={28} />
                    <strong>Sessão confirmada</strong>
                    <p>{profileLoadError}</p>
                    <button type="button" className="button" onClick={() => void retryProfiles()}>Tentar carregar perfis novamente</button>
                  </div>
                ) : accounts.length || isAdmin ? (
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

                {!profilesLoading && !profileLoadError ? <div className="login-create-area">
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
                </div> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  )
}
