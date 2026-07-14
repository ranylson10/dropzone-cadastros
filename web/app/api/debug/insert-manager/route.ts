import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET() {
  const managerData = {
    auth_user_id: 'b8800705-8850-4ec5-8207-34d3166830fa',
    username: 'manager_b8800705',
    nome: 'Manager b8800705',
    email_contato: 'manager-b8800705@example.com',
  }

  const { data, error } = await supabaseAdmin.from('managers').insert(managerData).select('*').single()
  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 })
  }

  return NextResponse.json({ success: true, manager: data })
}
