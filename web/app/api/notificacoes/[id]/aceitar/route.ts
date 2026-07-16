import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import {
  MAX_MANAGERS_ATIVOS,
  countManagersAtivos,
  createNotificacao,
  isMissingRelation,
} from '@backend/equipes/manager-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const manager = accounts.find((a) => a.profile_type === 'manager')
    if (!manager) throw new Error('Este login não possui perfil de manager.')

    const { id: notifId } = await context.params

    const { data: notif, error: notifError } = await supabaseAdmin
      .from('notificacoes')
      .select('*')
      .eq('id', notifId)
      .eq('destinatario_auth_user_id', user.id)
      .maybeSingle()
    if (isMissingRelation(notifError)) {
      throw new Error('Tabelas de correio ainda não existem. Rode o SQL da pasta Downloads.')
    }
    if (notifError) throw notifError
    if (!notif) throw new Error('Notificação não encontrada.')
    if (notif.tipo !== 'convite_manager_equipe') {
      throw new Error('Esta notificação não é um convite de staff.')
    }

    const conviteId = String(notif.referencia_id || notif.payload?.convite_id || '').trim()
    if (!conviteId) throw new Error('Convite inválido nesta notificação.')

    const { data: convite, error: conviteError } = await supabaseAdmin
      .from('equipe_manager_convites')
      .select('*')
      .eq('id', conviteId)
      .maybeSingle()
    if (conviteError) throw conviteError
    if (!convite) throw new Error('Convite não encontrado.')
    if (convite.manager_id !== manager.id) throw new Error('Este convite não é para o seu perfil.')
    if (convite.status !== 'pendente') throw new Error(`Convite já está ${convite.status}.`)
    if (new Date(convite.expira_em).getTime() <= Date.now()) {
      await supabaseAdmin
        .from('equipe_manager_convites')
        .update({ status: 'expirado', updated_at: new Date().toISOString() })
        .eq('id', convite.id)
      throw new Error('Este convite expirou.')
    }

    const ativos = await countManagersAtivos(convite.equipe_id)
    if (ativos >= MAX_MANAGERS_ATIVOS) {
      throw new Error(`A equipe já atingiu o limite de ${MAX_MANAGERS_ATIVOS} managers.`)
    }

    // Upsert vínculo
    const { data: existing } = await supabaseAdmin
      .from('manager_equipe')
      .select('id,status')
      .eq('equipe_id', convite.equipe_id)
      .eq('manager_id', manager.id)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from('manager_equipe')
        .update({
          status: 'ativo',
          pode_ver: convite.pode_ver,
          pode_editar: convite.pode_editar,
          pode_escalar: convite.pode_escalar,
          pode_gerar_token: convite.pode_gerar_token,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin.from('manager_equipe').insert({
        equipe_id: convite.equipe_id,
        manager_id: manager.id,
        pode_ver: convite.pode_ver,
        pode_editar: convite.pode_editar,
        pode_escalar: convite.pode_escalar,
        pode_gerar_token: convite.pode_gerar_token,
        status: 'ativo',
      })
      if (error) throw error
    }

    await supabaseAdmin
      .from('equipe_manager_convites')
      .update({
        status: 'aceito',
        respondido_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', convite.id)

    await supabaseAdmin
      .from('notificacoes')
      .update({ status: 'lida', read_at: new Date().toISOString() })
      .eq('id', notif.id)

    // Notifica dono da equipe
    const { data: equipe } = await supabaseAdmin
      .from('equipes')
      .select('id,nome,auth_user_id')
      .eq('id', convite.equipe_id)
      .maybeSingle()

    if (equipe?.auth_user_id) {
      try {
        await createNotificacao({
          destinatarioAuthUserId: equipe.auth_user_id,
          destinatarioProfileType: 'equipe',
          destinatarioProfileId: equipe.id,
          remetenteAuthUserId: user.id,
          remetenteProfileType: 'manager',
          remetenteProfileId: manager.id,
          tipo: 'convite_manager_resposta',
          titulo: `@${manager.username || manager.name} aceitou o convite`,
          corpo: `O manager entrou no staff da equipe ${equipe.nome}.`,
          payload: {
            convite_id: convite.id,
            equipe_id: equipe.id,
            manager_id: manager.id,
            resposta: 'aceito',
          },
          referenciaTipo: 'equipe_manager_convite',
          referenciaId: convite.id,
        })
      } catch {
        // best-effort
      }
    }

    return NextResponse.json({
      ok: true,
      mensagem: 'Convite aceito. Você agora faz parte do staff da equipe.',
      equipe_id: convite.equipe_id,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao aceitar convite.' }, { status: 400 })
  }
}
