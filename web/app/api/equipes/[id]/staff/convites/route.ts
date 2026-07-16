import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  MAX_CONVITES_PENDENTES,
  MAX_MANAGERS_ATIVOS,
  countConvitesPendentes,
  countManagersAtivos,
  createNotificacao,
  findManagerByQuery,
  isMissingRelation,
  normalizePermissoes,
  normalizeValidadeDias,
  requireEquipeOwner,
} from '@backend/equipes/manager-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: equipeId } = await context.params
    const equipe = await requireEquipeOwner(equipeId, user.id)

    const body = await req.json().catch(() => ({}))
    const query = String(body.manager_username || body.q || body.username || '').trim()
    const managerIdInformado = String(body.manager_id || '').trim()
    const mensagem = String(body.mensagem || '').trim().slice(0, 500)
    const validadeDias = normalizeValidadeDias(body.validade_dias)
    const perms = normalizePermissoes(body)

    let manager: any = null
    if (managerIdInformado) {
      const { data, error } = await supabaseAdmin
        .from('managers')
        .select('id,username,nome,avatar_url,public_id,public_id_prefix,status,auth_user_id')
        .eq('id', managerIdInformado)
        .eq('status', 'ativo')
        .maybeSingle()
      if (error) throw error
      manager = data
    } else {
      manager = await findManagerByQuery(query)
    }
    if (!manager) throw new Error('Manager não encontrado. Use @username ou ID público.')

    if (manager.auth_user_id === user.id) {
      throw new Error('Você não pode convidar a si mesmo como manager.')
    }

    const ativos = await countManagersAtivos(equipeId)
    if (ativos >= MAX_MANAGERS_ATIVOS) {
      throw new Error(`Limite de ${MAX_MANAGERS_ATIVOS} managers ativos nesta equipe.`)
    }

    const { data: jaStaff } = await supabaseAdmin
      .from('manager_equipe')
      .select('id')
      .eq('equipe_id', equipeId)
      .eq('manager_id', manager.id)
      .eq('status', 'ativo')
      .maybeSingle()
    if (jaStaff) throw new Error('Este manager já faz parte do staff da equipe.')

    const pendentes = await countConvitesPendentes(equipeId)
    if (pendentes >= MAX_CONVITES_PENDENTES) {
      throw new Error(`Limite de ${MAX_CONVITES_PENDENTES} convites pendentes. Cancele algum antes.`)
    }

    const { data: pendenteExistente } = await supabaseAdmin
      .from('equipe_manager_convites')
      .select('id')
      .eq('equipe_id', equipeId)
      .eq('manager_id', manager.id)
      .eq('status', 'pendente')
      .maybeSingle()
    if (pendenteExistente && !isMissingRelation(null)) {
      // se a query funcionou e há pendente
    }
    if (pendenteExistente?.id) {
      throw new Error('Já existe um convite pendente para este manager.')
    }

    const expiraEm = new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000).toISOString()

    const { data: convite, error: conviteError } = await supabaseAdmin
      .from('equipe_manager_convites')
      .insert({
        equipe_id: equipeId,
        criado_por_auth_user_id: user.id,
        manager_id: manager.id,
        manager_username: manager.username,
        mensagem: mensagem || null,
        pode_ver: perms.pode_ver,
        pode_editar: perms.pode_editar,
        pode_escalar: perms.pode_escalar,
        pode_gerar_token: perms.pode_gerar_token,
        expira_em: expiraEm,
        status: 'pendente',
      })
      .select('*')
      .single()

    if (isMissingRelation(conviteError)) {
      throw new Error(
        'Tabelas de convite ainda não existem. Rode o SQL: Downloads/dropzone_convites_manager_correio.sql',
      )
    }
    if (conviteError) throw conviteError

    const notif = await createNotificacao({
      destinatarioAuthUserId: manager.auth_user_id,
      destinatarioProfileType: 'manager',
      destinatarioProfileId: manager.id,
      remetenteAuthUserId: user.id,
      remetenteProfileType: 'equipe',
      remetenteProfileId: equipe.id,
      tipo: 'convite_manager_equipe',
      titulo: `Convite de staff: ${equipe.nome}`,
      corpo:
        mensagem
        || `A equipe ${equipe.nome} convidou você para ser manager/staff.`,
      payload: {
        convite_id: convite.id,
        equipe_id: equipe.id,
        equipe_nome: equipe.nome,
        equipe_logo_url: equipe.logo_url || null,
        permissoes: perms,
        expira_em: expiraEm,
      },
      referenciaTipo: 'equipe_manager_convite',
      referenciaId: convite.id,
    })

    await supabaseAdmin
      .from('equipe_manager_convites')
      .update({ notificacao_id: notif.id, updated_at: new Date().toISOString() })
      .eq('id', convite.id)

    return NextResponse.json({
      ok: true,
      convite: { ...convite, notificacao_id: notif.id },
      manager: {
        id: manager.id,
        username: manager.username,
        nome: manager.nome,
        avatar_url: manager.avatar_url,
      },
      mensagem: `Convite enviado para @${manager.username}.`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar convite.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: equipeId } = await context.params
    await requireEquipeOwner(equipeId, user.id)

    const body = await req.json().catch(() => ({}))
    const conviteId = String(body.convite_id || req.nextUrl.searchParams.get('convite_id') || '').trim()
    if (!conviteId) throw new Error('convite_id obrigatório.')

    const { data: convite, error } = await supabaseAdmin
      .from('equipe_manager_convites')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', conviteId)
      .eq('equipe_id', equipeId)
      .eq('status', 'pendente')
      .select('id,notificacao_id')
      .maybeSingle()
    if (isMissingRelation(error)) {
      throw new Error('Tabelas de convite ainda não existem.')
    }
    if (error) throw error
    if (!convite) throw new Error('Convite pendente não encontrado.')

    if (convite.notificacao_id) {
      await supabaseAdmin
        .from('notificacoes')
        .update({ status: 'arquivada', archived_at: new Date().toISOString() })
        .eq('id', convite.notificacao_id)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao cancelar convite.' }, { status: 400 })
  }
}
