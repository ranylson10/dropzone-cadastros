export const env = {
  apiUrl: process.env.EXPO_PUBLIC_DROPZONE_API_URL || 'https://dropzone-cadastros.vercel.app',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
}

export function apiUrl(path: string) {
  const cleanBase = env.apiUrl.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}
