import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { createNotificacao, isMissingRelation } from '@backend/equipes/manager-invites'
import { requireCampeonatoAdmin } from '@backend/campeonatos/manager-champ-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
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

    if (notif.tipo === 'convite_manager_equipe') {
      return await refuseEquipe(user, accounts, notif)
    }
    if (notif.tipo === 'convite_manager_campeonato') {
      return await refuseChampInvite(user, accounts, notif)
    }
    if (notif.tipo === 'pedido_manager_campeonato') {
      return await refuseChampPedido(user, notif)
    }
    if (notif.tipo === 'convite_jogador_equipe_direto' || notif.tipo === 'pedido_jogador_equipe') {
      return await refusePlayerTeamRelationship(user, accounts, notif)
    }
    if (notif.tipo === 'convite_escalacao_jogador') {
      return await refusePlayerLineup(user, accounts, notif)
    }

    throw new Error('Esta notificação não aceita recusa.')
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao recusar convite.' }, { status: 400 })
  }
}


async function refusePlayerLineup(user: any, accounts: any[], notif: any) {
  if (notif.status !== 'nao_lida') throw new Error('Esta escalação já foi respondida.')
  const playerAccount = accounts.find((item) => item.profile_type === 'jogador')
  const player = playerAccount?.data || null
  if (!player) throw new Error('Este login não possui perfil de jogador.')

  await supabaseAdmin
    .from('notificacoes')
    .update({ status: 'lida', read_at: new Date().toISOString() })
    .eq('id', notif.id)

  if (notif.remetente_auth_user_id) {
    try {
      await createNotificacao({
        destinatarioAuthUserId: notif.remetente_auth_user_id,
        remetenteAuthUserId: user.id,
        remetenteProfileType: 'jogador',
        remetenteProfileId: player.id || null,
        tipo: 'escalacao_jogador_resposta',
        titulo: 'Escalação recusada',
        corpo: `${player.nome || player.username || 'Jogador'} recusou a escalação de ${notif.payload?.campeonato_nome || 'um campeonato'}.`,
        payload: {
          resposta: 'recusado',
          jogador_id: player.id || null,
          token: notif.payload?.token || null,
          link_id: notif.payload?.link_id || null,
          campeonato_id: notif.payload?.campeonato_id || null,
          campeonato_equipe_id: notif.payload?.campeonato_equipe_id || null,
          equipe_id: notif.payload?.equipe_id || null,
          line_id: notif.payload?.line_id || null,
        },
        referenciaTipo: 'campeonato_link_escalacao',
        referenciaId: notif.referencia_id || notif.payload?.link_id || null,
      })
    } catch {
      // resposta é informativa; a recusa já foi registrada no correio do jogador
    }
  }

  return NextResponse.json({ ok: true, mensagem: 'Escalação recusada.' })
}

async function refusePlayerTeamRelationship(user: any, accounts: any[], notif: any) {
  if (notif.status !== 'nao_lida') throw new Error('Esta solicitação já foi respondida.')
  const equipeId = String(notif.payload?.equipe_id || '')
  const jogadorId = String(notif.payload?.jogador_id || '')
  const [{ data: equipe }, { data: jogador }] = await Promise.all([
    supabaseAdmin.from('equipes').select('id,nome,auth_user_id').eq('id', equipeId).maybeSingle(),
    supabaseAdmin.from('jogadores').select('id,nome,auth_user_id').eq('id', jogadorId).maybeSingle(),
  ])
  if (notif.tipo === 'convite_jogador_equipe_direto') {
    if (jogador?.auth_user_id !== user.id || !accounts.some((item) => item.profile_type === 'jogador' && item.id === jogadorId)) throw new Error('Este convite não pertence ao seu perfil.')
  } else if (equipe?.auth_user_id !== user.id) throw new Error('Somente o dono da equipe pode recusar este pedido.')

  await supabaseAdmin.from('notificacoes').update({ status: 'lida', read_at: new Date().toISOString() }).eq('id', notif.id)
  try {
    await createNotificacao({
      destinatarioAuthUserId: notif.remetente_auth_user_id,
      tipo: 'vinculo_jogador_equipe_resposta',
      titulo: 'Solicitação recusada',
      corpo: `${jogador?.nome || 'O jogador'} e ${equipe?.nome || 'a equipe'} não foram vinculados.`,
      payload: { equipe_id: equipeId, jogador_id: jogadorId, resposta: 'recusado' },
      referenciaTipo: 'equipe_jogador',
      referenciaId: equipeId,
    })
  } catch {}
  return NextResponse.json({ ok: true, mensagem: 'Solicitação recusada.' })
}

async function refuseEquipe(user: any, accounts: any[], notif: any) {
  const manager = accounts.find((a) => a.profile_type === 'manager')
  if (!manager) throw new Error('Este login não possui perfil de manager.')

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
}

