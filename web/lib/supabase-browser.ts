'use client'

import { createClient } from '@supabase/supabase-js'

function cleanPublicEnv(value: string | undefined, name: string) {
  const clean = String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/^ï»¿/, '')
    .trim()
    // Header values used by supabase-js must stay ASCII-safe in browser fetch.
    .replace(/[^\x20-\x7E]/g, '')

  if (!clean) throw new Error(`${name} nao configurado.`)
  return clean
}

export const supabase = createClient(
  cleanPublicEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
  cleanPublicEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
)
