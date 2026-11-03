import type { NextRequest } from 'next/server'
import { getAccountsForUser, mapProfile, toClientProfile } from './server-auth'
import { supabaseAdmin } from '../shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '../shared/paginated-query'
import { isMissingRelation } from '../equipes/manager-invites'
import type { DropZoneRow, ProfileType } from '../types/dropzone.types'

const DELEGATED_TYPES = [
  { type: 'equipe', links: 'manager_equipe', target: 'equipe_id', table: 'equipes', permissions: ['pode_ver', 'pode_editar', 'pode_escalar', 'pode_gerar_token'] },
  { type: 'jogador', links: 'manager_jogador', target: 'jogador_id', table: 'jogadores', permissions: ['pode_ver', 'pode_editar'] },
] as const

/** Contexts are separate from owned login profiles. Never treat a deputy as an owner. */
export async function listWorkspaceContexts(user: { id: string }, owned?: DropZoneRow[]) {
  const accounts = owned || await getAccountsForUser(user)
  const managerIds = accounts.filter(account => account.profile_type === 'manager').map(account => account.id)
  if (!managerIds.length) return accounts.map(toClientProfile)
  const batches = await Promise.all(DELEGATED_TYPES.map(async config => {
    let links: Record<string, any>[]
    try {
      links = await readPagedRows(supabaseAdmin.from(config.links)
        .select(['id', config.target, ...config.permissions].join(','))
        .in('manager_id', managerIds).eq('status', 'ativo').eq('pode_ver', true).order('id'))
    } catch (error) {
      if (isMissingRelation(error as { code?: string; message?: string })) return []
      throw error
    }
    if (!links.length) return []
    const targets = await readRowsByIds<Record<string, any>>(
      [...new Set(links.map(link => String(link[config.target])))],
      ids => supabaseAdmin.from(config.table).select('*').in('id', ids).order('id'))
    return targets.filter(target => target.status === 'ativo').map(target => {
      const granted = links.filter(link => String(link[config.target]) === String(target.id))
      const permissions = Object.fromEntries(config.permissions.map(key => [key, granted.some(link => link[key] === true)]))
      const account = toClientProfile(mapProfile(target, config.type as ProfileType))
      // No leader's auth ID, password or token goes to the browser.
      return { ...account, auth_user_id: null, created_by: null, data: {
        ...account.data, delegated_access: true, delegated_permissions: permissions,
      } }
    })
  }))
  // A real owner always wins over a delegated link to the same entity.
  return [...new Map([...batches.flat(), ...accounts.map(toClientProfile)].map(account => [`${account.profile_type}:${account.id}`, account])).values()]
}

export async function requireWorkspaceContext(user: { id: string }, profileId: string, profileType?: string) {
  const contexts = await listWorkspaceContexts(user)
  const context = contexts.find(account => account.id === profileId && (!profileType || account.profile_type === profileType))
  if (!context) throw new Error('Você não tem acesso a este painel.')
  return context
}

/** Read-only resolution: mutation routes keep their existing capability checks. */
export async function getWorkspaceReadContext(req: NextRequest, user: { id: string }, fallback: DropZoneRow) {
  const id = String(req.headers.get('x-profile-id') || '').trim()
  if (!id || id === fallback.id) return fallback
  return requireWorkspaceContext(user, id, req.headers.get('x-profile-type') || undefined)
}
