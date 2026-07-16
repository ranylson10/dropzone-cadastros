'use client'

import { useState } from 'react'
import type { Provider } from '@supabase/supabase-js'
import { getSupabasePublicConfig, supabase } from '@/lib/supabase-browser'
import type { ProfileType } from '@/lib/types'
import { safeInternalPath, type SocialProvider } from './auth-return'

type Props = {
  profileType?: ProfileType | null
  returnTo?: string
}

const labels: Record<SocialProvider, string> = {
  google: 'Continuar com Google',
  facebook: 'Continuar com Facebook',
  discord: 'Continuar com Discord',
}

export function SocialLogin({ profileType = null, returnTo = '/' }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null)
  const [error, setError] = useState('')

  async function startOAuth(provider: SocialProvider) {
    setLoadingProvider(provider)
    setError('')

    try {
      const config = getSupabasePublicConfig()
      if (!config.ok) {
        throw new Error(
          'Login indisponível: configuração do Supabase ausente neste deploy. ' +
            'No Vercel, defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
            '(Production e Preview) e faça Redeploy.',
        )
      }

      if (profileType) localStorage.setItem('dropzone_active_profile_type', profileType)
      const normalizedReturnTo = safeInternalPath(returnTo)
      const callback = new URL('/login', window.location.origin)
      callback.searchParams.set('returnTo', normalizedReturnTo)
      if (profileType) callback.searchParams.set('profileType', profileType)
      callback.searchParams.set('complete', '1')

      const options: Record<string, unknown> = {
        redirectTo: callback.toString(),
      }

      if (provider === 'google') {
        options.queryParams = { access_type: 'offline', prompt: 'select_account' }
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options,
      })
      if (oauthError) throw oauthError
    } catch (cause: any) {
      const msg = String(cause?.message || '')
      if (/placeholder\.supabase|127\.0\.0\.1:9|configuração do supabase|configuracao do supabase/i.test(msg)) {
        setError(
          'Login indisponível: as variáveis NEXT_PUBLIC_SUPABASE_URL / ANON_KEY não estão no build. ' +
            'Configure no Vercel (Production + Preview) e faça Redeploy.',
        )
      } else {
        setError(msg || `Não foi possível entrar com ${labels[provider].replace('Continuar com ', '')}.`)
      }
      setLoadingProvider(null)
    }
  }

  return (
    <div className="social-login-stack">
      {(Object.keys(labels) as SocialProvider[]).map((provider) => (
        <button
          key={provider}
          type="button"
          className={`button social-login-button social-login-${provider}`}
          disabled={Boolean(loadingProvider)}
          onClick={() => startOAuth(provider)}
        >
          <img src={`/social-${provider}.svg`} alt="" />
          {loadingProvider === provider ? `Abrindo ${labels[provider].replace('Continuar com ', '')}...` : labels[provider]}
        </button>
      ))}
      {error ? <div className="message error">{error}</div> : null}
    </div>
  )
}
