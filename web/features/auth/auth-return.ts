import type { ProfileType } from '@/lib/types'

export const SOCIAL_PROVIDERS = ['google', 'facebook', 'discord'] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

export function safeInternalPath(value: string | null | undefined, fallback = '/') {
  const path = String(value || '').trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback

  try {
    const parsed = new URL(path, 'https://dropzone.local')
    if (parsed.origin !== 'https://dropzone.local') return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function parseProfileType(value: string | null | undefined): ProfileType | null {
  return (
    value === 'produtora' ||
    value === 'equipe' ||
    value === 'jogador' ||
    value === 'manager' ||
    value === 'broadcast'
  )
    ? value
    : null
}

export function buildLoginHref(profileType?: ProfileType | null, returnTo = '/', switchAccount = false) {
  const params = new URLSearchParams()
  if (profileType) params.set('profileType', profileType)
  params.set('returnTo', safeInternalPath(returnTo))
  if (switchAccount) params.set('switch', '1')
  return `/login?${params.toString()}`
}

export function buildProfileCreationHref(profileType: ProfileType, returnTo = '/') {
  const params = new URLSearchParams({
    cadastro: profileType,
    vincular: '1',
    returnTo: safeInternalPath(returnTo),
  })
  return `/?${params.toString()}`
}

/** Caminho atual seguro para retomar uma ação após autenticar. */
export function currentInternalPath() {
  if (typeof window === 'undefined') return '/'
  return safeInternalPath(`${window.location.pathname}${window.location.search}${window.location.hash}`)
}

/**
 * Centraliza bloqueios de sessão no cliente. Nenhuma área protegida deve só
 * informar que a sessão expirou: ela precisa abrir o login com o contexto.
 */
export function redirectToLogin(profileType?: ProfileType | null, returnTo = currentInternalPath()) {
  if (typeof window === 'undefined') return
  window.location.assign(buildLoginHref(profileType, returnTo))
}
