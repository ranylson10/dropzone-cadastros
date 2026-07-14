import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin.from('managers').select('id,auth_user_id,username,nome,status').limit(20)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ managers: data })
}
