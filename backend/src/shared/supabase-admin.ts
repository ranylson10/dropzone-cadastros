import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function cleanEnv(value: string | undefined, name: string) {
  const clean = String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!clean) throw new Error(`${name} nao configurado.`)
  return clean
}

/**
 * Cliente admin lazy: no `next build` (Vercel) o módulo pode ser importado
 * sem env vars ao coletar page data. Só falha quando o client é usado de fato.
 */
let _client: SupabaseClient | null = null

function createAdminClient(): SupabaseClient {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  })
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) _client = createAdminClient()
  return _client
}

/** Compat: exports legados (resolvidos na primeira leitura). */
export function getSupabaseUrl() {
  return cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
}

export function getServiceRoleKey() {
  return cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
}

/** @deprecated Prefer getSupabaseUrl() — mantido para imports existentes. */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
/** @deprecated Prefer getServiceRoleKey() — mantido para imports existentes. */
export const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Proxy para `import { supabaseAdmin }` continuar funcionando sem eager init.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    const client = getSupabaseAdmin()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