async function refuseChampInvite(user: any, accounts: any[], notif: any) {
  const manager = accounts.find((a) => a.profile_type === 'manager')
  if (!manager) throw new Error('Este login não possui perfil de manager.')

  const conviteId = String(notif.referencia_id || notif.payload?.convite_id || '').trim()
  if (!conviteId) throw new Error('Convite inválido nesta notificação.')

  const { data: convite, error } = await supabaseAdmin
    .from('campeonato_manager_convites')
    .select('*')
    .eq('id', conviteId)
    .maybeSingle()
  if (isMissingRelation(error)) throw new Error('Tabelas de convite de campeonato ainda não existem.')
  if (error) throw error
  if (!convite) throw new Error('Convite não encontrado.')
  if (convite.tipo !== 'convite') throw new Error('Tipo inválido.')
  if (convite.manager_id !== manager.id) throw new Error('Este convite não é para o seu perfil.')
  if (convite.status !== 'pendente') throw new Error(`Convite já está ${convite.status}.`)

  await supabaseAdmin
    .from('campeonato_manager_convites')
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

  const { data: camp } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,produtora_id')
    .eq('id', convite.campeonato_id)
    .maybeSingle()

  let adminAuth = convite.criado_por_auth_user_id
  if (camp?.produtora_id) {
    const { data: pr } = await supabaseAdmin
      .from('produtoras')
      .select('auth_user_id')
      .eq('id', camp.produtora_id)
      .maybeSingle()
    if (pr?.auth_user_id) adminAuth = pr.auth_user_id
  }

  if (adminAuth) {
    try {
      await createNotificacao({
        destinatarioAuthUserId: adminAuth,
        destinatarioProfileType: 'produtora',
        destinatarioProfileId: camp?.produtora_id || null,
        remetenteAuthUserId: user.id,
        remetenteProfileType: 'manager',
        remetenteProfileId: manager.id,
        tipo: 'convite_manager_resposta',
        titulo: `@${manager.username || manager.name} recusou o campeonato`,
        corpo: `O manager recusou operar ${camp?.nome || 'o campeonato'}.`,
        payload: {
          convite_id: convite.id,
          campeonato_id: convite.campeonato_id,
          manager_id: manager.id,
          resposta: 'recusado',
          tipo: 'convite',
        },
        referenciaTipo: 'campeonato_manager_convite',
        referenciaId: convite.id,
      })
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ ok: true, mensagem: 'Convite recusado.' })
}

async function refuseChampPedido(user: any, notif: any) {
  const conviteId = String(notif.referencia_id || notif.payload?.convite_id || '').trim()
  if (!conviteId) throw new Error('Pedido inválido nesta notificação.')

  const { data: convite, error } = await supabaseAdmin
    .from('campeonato_manager_convites')
    .select('*')
    .eq('id', conviteId)
    .maybeSingle()
  if (isMissingRelation(error)) throw new Error('Tabelas de convite de campeonato ainda não existem.')
  if (error) throw error
  if (!convite) throw new Error('Pedido não encontrado.')
  if (convite.tipo !== 'pedido') throw new Error('Tipo inválido.')
  if (convite.status !== 'pendente') throw new Error(`Pedido já está ${convite.status}.`)

  await requireCampeonatoAdmin(convite.campeonato_id, user.id)

  await supabaseAdmin
    .from('campeonato_manager_convites')
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

  const { data: managerRow } = await supabaseAdmin
    .from('managers')
    .select('id,username,auth_user_id')
    .eq('id', convite.manager_id)
    .maybeSingle()

  if (managerRow?.auth_user_id) {
    try {
      const { data: camp } = await supabaseAdmin
        .from('campeonatos')
        .select('nome')
        .eq('id', convite.campeonato_id)
        .maybeSingle()
      await createNotificacao({
        destinatarioAuthUserId: managerRow.auth_user_id,
        destinatarioProfileType: 'manager',
        destinatarioProfileId: managerRow.id,
        remetenteAuthUserId: user.id,
        remetenteProfileType: 'produtora',
        remetenteProfileId: convite.produtora_id,
        tipo: 'convite_manager_resposta',
        titulo: `Pedido recusado: ${camp?.nome || 'campeonato'}`,
        corpo: `Seu pedido para operar ${camp?.nome || 'o campeonato'} foi recusado.`,
        payload: {
          convite_id: convite.id,
          campeonato_id: convite.campeonato_id,
          manager_id: managerRow.id,
          resposta: 'recusado',
          tipo: 'pedido',
        },
        referenciaTipo: 'campeonato_manager_convite',
        referenciaId: convite.id,
      })
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ ok: true, mensagem: 'Pedido recusado.' })
}
