import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Diagnóstico interno — somente administradores do sistema.
 * Não deve ser usado pelo cliente final.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const { data, error } = await supabaseAdmin
      .from('managers')
      .select('id,auth_user_id,username,nome,status')
      .limit(20)
    if (error) throw error
    return NextResponse.json({ managers: data })
  } catch (error: any) {
    const message = error?.message || 'Acesso negado.'
    const status = /sessao|restrito|administrador/i.test(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
