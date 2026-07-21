import { NextRequest, NextResponse } from 'next/server'
import { blockDebugRouteInProduction } from '@/lib/debug-route'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Diagnóstico interno — somente administradores do sistema.
 * Nunca retorna e-mail/contato para não-admin.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const blocked = blockDebugRouteInProduction()
  if (blocked) return blocked
  try {
    await requireSystemAdmin(req)
    const { id } = await context.params
    const [{ data: byId, error: e1 }, { data: byAuth, error: e2 }] = await Promise.all([
      supabaseAdmin
        .from('managers')
        .select('id,auth_user_id,username,nome,status,created_at,updated_at')
        .eq('id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('managers')
        .select('id,auth_user_id,username,nome,status,created_at,updated_at')
        .eq('auth_user_id', id)
        .maybeSingle(),
    ])
    return NextResponse.json({
      byId,
      byAuth,
      errors: [e1?.message || null, e2?.message || null],
    })
  } catch (error: any) {
    const message = error?.message || 'Acesso negado.'
    const status = /sessao|restrito|administrador/i.test(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
