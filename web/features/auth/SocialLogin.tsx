'use client'

import { useState } from 'react'
import type { Provider } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-browser'
import type { ProfileType } from '@/lib/types'
import { safeInternalPath, type SocialProvider } from './auth-return'

type Props = {
  profileType?: ProfileType | null
  returnTo?: string
  compact?: boolean
}

const labels: Record<SocialProvider, string> = {
  google: 'Continuar com Google',
  facebook: 'Continuar com Facebook',
  discord: 'Continuar com Discord',
}

export function SocialLogin({ profileType = null, returnTo = '/', compact = false }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null)
  const [error, setError] = useState('')

  async function startOAuth(provider: SocialProvider) {
    setLoadingProvider(provider)
    setError('')

    try {
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
      setError(cause?.message || `Não foi possível entrar com ${labels[provider].replace('Continuar com ', '')}.`)
      setLoadingProvider(null)
    }
  }

  return (
    <div className={`social-login-stack${compact ? ' social-login-compact' : ''}`}>
      {(Object.keys(labels) as SocialProvider[]).map((provider) => (
        <button
          key={provider}
          type="button"
          className={`button social-login-button social-login-${provider}`}
          disabled={Boolean(loadingProvider)}
          onClick={() => startOAuth(provider)}
        >
          <span className="social-login-provider-mark" aria-hidden="true">
            {provider === 'google' ? 'G' : provider === 'facebook' ? 'f' : 'D'}
          </span>
          <span>{loadingProvider === provider ? `Abrindo ${labels[provider].replace('Continuar com ', '')}...` : labels[provider]}</span>
        </button>
      ))}
      {error ? <div className="message error">{error}</div> : null}
    </div>
  )
}
