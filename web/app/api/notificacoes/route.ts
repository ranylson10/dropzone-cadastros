import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { isMissingRelation } from '@backend/equipes/manager-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const onlyUnread = req.nextUrl.searchParams.get('unread') === '1'
    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 30)))

    let query = supabaseAdmin
      .from('notificacoes')
      .select('*')
      .eq('destinatario_auth_user_id', user.id)
      .neq('status', 'arquivada')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (onlyUnread) query = query.eq('status', 'nao_lida')

    const { data, error } = await query
    if (isMissingRelation(error)) {
      return NextResponse.json({ items: [], nao_lidas: 0, setup_required: true })
    }
    if (error) throw error

    const { count, error: countError } = await supabaseAdmin
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_auth_user_id', user.id)
      .eq('status', 'nao_lida')
    if (countError && !isMissingRelation(countError)) throw countError

    return NextResponse.json({
      items: data || [],
      nao_lidas: Number(count || 0),
      setup_required: false,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar notificações.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const id = String(body.id || '').trim()
    const markAll = Boolean(body.mark_all_read)

    if (markAll) {
      const { error } = await supabaseAdmin
        .from('notificacoes')
        .update({ status: 'lida', read_at: new Date().toISOString() })
        .eq('destinatario_auth_user_id', user.id)
        .eq('status', 'nao_lida')
      if (isMissingRelation(error)) return NextResponse.json({ ok: true, setup_required: true })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (!id) throw new Error('id obrigatório.')
    const status = String(body.status || 'lida')
    if (!['lida', 'arquivada', 'nao_lida'].includes(status)) {
      throw new Error('status inválido.')
    }

    const patch: Record<string, unknown> = { status }
    if (status === 'lida') patch.read_at = new Date().toISOString()
    if (status === 'arquivada') patch.archived_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('notificacoes')
      .update(patch)
      .eq('id', id)
      .eq('destinatario_auth_user_id', user.id)
      .select('id,status')
      .maybeSingle()
    if (isMissingRelation(error)) {
      throw new Error('Tabelas de correio ainda não existem.')
    }
    if (error) throw error
    if (!data) throw new Error('Notificação não encontrada.')

    return NextResponse.json({ ok: true, item: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar notificação.' }, { status: 400 })
  }
}
