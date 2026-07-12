'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { PublicDirectoryHeader } from '@/features/directory/components/PublicDirectoryHeader'
import { supabase } from '@/lib/supabase-browser'
import { SocialLogin } from '@/features/auth/SocialLogin'
import { buildProfileCreationHref, parseProfileType, safeInternalPath } from '@/features/auth/auth-return'

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
    return `Entre para continuar. Caso ainda não possua um perfil de ${profileLabels[params.profileType]}, o cadastro complementar será aberto automaticamente.`
  }, [params.profileType])

  useEffect(() => {
    async function initialize() {
      const search = new URLSearchParams(window.location.search)
      const returnTo = safeInternalPath(search.get('returnTo'))
      const profileType = parseProfileType(search.get('profileType'))
      const switchAccount = search.get('switch') === '1'
      const complete = search.get('complete') === '1'
      setParams({ returnTo, profileType, switchAccount })

      if (switchAccount && !complete) {
        await supabase.auth.signOut()
        setChecking(false)
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        setError(sessionError.message)
        setChecking(false)
        return
      }

      if (!data.session) {
        setChecking(false)
        return
      }

      if (!complete && !switchAccount) {
        setChecking(false)
        return
      }

      try {
        if (!profileType) {
          window.location.replace(returnTo)
          return
        }

        const response = await fetch('/api/me', {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            'x-profile-type': profileType,
          },
        })
        const payload = await response.json().catch(() => ({}))
        const accounts = Array.isArray(payload.accounts) ? payload.accounts : []
        const hasRequiredProfile = accounts.some((account: any) => account?.profile_type === profileType)

        if (hasRequiredProfile) {
          window.location.replace(returnTo)
          return
        }

        window.location.replace(buildProfileCreationHref(profileType, returnTo))
      } catch (cause: any) {
        setError(cause?.message || 'Não foi possível concluir a autenticação.')
        setChecking(false)
      }
    }

    initialize()
  }, [])

  return (
    <main className="central-login-page">
      <PublicDirectoryHeader />
      <section className="central-login-shell">
        <div className="central-login-card">
          <div className="central-login-mark"><ShieldCheck size={28} /></div>
          <p className="eyebrow">ACESSO CENTRALIZADO</p>
          <h1>Entrar no DropZone</h1>
          <p>{description}</p>

          {checking ? (
            <div className="central-login-loading" role="status" aria-live="polite">
              <div className="dropzone-login-loader" aria-hidden="true">
                <span className="dropzone-login-loader-mark"><img src="/dropzone-icon.png" alt="" /></span>
              </div>
              <strong>Validando seu acesso</strong>
              <span>Estamos preparando seu perfil...</span>
            </div>
          ) : (
            <SocialLogin profileType={params.profileType} returnTo={params.returnTo} />
          )}

          {error ? <div className="message error">{error}</div> : null}
          <small className="central-login-note">Google, Facebook ou Discord confirmam sua identidade. Os dados específicos do perfil DropZone são preenchidos separadamente.</small>
        </div>
      </section>
    </main>
  )
}
