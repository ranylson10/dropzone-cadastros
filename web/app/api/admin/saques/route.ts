import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const status = req.nextUrl.searchParams.get('status') || 'solicitado'
    const { data, error } = await supabaseAdmin
      .from('sistema_saques')
      .select('*, sistema_carteiras(dono_tipo,dono_id,auth_user_id)')
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(100)
    if (error) throw error
    return NextResponse.json({ saques: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 403 })
  }
}

/**
 * PATCH: aprovar/pagar/rejeitar saque.
 * rejeitado → devolve saldo à carteira
 * pago → só marca (débito já foi na solicitação)
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req)
    const body = await req.json()
    const id = String(body.id || '').trim()
    const status = String(body.status || '').trim()
    if (!id) throw new Error('id obrigatório')
    if (!['em_analise', 'aprovado', 'pago', 'rejeitado'].includes(status)) {
      throw new Error('status inválido')
    }

    const { data: updated, error } = await supabaseAdmin.rpc('fn_atualizar_status_saque', {
      p_saque_id: id,
      p_novo_status: status,
      p_admin_auth_user_id: admin.id,
      p_motivo: String(body.motivo || '').trim() || null,
    })
    if (error) throw error

    await supabaseAdmin.from('sistema_auditoria').insert({
      administrador_auth_user_id: admin.id,
      acao: `saque_${status}`,
      alvo_tipo: 'saque',
      alvo_id: id,
      detalhes: { valor_centavos: updated.valor_centavos, motivo: body.motivo || null },
    })

    return NextResponse.json({ saque: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
