import { NextRequest } from 'next/server'
import { getBearerUser } from '../auth/server-auth'
import { supabaseAdmin } from '../shared/supabase-admin'

export async function requireSystemAdmin(req: NextRequest) {
  const user = await getBearerUser(req)
  const { data, error } = await supabaseAdmin.from('sistema_administradores').select('id,status').eq('auth_user_id', user.id).eq('status', 'ativo').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Acesso restrito aos administradores do sistema.')
  return user
}
