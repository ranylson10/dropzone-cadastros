import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req), body = await req.json()
    if (!['em_analise', 'resolvida', 'arquivada'].includes(body.status)) throw new Error('Status inválido.')
    const { data, error } = await supabaseAdmin.from('sistema_denuncias').update({ status: body.status, resolucao: String(body.resolucao || '').trim() || null, analisado_por: admin.id, analisado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.id).select('*').single()
    if (error) throw error
    await supabaseAdmin.from('sistema_auditoria').insert({ administrador_auth_user_id: admin.id, acao: `denuncia_${body.status}`, alvo_tipo: 'denuncia', alvo_id: body.id, detalhes: { resolucao: body.resolucao || null } })
    return NextResponse.json({ report: data })
  } catch (error: any) { return NextResponse.json({ error: error?.message || 'Erro ao analisar denúncia.' }, { status: 400 }) }
}
