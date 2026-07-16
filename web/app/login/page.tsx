'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AppShell } from '@/components/layout'
import { supabase } from '@/lib/supabase-browser'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { parseProfileType, safeInternalPath } from '@/features/auth/auth-return'

const profileLabels = {
  produtora: 'produtora',
  equipe: 'equipe',
  jogador: 'jogador',
  manager: 'manager',
} as const

export default function LoginPage() {
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [params, setParams] = useState({ returnTo: '/', profileType: null as ReturnType<typeof parseProfileType>, switchAccount: false })

  const description = useMemo(() => {
    if (!params.profileType) return 'Escolha uma conta para acessar o DropZone.'
    return `Use uma das contas abaixo para acessar ou criar seu perfil de ${profileLabels[params.profileType]}.`
  }, [params.profileType])

  useEffect(() => {
    let active = true
    const safetyTimer = window.setTimeout(() => {
      if (active) setChecking(false)
    }, 12000)

    async function initialize() {
      const search = new URLSearchParams(window.location.search)
      const returnTo = safeInternalPath(search.get('returnTo'))
      const profileType = parseProfileType(search.get('profileType'))
      const switchAccount = search.get('switch') === '1'
      const complete = search.get('complete') === '1'
      if (active) setParams({ returnTo, profileType, switchAccount })

      try {
        if (switchAccount && !complete) {
          try {
            await supabase.auth.signOut()
          } catch {
            // ignore
          }
          return
        }

        const sessionRace = Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('Tempo esgotado ao verificar sessão.')), 8000),
          ),
        ])
        const { data, error: sessionError } = await sessionRace
        if (sessionError) throw sessionError
        let session: Session | null = data.session

        // O callback OAuth pode terminar instantes depois de a página montar.
        if (complete && !session) {
          session = await new Promise<Session | null>((resolve) => {
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
              try {
                const current = await supabase.auth.getSession()
                resolve(current.data.session)
              } catch {
                resolve(null)
              }
            }, 4000)
          })
        }

        if (!complete || !session) {
          return
        }

        // Verifica se o login social ja tem o perfil exigido (ex.: equipe no link de grupo).
        // Sem perfil, abre o formulario de criacao vinculado a este login.
        if (profileType) {
          try {
            const meRes = await fetch('/api/me', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'X-Profile-Type': profileType,
              },
              cache: 'no-store',
            })
            const meJson = await meRes.json().catch(() => ({}))
            const accounts = Array.isArray(meJson.accounts) ? meJson.accounts : meJson.account ? [meJson.account] : []
            const hasProfile = accounts.some((item: any) => item?.profile_type === profileType)

            if (hasProfile) {
              window.location.replace(returnTo || '/')
              return
            }

            const next = new URLSearchParams({
              cadastro: profileType,
              vincular: '1',
              returnTo: returnTo || '/',
            })
            window.location.replace(`/?${next.toString()}`)
            return
          } catch {
            const next = new URLSearchParams({
              cadastro: profileType,
              vincular: '1',
              returnTo: returnTo || '/',
            })
            window.location.replace(`/?${next.toString()}`)
            return
          }
        }

        window.location.replace(returnTo || '/')
      } catch (cause: any) {
        if (!active) return
        setError(cause?.message || 'Não foi possível concluir a autenticação.')
      } finally {
        if (active) setChecking(false)
        window.clearTimeout(safetyTimer)
      }
    }

    void initialize()
    return () => {
      active = false
      window.clearTimeout(safetyTimer)
    }
  }, [])

  return (
    <AppShell loadSession mainClassName="central-login-page page" activeLabel="Início">
      <section className="central-login-shell">
        <div className="central-login-card central-login-card-light">
          {checking ? (
            <div className="dropzone-auth-validation" role="status" aria-live="polite">
              <div className="dropzone-auth-validation-logo">
                <img src="/dropzone-icon.png" alt="" />
              </div>
              <strong>Validando seu acesso</strong>
              <span>Aguarde um instante...</span>
            </div>
          ) : (
            <>
              <div className="auth-site-mark central-login-brand">
                <img src="/dropzone-icon.png" alt="DropZone" />
                <div><span>DropZone</span><strong>ACESSO</strong></div>
              </div>
              <h1>Entrar no DropZone</h1>
              <p>{description}</p>
              <SocialLogin profileType={params.profileType} returnTo={params.returnTo} />
              {error ? <div className="message error">{error}</div> : null}
            </>
          )}
        </div>
      </section>
    </AppShell>
  )
}
