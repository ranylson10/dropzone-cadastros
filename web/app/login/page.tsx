'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { PublicDirectoryHeader } from '@/features/directory/components/PublicDirectoryHeader'
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

    async function initialize() {
      const search = new URLSearchParams(window.location.search)
      const returnTo = safeInternalPath(search.get('returnTo'))
      const profileType = parseProfileType(search.get('profileType'))
      const switchAccount = search.get('switch') === '1'
      const complete = search.get('complete') === '1'
      if (active) setParams({ returnTo, profileType, switchAccount })

      try {
        if (switchAccount && !complete) {
          await supabase.auth.signOut()
          if (active) setChecking(false)
          return
        }

        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        let session: Session | null = data.session

        // O callback OAuth pode terminar instantes depois de a página montar.
        if (complete && !session) {
          session = await new Promise<Session | null>((resolve) => {
            let settled = false
            let timer = 0
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
              if (!session || settled) return
              settled = true
              window.clearTimeout(timer)
              subscription.unsubscribe()
              resolve(session)
            })
            timer = window.setTimeout(async () => {
              if (settled) return
              settled = true
              subscription.unsubscribe()
              const current = await supabase.auth.getSession()
              resolve(current.data.session)
            }, 4000)
          })
        }

        if (!complete || !session) {
          if (active) setChecking(false)
          return
        }

        // A página de origem é responsável por verificar o perfil necessário.
        // Assim o callback não fica preso aguardando /api/me e o retorno é imediato.
        const destination = profileType
          ? `/?login=${profileType}${returnTo !== '/' ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`
          : returnTo
        window.location.replace(destination)
      } catch (cause: any) {
        if (!active) return
        setError(cause?.message || 'Não foi possível concluir a autenticação.')
        setChecking(false)
      }
    }

    void initialize()
    return () => { active = false }
  }, [])

  return (
    <main className="central-login-page">
      <PublicDirectoryHeader />
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
    </main>
  )
}
