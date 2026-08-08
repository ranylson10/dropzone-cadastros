const DEFAULT_API_URL = 'https://dropzone-cadastros.vercel.app'
const DEFAULT_AUTH_REDIRECT_URL = 'dropzone://auth/callback'

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

export function isValidMobileAuthRedirect(url = env.authRedirectUrl) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'dropzone:' && parsed.hostname === 'auth' && parsed.pathname === '/callback'
  } catch {
    return false
  }
}
