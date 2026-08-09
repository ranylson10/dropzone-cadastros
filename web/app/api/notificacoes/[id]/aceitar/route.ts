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
import { joinLineupByToken } from '@backend/campeonatos/player-lineup-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { saveTeamPlayer } from '@backend/equipes/player-roster'

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
    if (notif.tipo === 'convite_jogador_equipe_direto' || notif.tipo === 'pedido_jogador_equipe') {
      return await acceptPlayerTeamRelationship(user, accounts, notif)
    }
    if (notif.tipo === 'convite_escalacao_jogador') {
      return await acceptPlayerLineup(user, accounts, notif)
    }

    throw new Error('Esta notificação não aceita resposta de aceite.')
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao aceitar convite.' }, { status: 400 })
  }
}


async function acceptPlayerLineup(user: any, accounts: any[], notif: any) {
  if (notif.status !== 'nao_lida') throw new Error('Esta escalação já foi respondida.')
  const token = String(notif.payload?.token || '').trim()
  if (!token) throw new Error('Token da escalação não encontrado nesta notificação.')

  const result: any = await joinLineupByToken({ token, accounts, body: {} })
  const playerAccount = accounts.find((item) => item.profile_type === 'jogador')
  const player = playerAccount?.data || result?.jogador || null
  const now = new Date().toISOString()
  await supabaseAdmin.from('notificacoes').update({ status: 'lida', read_at: now }).eq('id', notif.id)

  if (notif.remetente_auth_user_id) {
    try {
      await createNotificacao({
        destinatarioAuthUserId: notif.remetente_auth_user_id,
        remetenteAuthUserId: user.id,
        remetenteProfileType: 'jogador',
        remetenteProfileId: player?.id || null,
        tipo: 'escalacao_jogador_resposta',
        titulo: 'Escalação confirmada',
        corpo: `${player?.nome || player?.username || 'Jogador'} confirmou participação em ${notif.payload?.campeonato_nome || 'um campeonato'}.`,
        payload: {
          resposta: 'aceito',
          jogador_id: player?.id || null,
          token,
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
      // resposta é informativa; a confirmação principal já foi persistida em campeonato_jogadores
    }
  }

  return NextResponse.json({
    ok: true,
    mensagem: result?.already_registered ? 'Você já estava confirmado nesta escalação.' : 'Escalação confirmada.',
    inscricao: result?.inscricao || null,
  })
}

async function acceptPlayerTeamRelationship(user: any, accounts: any[], notif: any) {
  if (notif.status !== 'nao_lida') throw new Error('Esta solicitação já foi respondida.')
  const equipeId = String(notif.payload?.equipe_id || '')
  const jogadorId = String(notif.payload?.jogador_id || '')
  if (!equipeId || !jogadorId) throw new Error('Solicitação incompleta.')

  const [{ data: equipe, error: teamError }, { data: jogador, error: playerError }] = await Promise.all([
    supabaseAdmin.from('equipes').select('id,nome,auth_user_id').eq('id', equipeId).maybeSingle(),
    supabaseAdmin.from('jogadores').select('id,nome,avatar_url,id_jogo,funcao,localidade,auth_user_id').eq('id', jogadorId).maybeSingle(),
  ])
  if (teamError) throw teamError
  if (playerError) throw playerError
  if (!equipe || !jogador?.auth_user_id) throw new Error('Equipe ou jogador não encontrado.')

  if (notif.tipo === 'convite_jogador_equipe_direto') {
    if (jogador.auth_user_id !== user.id || !accounts.some((item) => item.profile_type === 'jogador' && item.id === jogador.id)) {
      throw new Error('Este convite não pertence ao seu perfil de jogador.')
    }
  } else if (equipe.auth_user_id !== user.id) {
    throw new Error('Somente o dono da equipe pode aceitar este pedido.')
  }

  await saveTeamPlayer({
    equipe_id: equipe.id,
    jogador_auth_user_id: jogador.auth_user_id,
    nick: jogador.nome,
    foto_url: jogador.avatar_url,
    id_jogo: jogador.id_jogo,
    funcao: jogador.funcao,
    localidade: jogador.localidade,
    origem: notif.tipo === 'pedido_jogador_equipe' ? 'pedido_jogador' : 'convite_direto',
    status: 'ativo',
  })

  await supabaseAdmin.from('notificacoes').update({ status: 'lida', read_at: new Date().toISOString() }).eq('id', notif.id)
  try {
    await createNotificacao({
      destinatarioAuthUserId: notif.remetente_auth_user_id,
      tipo: 'vinculo_jogador_equipe_resposta',
      titulo: 'Solicitação aceita',
      corpo: `${jogador.nome} agora faz parte do elenco de ${equipe.nome}.`,
      payload: { equipe_id: equipe.id, jogador_id: jogador.id, resposta: 'aceito' },
      referenciaTipo: 'equipe_jogador',
      referenciaId: equipe.id,
    })
  } catch {}
  return NextResponse.json({ ok: true, mensagem: `${jogador.nome} agora faz parte do elenco de ${equipe.nome}.` })
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
    comissaoBps: convite.comissao_bps ?? null,
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
    comissaoBps: convite.comissao_bps ?? null,
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
