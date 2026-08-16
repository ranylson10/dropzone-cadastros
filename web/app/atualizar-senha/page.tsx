'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/layout'
import { SystemLogo } from '@/components/brand/SystemLogo'
import { supabase } from '@/lib/supabase-browser'

function passwordIssue(password: string) {
  if (password.length < 8) return 'Use pelo menos 8 caracteres.'
  if (!/[a-z]/.test(password)) return 'Inclua pelo menos uma letra minúscula.'
  if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.'
  if (!/\d/.test(password)) return 'Inclua pelo menos um número.'
  return ''
}

export default function AtualizarSenhaPage() {
  const [recoveryState, setRecoveryState] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true

    async function checkRecoverySession() {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setRecoveryState(data.session ? 'ready' : 'invalid')
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' && session) setRecoveryState('ready')
    })

    void checkRecoverySession()
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const issue = passwordIssue(password)
      if (issue) throw new Error(issue)
      if (password !== confirmPassword) throw new Error('A confirmação da senha não confere.')

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setDone(true)
      await supabase.auth.signOut().catch(() => undefined)
      window.setTimeout(() => {
        window.location.assign('/login?passwordUpdated=1')
      }, 1400)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell header="never" withAuthOffset={false} mainClassName="login-portal" activeLabel="Início">
      <section className="login-portal-stage password-reset-stage">
        <div className="login-portal-media" aria-hidden="true" />
        <div className="login-portal-overlay" aria-hidden="true" />

        <div className="password-reset-card">
          <SystemLogo size={52} alt="DropZone" variant="accent" />
          <span className="login-panel-step">RECUPERAÇÃO DE CONTA</span>
          <h1>ATUALIZE SUA SENHA</h1>

          {done ? (
            <div className="password-reset-success">
              <CheckCircle2 size={34} />
              <strong>Senha atualizada</strong>
              <span>Voltando para o login...</span>
            </div>
          ) : recoveryState === 'checking' ? (
            <div className="password-reset-invalid">
              <Loader2 className="spin" size={28} />
              <strong>Validando link</strong>
              <span>Aguarde um instante...</span>
            </div>
          ) : recoveryState === 'ready' ? (
            <form className="login-email-form" onSubmit={updatePassword}>
              <label className="login-email-field">
                <span>Nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nova senha"
                  required
                />
              </label>
              <label className="login-email-field">
                <span>Confirmar nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  required
                />
              </label>
              <small className="login-password-hint">Mínimo de 8 caracteres, com letra minúscula, maiúscula e número.</small>
              <button type="submit" className="login-email-primary" disabled={loading}>
                {loading ? <Loader2 className="spin" size={16} /> : null}
                Atualizar senha
              </button>
              {error ? <div className="message error">{error}</div> : null}
            </form>
          ) : (
            <div className="password-reset-invalid">
              <ShieldCheck size={28} />
              <strong>Link inválido ou expirado</strong>
              <span>Solicite uma nova recuperação na tela de login.</span>
              <a href="/login">Voltar para o login</a>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  )
}
