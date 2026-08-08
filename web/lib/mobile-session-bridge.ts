'use client'

import { supabase } from '@/lib/supabase-browser'

const ACCESS_KEY = 'dropzone_mobile_access_token'
const REFRESH_KEY = 'dropzone_mobile_refresh_token'
const SYNC_KEY = 'dropzone_mobile_session_synced'

export async function syncMobileSessionFromStorage() {
  if (typeof window === 'undefined') return false

  const accessToken = window.localStorage.getItem(ACCESS_KEY) || ''
  const refreshToken = window.localStorage.getItem(REFRESH_KEY) || ''
  const syncMark = `${accessToken.slice(0, 16)}:${refreshToken.slice(0, 16)}`

  if (!accessToken || !refreshToken) return false

  const current = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
  if (current.data.session?.access_token === accessToken) return true
  if (window.localStorage.getItem(SYNC_KEY) === syncMark && current.data.session) return true

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error) {
    window.localStorage.removeItem(SYNC_KEY)
    return false
  }

  window.localStorage.setItem(SYNC_KEY, syncMark)
  return true
}
