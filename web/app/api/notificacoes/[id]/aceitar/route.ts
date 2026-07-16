import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import {
  MAX_MANAGERS_ATIVOS,
  countManagersAtivos,
  createNotificacao,
  isMissingRelation,
} from '@backend/equipes/manager-invites'
import {
  activateSellerOnChampionship,
  normalizeChampSellerPerms,
  requireCampeonatoAdmin,
  sellerLimit,
} from '@backend/campeonatos/manager-champ-invites'
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

    // —— Staff de equipe ——
    if (notif.tipo === 'convite_manager_equipe') {
      return await acceptEquipeInvite(user, accounts, notif)
    }

    // —— Adm convida manager pro campeonato ——
    if (notif.tipo === 'convite_manager_campeonato') {
      return await acceptChampInviteAsManager(user, accounts, notif)
    }

    // —— Manager pediu acesso; adm aceita ——
    if (notif.tipo === 'pedido_manager_campeonato') {
      return await acceptChampPedidoAsAdmin(user, notif)
    }

    throw new Error('Esta notificação não aceita resposta de aceite.')
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao aceitar convite.' }, { status: 400 })
  }
}

async function acceptEquipeInvite(user: any, accounts: any[], notif: any) {
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
}

async function acceptChampInviteAsManager(user: any, accounts: any[], notif: any) {
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
  if (convite.tipo !== 'convite') throw new Error('Tipo de convite inválido.')
  if (convite.manager_id !== manager.id) throw new Error('Este convite não é para o seu perfil.')
  if (convite.status !== 'pendente') throw new Error(`Convite já está ${convite.status}.`)
  if (new Date(convite.expira_em).getTime() <= Date.now()) {
    await supabaseAdmin
      .from('campeonato_manager_convites')
      .update({ status: 'expirado', updated_at: new Date().toISOString() })
      .eq('id', convite.id)
    throw new Error('Este convite expirou.')
  }

  const { data: managerRow } = await supabaseAdmin
    .from('managers')
    .select('id,nome,username,auth_user_id,whatsapp_url,nome_publico_vendas')
    .eq('id', manager.id)
    .maybeSingle()

  await activateSellerOnChampionship({
    campeonatoId: convite.campeonato_id,
    produtoraId: convite.produtora_id,
    managerId: manager.id,
    managerAuthUserId: managerRow?.auth_user_id || user.id,
    nomePublico: managerRow?.nome_publico_vendas || managerRow?.nome || managerRow?.username || manager.name,
    whatsappUrl: managerRow?.whatsapp_url || null,
    limiteVagas: sellerLimit(convite.limite_vagas),
    permissoes: normalizeChampSellerPerms(convite.permissoes),
    criadoPor: convite.criado_por_auth_user_id,
  })

  await supabaseAdmin
    .from('campeonato_manager_convites')
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

  const { data: camp } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,produtora_id,criado_por')
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
        titulo: `@${manager.username || manager.name} aceitou o campeonato`,
        corpo: `O manager aceitou operar ${camp?.nome || 'o campeonato'}.`,
        payload: {
          convite_id: convite.id,
          campeonato_id: convite.campeonato_id,
          manager_id: manager.id,
          resposta: 'aceito',
          tipo: 'convite',
        },
        referenciaTipo: 'campeonato_manager_convite',
        referenciaId: convite.id,
      })
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({
    ok: true,
    mensagem: 'Convite aceito. O campeonato aparece no seu painel de manager.',
    campeonato_id: convite.campeonato_id,
  })
}

async function acceptChampPedidoAsAdmin(user: any, notif: any) {
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
  if (convite.tipo !== 'pedido') throw new Error('Tipo de pedido inválido.')
  if (convite.status !== 'pendente') throw new Error(`Pedido já está ${convite.status}.`)
  if (new Date(convite.expira_em).getTime() <= Date.now()) {
    await supabaseAdmin
      .from('campeonato_manager_convites')
      .update({ status: 'expirado', updated_at: new Date().toISOString() })
      .eq('id', convite.id)
    throw new Error('Este pedido expirou.')
  }

  // Confirma que o usuário é admin do campeonato
  await requireCampeonatoAdmin(convite.campeonato_id, user.id)

  const { data: managerRow } = await supabaseAdmin
    .from('managers')
    .select('id,nome,username,auth_user_id,whatsapp_url,nome_publico_vendas')
    .eq('id', convite.manager_id)
    .maybeSingle()
  if (!managerRow) throw new Error('Manager do pedido não encontrado.')

  // Admin pode ter ajustado permissões no payload da notificação? Usamos o que está no convite.
  // Defaults se pedido não tinha flags especiais.
  await activateSellerOnChampionship({
    campeonatoId: convite.campeonato_id,
    produtoraId: convite.produtora_id,
    managerId: managerRow.id,
    managerAuthUserId: managerRow.auth_user_id,
    nomePublico: managerRow.nome_publico_vendas || managerRow.nome || managerRow.username,
    whatsappUrl: managerRow.whatsapp_url || null,
    limiteVagas: sellerLimit(convite.limite_vagas),
    permissoes: normalizeChampSellerPerms(convite.permissoes),
    criadoPor: user.id,
  })

  await supabaseAdmin
    .from('campeonato_manager_convites')
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

  if (managerRow.auth_user_id) {
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
        titulo: `Pedido aceito: ${camp?.nome || 'campeonato'}`,
        corpo: `Seu pedido para operar ${camp?.nome || 'o campeonato'} foi aceito.`,
        payload: {
          convite_id: convite.id,
          campeonato_id: convite.campeonato_id,
          manager_id: managerRow.id,
          resposta: 'aceito',
          tipo: 'pedido',
        },
        referenciaTipo: 'campeonato_manager_convite',
        referenciaId: convite.id,
      })
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({
    ok: true,
    mensagem: 'Pedido aceito. Manager liberado neste campeonato.',
    campeonato_id: convite.campeonato_id,
    manager_id: convite.manager_id,
  })
}
