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

const CONFIG_ERROR =
  'Configuração do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente (local: web/.env.local · Vercel: Project Settings → Environment Variables) e faça um novo deploy.'

/**
 * Cliente browser.
 * - Em runtime no browser: exige env reais (nunca usa placeholder.supabase.co).
 * - Em SSR/build sem env: proxy inerte que não redireciona o usuário para domínio inventado.
 */
let _client: SupabaseClient | null = null

function createRealClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

function createBuildStubClient(): SupabaseClient {
  // Domínio local inválido de propósito — só para o módulo importar no SSR/build.
  // Nunca deve ser usado no browser (getBrowserClient bloqueia antes).
  return createClient('http://127.0.0.1:9', 'public-anon-key-build-stub', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function getSupabasePublicConfig() {
  const url = readPublicEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = readPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return {
    url,
    anonKey,
    ok: Boolean(url && anonKey && !url.includes('placeholder.supabase')),
  }
}

function getBrowserClient(): SupabaseClient {
  if (_client) return _client

  const { url, anonKey, ok } = getSupabasePublicConfig()

  if (typeof window !== 'undefined') {
    if (!ok) {
      throw new Error(CONFIG_ERROR)
    }
    _client = createRealClient(url, anonKey)
    return _client
  }

  // SSR / collect page data no build
  if (ok) {
    _client = createRealClient(url, anonKey)
  } else {
    _client = createBuildStubClient()
  }
  return _client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getBrowserClient()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
