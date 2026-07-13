import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

const TABLES: Record<string, string> = { produtora: 'produtoras', equipe: 'equipes', jogador: 'jogadores', manager: 'managers', campeonato: 'campeonatos' }

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req)
    const body = await req.json()
    const action = String(body.action || ''), targetType = String(body.target_type || ''), targetId = String(body.target_id || ''), reason = String(body.reason || '').trim()
    const table = TABLES[targetType]
    if (!table || !targetId) throw new Error('Alvo inválido.')
    if (!['suspender', 'banir', 'restaurar'].includes(action)) throw new Error('Ação inválida.')
    if (action !== 'restaurar' && reason.length < 5) throw new Error('Informe o motivo da moderação.')
    const selectFields = targetType === 'campeonato' ? 'id,nome' : 'id,nome,auth_user_id'
    const { data: target, error: readError } = await supabaseAdmin.from(table).select(selectFields).eq('id', targetId).maybeSingle()
    if (readError) throw readError
    if (!target) throw new Error('Cadastro não encontrado.')
    const status = action === 'restaurar' ? 'ativo' : action === 'banir' ? 'banido' : 'suspenso'
    const { error: updateError } = await supabaseAdmin.from(table).update({ status, updated_at: new Date().toISOString() }).eq('id', targetId)
    if (updateError) throw updateError
    const authUserId = (target as any).auth_user_id
    if (authUserId) {
      if (action === 'restaurar') {
        await supabaseAdmin.from('sistema_restricoes_conta').update({ ativo: false, updated_at: new Date().toISOString() }).eq('auth_user_id', authUserId)
        await supabaseAdmin.auth.admin.updateUserById(authUserId, { ban_duration: 'none' })
      } else {
        const expiresAt = action === 'suspender' && body.days ? new Date(Date.now() + Number(body.days) * 86400000).toISOString() : null
        const { error } = await supabaseAdmin.from('sistema_restricoes_conta').upsert({ auth_user_id: authUserId, tipo: action === 'banir' ? 'banimento' : 'suspensao', motivo: reason, expira_em: expiresAt, ativo: true, aplicado_por: admin.id, updated_at: new Date().toISOString() }, { onConflict: 'auth_user_id' })
        if (error) throw error
        const duration = action === 'banir' ? '876000h' : `${Math.max(1, Number(body.days || 7) * 24)}h`
        await supabaseAdmin.auth.admin.updateUserById(authUserId, { ban_duration: duration })
      }
    }
    await supabaseAdmin.from('sistema_auditoria').insert({ administrador_auth_user_id: admin.id, acao: action, alvo_tipo: targetType, alvo_id: targetId, detalhes: { motivo: reason, dias: body.days || null } })
    return NextResponse.json({ success: true, status })
  } catch (error: any) { return NextResponse.json({ error: error?.message || 'Erro na moderação.' }, { status: 400 }) }
}
