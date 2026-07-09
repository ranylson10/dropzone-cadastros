import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import type { DropZoneRow } from './types'

export async function getBearerUser(req: NextRequest) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    throw new Error('Sessao ausente.')
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    throw new Error('Sessao invalida.')
  }

  return data.user
}

export async function getAccountByUserId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('DropZone')
    .select('*')
    .eq('entity_type', 'account')
    .eq('auth_user_id', userId)
    .single()

  if (error) throw new Error('Conta nao encontrada na DropZone.')
  return data as DropZoneRow
}
