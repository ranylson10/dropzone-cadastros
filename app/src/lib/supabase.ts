import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { secureStorage } from '@/lib/secureStorage'

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey)
}
