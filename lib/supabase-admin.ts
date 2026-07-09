import { createClient } from '@supabase/supabase-js'

function cleanEnv(value: string | undefined, name: string) {
  const clean = String(value || '').replace(/^﻿/, '').trim()
  if (!clean) throw new Error(`${name} nao configurado.`)
  return clean
}

export const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
export const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
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
