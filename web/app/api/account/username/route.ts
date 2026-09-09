import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertUsername } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const username = assertUsername(req.nextUrl.searchParams.get('username'))
    const { data, error } = await supabaseAdmin
      .from('account_identities')
      .select('auth_user_id')
      .ilike('username', username)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json(
      { username, available: !data },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Não foi possível verificar o usuário.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
