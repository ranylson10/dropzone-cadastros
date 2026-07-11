import type { DropZoneRow } from '@/lib/types'

export function rowTitle(row?: DropZoneRow | null) {
  if (!row) return '-'
  if (row.name) return row.name
  if (row.username) return `@${row.username}`
  if (row.token) return row.token
  return row.entity_type
}

export function dataText(row: DropZoneRow | undefined, key: string) {
  const value = row?.data?.[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export function tokenText(token: string | null) {
  return token || 'sem-token'
}

export function mediaForProfile(profile: any) {
  return profile?.data?.logo_url || profile?.data?.avatar_url || ''
}

export function safeHeaderText(value: string) {
  return String(value || '').trim().replace(/[^\x20-\x7E]/g, '')
}

export function authHeaders(token: string, profileType?: string | null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${safeHeaderText(token)}` }
  if (profileType) headers['X-Profile-Type'] = safeHeaderText(profileType)
  return headers
}

export function loginSuggestion(value: string) {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._\s-]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    .replace(/-+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 20)

  return base.length >= 3 ? base : ''
}
