'use client'

import { supabase } from './supabase-browser'
import type { Session } from '@supabase/supabase-js'

const EXACT_LOCAL_KEYS = new Set([
  'dropzone_active_profile_type',
  'dropzone_recent_profiles',
  'dropzone_panel_snapshot_last',
])

const LOCAL_PREFIXES = [
  'dropzone_panel_cache_',
  'dropzone_panel_snapshot_',
]

const SESSION_KEYS = [
  'dropzone_oauth_return_to',
  'dropzone_oauth_profile_type',
]

export function clearDropzoneClientState() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (!key) continue
      if (EXACT_LOCAL_KEYS.has(key) || LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // O logout do servidor continua mesmo se o navegador bloquear storage.
  }

  try {
    SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key))
  } catch {
    // Private mode etc.
  }
}

export async function signOutEverywhere() {
  clearDropzoneClientState()
  try {
    const { error } = await Promise.race([
      supabase.auth.signOut({ scope: 'global' }),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('Tempo esgotado ao encerrar a sessão.')), 6000),
      ),
    ])
    if (error) throw error
  } finally {
    // Limpa novamente porque listeners de auth podem gravar estado durante o logout.
    clearDropzoneClientState()
  }
}

export async function getSessionWithTimeout(timeoutMs = 6000): Promise<Session | null> {
  const result = await Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error('Tempo esgotado ao verificar a sessão.')), timeoutMs),
    ),
  ])
  if (result.error) throw result.error
  return result.data.session
}
