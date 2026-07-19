'use client'

import { useState } from 'react'
import type { Provider } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-browser'
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

/** Chaves de retorno OAuth (evita query string longa no redirectTo — quebra Google). */
export const OAUTH_RETURN_KEY = 'dropzone_oauth_return_to'
export const OAUTH_PROFILE_KEY = 'dropzone_oauth_profile_type'

export function SocialLogin({ profileType = null, returnTo = '/' }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null)
  const [error, setError] = useState('')

  async function startOAuth(provider: SocialProvider) {
    setLoadingProvider(provider)
    setError('')

    try {
      const normalizedReturnTo = safeInternalPath(returnTo)

      // Estado local: não embute profileType/returnTo na URL do redirect
      // (redirectTo com muitos params quebra o authorize do Google com 400 malformed).
      try {
        if (profileType) {
          localStorage.setItem('dropzone_active_profile_type', profileType)
          sessionStorage.setItem(OAUTH_PROFILE_KEY, profileType)
        } else {
          sessionStorage.removeItem(OAUTH_PROFILE_KEY)
        }
        sessionStorage.setItem(OAUTH_RETURN_KEY, normalizedReturnTo)
      } catch {
        // private mode etc.
      }

      // URL limpa e allowlist-friendly (Site URL + /login)
      const redirectTo = `${window.location.origin}/login?complete=1`

      const providerOptions: Record<SocialProvider, { scopes?: string; queryParams?: Record<string, string> }> = {
        google: {
          queryParams: { prompt: 'select_account' },
        },
        facebook: {
          // e-mail + perfil público (padrão Facebook Login)
          scopes: 'email,public_profile',
        },
        discord: {
          // identify + e-mail (necessário para vincular conta DropZone)
          scopes: 'identify email',
        },
      }

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo,
          skipBrowserRedirect: false,
          ...providerOptions[provider],
        },
      })

      if (oauthError) throw oauthError

      // Se o cliente não redirecionar sozinho, força navegação
      if (data?.url) {
        window.location.assign(data.url)
        return
      }
    } catch (cause: any) {
      const msg = String(cause?.message || '')
      const providerName = labels[provider].replace('Continuar com ', '')
      let hint = ''
      if (/unsupported|not enabled|disabled|provider/i.test(msg)) {
        hint = ` Ative o provedor ${providerName} em Supabase → Authentication → Providers e cole Client ID/Secret.`
      } else if (/redirect|url|origin/i.test(msg)) {
        hint = ' Confira Site URL e Redirect URLs no Supabase (Auth → URL Configuration).'
      } else if (provider === 'facebook') {
        hint =
          ' No Meta Developers, adicione o redirect: https://uukivzxabiydnrvjvabt.supabase.co/auth/v1/callback e ative Facebook Login.'
      } else if (provider === 'discord') {
        hint =
          ' No Discord Developer Portal → OAuth2, adicione Redirect: https://uukivzxabiydnrvjvabt.supabase.co/auth/v1/callback'
      } else {
        hint =
          ' Se o Google mostrar erro 400, confira o redirect: https://uukivzxabiydnrvjvabt.supabase.co/auth/v1/callback'
      }
      setError((msg || `Não foi possível entrar com ${providerName}.`) + hint)
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
          onClick={() => void startOAuth(provider)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/social-${provider}.svg`}
            alt=""
            width={20}
            height={20}
            style={{
              width: 20,
              height: 20,
              maxWidth: 20,
              maxHeight: 20,
              minWidth: 20,
              minHeight: 20,
              flex: '0 0 20px',
              display: 'block',
              objectFit: 'contain',
            }}
          />
          {loadingProvider === provider
            ? `Abrindo ${labels[provider].replace('Continuar com ', '')}...`
            : labels[provider]}
        </button>
      ))}
      {error ? <div className="message error">{error}</div> : null}
    </div>
  )
}
