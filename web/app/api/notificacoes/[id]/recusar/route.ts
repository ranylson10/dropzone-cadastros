import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { createNotificacao, isMissingRelation } from '@backend/equipes/manager-invites'
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

    await supabaseAdmin
      .from('equipe_manager_convites')
      .update({
        status: 'recusado',
        respondido_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', convite.id)

    await supabaseAdmin
      .from('notificacoes')
      .update({ status: 'lida', read_at: new Date().toISOString() })
      .eq('id', notif.id)

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
          titulo: `@${manager.username || manager.name} recusou o convite`,
          corpo: `O manager recusou entrar no staff da equipe ${equipe.nome}.`,
          payload: {
            convite_id: convite.id,
            equipe_id: equipe.id,
            manager_id: manager.id,
            resposta: 'recusado',
          },
          referenciaTipo: 'equipe_manager_convite',
          referenciaId: convite.id,
        })
      } catch {
        // best-effort
      }
    }

    return NextResponse.json({ ok: true, mensagem: 'Convite recusado.' })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao recusar convite.' }, { status: 400 })
  }
}
