const DEFAULT_API_URL = 'https://dropzone-cadastros.vercel.app'
const DEFAULT_AUTH_REDIRECT_URL = `${DEFAULT_API_URL}/auth/mobile-callback`
export const MOBILE_DEEP_LINK_AUTH_CALLBACK = 'dropzone://auth/callback'

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_DROPZONE_API_URL || DEFAULT_API_URL,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  authRedirectUrl: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || DEFAULT_AUTH_REDIRECT_URL,
}

export function apiUrl(path: string) {
  const cleanBase = env.apiUrl.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}

export function externalUrl(pathOrUrl: string) {
  const value = String(pathOrUrl || '').trim()
  if (/^https?:\/\//i.test(value)) return value
  return apiUrl(value)
}

export function isValidMobileAuthRedirect(url = env.authRedirectUrl) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'dropzone:' && parsed.hostname === 'auth' && parsed.pathname === '/callback') return true
    return parsed.protocol === 'https:' && parsed.hostname === 'dropzone-cadastros.vercel.app' && parsed.pathname === '/auth/mobile-callback'
  } catch {
    return false
  }
}
