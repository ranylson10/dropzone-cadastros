'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function readPublicEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  return String(process.env[name] || '')
    .replace(/^\uFEFF/, '')
    .replace(/^ï»¿/, '')
    .trim()
    // Header values used by supabase-js must stay ASCII-safe in browser fetch.
    .replace(/[^\x20-\x7E]/g, '')
}

/**
 * Cliente browser lazy: no `next build` o módulo pode ser importado em SSR
 * de Client Components sem as env públicas (ex.: preview Vercel sem secrets).
 * Só cria o client na primeira propriedade acessada.
 */
let _client: SupabaseClient | null = null

function getBrowserClient(): SupabaseClient {
  if (_client) return _client

  const url = readPublicEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = readPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (!url || !anonKey) {
    // Placeholder só para sobreviver a SSR/prerender sem env.
    // Chamadas reais em runtime sem env falham de forma legível.
    _client = createClient('https://placeholder.supabase.co', 'public-anon-key-placeholder', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
    return _client
  }

  _client = createClient(url, anonKey)
  return _client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getBrowserClient()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
