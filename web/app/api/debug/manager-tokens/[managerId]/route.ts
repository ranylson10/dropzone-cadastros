import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(_req: Request, context: { params: Promise<{ managerId: string }> }) {
  const { managerId } = await context.params
  const [byManagerId, byManagerAuthUserId, allInvites] = await Promise.all([
    supabaseAdmin.from('tokens').select('*').eq('tipo', 'manager_invite').eq('manager_id', managerId).order('created_at', { ascending: false }),
    supabaseAdmin.from('tokens').select('*').eq('tipo', 'manager_invite').eq('manager_auth_user_id', managerId).order('created_at', { ascending: false }),
    supabaseAdmin.from('tokens').select('*').eq('tipo', 'manager_invite').order('created_at', { ascending: false }).limit(20),
  ])

  return NextResponse.json({ byManagerId, byManagerAuthUserId, allInvites })
}
