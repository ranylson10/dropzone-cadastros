import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const [{ data: byId, error: e1 }, { data: byAuth, error: e2 }] = await Promise.all([
      supabaseAdmin.from('managers').select('*').eq('id', id).maybeSingle(),
      supabaseAdmin.from('managers').select('*').eq('auth_user_id', id).maybeSingle(),
    ])
    return NextResponse.json({ byId, byAuth, errors: [e1?.message || null, e2?.message || null] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
