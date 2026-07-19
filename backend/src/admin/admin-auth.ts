import { NextRequest } from 'next/server'
import { getBearerUser } from '../auth/server-auth'
import { supabaseAdmin } from '../shared/supabase-admin'

export async function isSystemAdmin(authUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('sistema_administradores')
    .select('id,status,email,nome')
    .eq('auth_user_id', authUserId)
    .eq('status', 'ativo')
    .maybeSingle()
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code || '')) return null
    throw error
  }
  return data || null
}

export async function requireSystemAdmin(req: NextRequest) {
  const user = await getBearerUser(req)
  const adminRow = await isSystemAdmin(user.id)
  if (!adminRow) throw new Error('Acesso restrito aos administradores do sistema.')
  // Mantém shape compatível (user.id) + metadados do admin
  return Object.assign(user, { adminRow })
}
