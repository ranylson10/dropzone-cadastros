import { NextRequest, NextResponse } from 'next/server'
import { blockDebugRouteInProduction } from '@/lib/debug-route'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Diagnóstico interno — somente administradores do sistema.
 * Tokens brutos de convite nunca devem ser públicos.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  const blocked = blockDebugRouteInProduction()
  if (blocked) return blocked
  try {
    await requireSystemAdmin(req)
    const { managerId } = await context.params
    const [byManagerId, byManagerAuthUserId, allInvites] = await Promise.all([
      supabaseAdmin
        .from('tokens')
        .select(
          'id,tipo,produtora_id,campeonato_id,manager_id,status,usado,expira_em,created_at,manager_limite_vagas,manager_permissoes,slot_id',
        )
        .eq('tipo', 'manager_invite')
        .eq('manager_id', managerId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('tokens')
        .select(
          'id,tipo,produtora_id,campeonato_id,manager_id,status,usado,expira_em,created_at,manager_limite_vagas,manager_permissoes,slot_id',
        )
        .eq('tipo', 'manager_invite')
        .eq('manager_auth_user_id', managerId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('tokens')
        .select(
          'id,tipo,produtora_id,campeonato_id,manager_id,status,usado,expira_em,created_at,manager_limite_vagas,manager_permissoes,slot_id',
        )
        .eq('tipo', 'manager_invite')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    return NextResponse.json({ byManagerId, byManagerAuthUserId, allInvites })
  } catch (error: any) {
    const message = error?.message || 'Acesso negado.'
    const status = /sessao|restrito|administrador/i.test(message) ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
