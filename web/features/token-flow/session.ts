'use client'

import type { Session } from '@supabase/supabase-js'
import type { ProfileType } from '@/lib/types'
import { supabase } from '@/lib/supabase-browser'
import { buildLoginHref, safeInternalPath } from '@/features/auth/auth-return'

export type TokenFlowSession = {
  session: Session | null
  accessToken: string | null
  authenticated: boolean
  error: string | null
}

export async function getTokenFlowSession(): Promise<TokenFlowSession> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    return { session: null, accessToken: null, authenticated: false, error: error.message || 'Sessão indisponível.' }
  }
  const session = data.session || null
  return {
    session,
    accessToken: session?.access_token || null,
    authenticated: Boolean(session?.access_token),
    error: null,
  }
}

export async function getTokenFlowAccessToken() {
  const session = await getTokenFlowSession()
  return session.accessToken
}

export function tokenFlowAuthHeaders(accessToken: string | null | undefined, extra?: HeadersInit) {
  const headers = new Headers(extra)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return Object.fromEntries(headers.entries())
}

export async function requireTokenFlowAccessToken(
  profileType: ProfileType | null | undefined,
  returnTo: string,
  options?: { switchAccount?: boolean; redirect?: boolean },
) {
  const accessToken = await getTokenFlowAccessToken()
  if (accessToken) return accessToken

  if (options?.redirect !== false && typeof window !== 'undefined') {
    window.location.assign(
      buildLoginHref(profileType, safeInternalPath(returnTo), Boolean(options?.switchAccount)),
    )
  }
  return null
}
