import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import {
  MAX_PEDIDOS_PENDENTES_MANAGER,
  countPedidosPendentesManager,
  createNotificacao,
  getCampeonatoAdminAuthUserId,
  isMissingRelation,
  normalizeChampSellerPerms,
  normalizeValidadeDias,
} from '@backend/campeonatos/manager-champ-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/** Manager pede acesso a um campeonato (adm recebe no correio). */
export async function POST(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const { managerId } = await context.params
    const manager = accounts.find((a) => a.profile_type === 'manager' && a.id === managerId)
    if (!manager) throw new Error('Sem permissão neste perfil de manager.')

    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonato_id || '').trim()
    const mensagem = String(body.mensagem || '').trim().slice(0, 500)
    const validadeDias = normalizeValidadeDias(body.validade_dias ?? 7)
    if (!campeonatoId) throw new Error('campeonato_id obrigatório.')

    const { authUserId: adminAuth, camp, produtora } = await getCampeonatoAdminAuthUserId(campeonatoId)
    if (!adminAuth) throw new Error('Campeonato sem admin configurado.')
    if (adminAuth === user.id) throw new Error('Você já é admin deste campeonato.')

    const { data: jaAtivo } = await supabaseAdmin
      .from('campeonato_vendedores')
      .select('id')
      .eq('campeonato_id', campeonatoId)
      .eq('manager_id', manager.id)
      .eq('status', 'ativo')
      .maybeSingle()
    if (jaAtivo) throw new Error('Você já está liberado neste campeonato.')

    const pendentes = await countPedidosPendentesManager(manager.id)
    if (pendentes >= MAX_PEDIDOS_PENDENTES_MANAGER) {
      throw new Error(`Limite de ${MAX_PEDIDOS_PENDENTES_MANAGER} pedidos pendentes. Aguarde respostas.`)
    }

    const { data: pendenteExistente } = await supabaseAdmin
      .from('campeonato_manager_convites')
      .select('id')
      .eq('campeonato_id', campeonatoId)
      .eq('manager_id', manager.id)
      .eq('tipo', 'pedido')
      .eq('status', 'pendente')
      .maybeSingle()
    if (pendenteExistente?.id) {
      throw new Error('Você já tem um pedido pendente neste campeonato.')
    }

    // também bloqueia se já tem convite pendente do adm
    const { data: convitePendente } = await supabaseAdmin
      .from('campeonato_manager_convites')
      .select('id')
      .eq('campeonato_id', campeonatoId)
      .eq('manager_id', manager.id)
      .eq('tipo', 'convite')
      .eq('status', 'pendente')
      .maybeSingle()
    if (convitePendente?.id) {
      throw new Error('Já existe um convite pendente deste campeonato. Confira o correio.')
    }

    const expiraEm = new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000).toISOString()
    // Pedido: permissões default; adm pode ajustar no aceite (usamos defaults no aceite)
    const perms = normalizeChampSellerPerms({})

    const { data: convite, error: conviteError } = await supabaseAdmin
      .from('campeonato_manager_convites')
      .insert({
        campeonato_id: campeonatoId,
        produtora_id: camp.produtora_id || produtora?.id || null,
        manager_id: manager.id,
        tipo: 'pedido',
        criado_por_auth_user_id: user.id,
        manager_username: manager.username,
        mensagem: mensagem || null,
        limite_vagas: 0,
        permissoes: perms,
        expira_em: expiraEm,
        status: 'pendente',
      })
      .select('*')
      .single()

    if (isMissingRelation(conviteError)) {
      throw new Error(
        'Tabelas de convite de campeonato ainda não existem. Rode o SQL: dropzone_campeonato_manager_convites.sql',
      )
    }
    if (conviteError) throw conviteError

    const notif = await createNotificacao({
      destinatarioAuthUserId: adminAuth,
      destinatarioProfileType: 'produtora',
      destinatarioProfileId: camp.produtora_id || produtora?.id || null,
      remetenteAuthUserId: user.id,
      remetenteProfileType: 'manager',
      remetenteProfileId: manager.id,
      tipo: 'pedido_manager_campeonato',
      titulo: `Pedido de acesso: ${camp.nome}`,
      corpo:
        mensagem
        || `@${manager.username || manager.name} pediu para operar o campeonato ${camp.nome}.`,
      payload: {
        convite_id: convite.id,
        campeonato_id: camp.id,
        campeonato_nome: camp.nome,
        campeonato_logo_url: camp.logo_url || null,
        manager_id: manager.id,
        manager_username: manager.username,
        manager_nome: manager.name,
        permissoes: perms,
        expira_em: expiraEm,
        tipo: 'pedido',
      },
      referenciaTipo: 'campeonato_manager_convite',
      referenciaId: convite.id,
    })

    await supabaseAdmin
      .from('campeonato_manager_convites')
      .update({ notificacao_id: notif.id, updated_at: new Date().toISOString() })
      .eq('id', convite.id)

    return NextResponse.json({
      ok: true,
      pedido: { ...convite, notificacao_id: notif.id },
      mensagem: `Pedido enviado para o admin de ${camp.nome}.`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao enviar pedido.' }, { status: 400 })
  }
}
