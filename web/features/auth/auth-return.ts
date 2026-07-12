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
  return value === 'produtora' || value === 'equipe' || value === 'jogador' || value === 'manager'
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
