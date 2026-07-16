import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  MAX_CONVITES_PENDENTES_CAMP,
  countConvitesPendentesCamp,
  createNotificacao,
  findManagerByQuery,
  isMissingRelation,
  normalizeChampSellerPerms,
  normalizeValidadeDias,
  requireCampeonatoAdmin,
  sellerLimit,
} from '@backend/campeonatos/manager-champ-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/** Lista convites/pedidos e managers ativos deste campeonato. */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: campeonatoId } = await context.params
    await requireCampeonatoAdmin(campeonatoId, user.id)

    const [{ data: convites, error: convitesError }, { data: vendedores, error: vendError }] = await Promise.all([
      supabaseAdmin
        .from('campeonato_manager_convites')
        .select('*')
        .eq('campeonato_id', campeonatoId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('campeonato_vendedores')
        .select('id,manager_id,status,limite_vagas,permissoes,nome_publico,whatsapp_url,aceito_em,created_at')
        .eq('campeonato_id', campeonatoId)
        .eq('status', 'ativo'),
    ])

    if (isMissingRelation(convitesError)) {
      return NextResponse.json({
        convites: [],
        vendedores: vendedores || [],
        setup_required: true,
        error: 'Rode o SQL de convites de campeonato (campeonato_manager_convites).',
      })
    }
    if (convitesError) throw convitesError
    if (vendError && !isMissingRelation(vendError)) throw vendError

    const managerIds = [
      ...new Set([
        ...(convites || []).map((c: any) => c.manager_id),
        ...(vendedores || []).map((v: any) => v.manager_id),
      ].filter(Boolean)),
    ]

    const { data: managers } = managerIds.length
      ? await supabaseAdmin
          .from('managers')
          .select('id,username,nome,avatar_url,public_id,public_id_prefix,status')
          .in('id', managerIds)
      : { data: [] as any[] }
    const mMap = new Map((managers || []).map((m) => [m.id, m]))

    return NextResponse.json({
      convites: (convites || []).map((c: any) => ({ ...c, manager: mMap.get(c.manager_id) || null })),
      vendedores: (vendedores || []).map((v: any) => ({ ...v, manager: mMap.get(v.manager_id) || null })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar convites.' }, { status: 400 })
  }
}

/** Adm convida manager para este campeonato (correio). */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: campeonatoId } = await context.params
    const { camp, produtora } = await requireCampeonatoAdmin(campeonatoId, user.id)

    const body = await req.json().catch(() => ({}))
    const query = String(body.manager_username || body.q || body.username || '').trim()
    const managerIdInformado = String(body.manager_id || '').trim()
    const mensagem = String(body.mensagem || '').trim().slice(0, 500)
    const validadeDias = normalizeValidadeDias(body.validade_dias)
    const limiteVagas = sellerLimit(body.limite_vagas)
    const perms = normalizeChampSellerPerms(body.permissoes || body)

    let manager: any = null
    if (managerIdInformado) {
      const { data, error } = await supabaseAdmin
        .from('managers')
        .select('id,username,nome,avatar_url,public_id,public_id_prefix,status,auth_user_id,whatsapp_url,nome_publico_vendas')
        .eq('id', managerIdInformado)
        .eq('status', 'ativo')
        .maybeSingle()
      if (error) throw error
      manager = data
    } else {
      manager = await findManagerByQuery(query)
    }
    if (!manager) throw new Error('Manager não encontrado. Use @username ou ID público.')
    if (!manager.auth_user_id) throw new Error('Este manager não tem login vinculado.')
    if (manager.auth_user_id === user.id) {
      throw new Error('Você não pode convidar a si mesmo.')
    }

    const { data: jaAtivo } = await supabaseAdmin
      .from('campeonato_vendedores')
      .select('id')
      .eq('campeonato_id', campeonatoId)
      .eq('manager_id', manager.id)
      .eq('status', 'ativo')
      .maybeSingle()
    if (jaAtivo) throw new Error('Este manager já está liberado neste campeonato.')

    const pendentes = await countConvitesPendentesCamp(campeonatoId, 'convite')
    if (pendentes >= MAX_CONVITES_PENDENTES_CAMP) {
      throw new Error(`Limite de ${MAX_CONVITES_PENDENTES_CAMP} convites pendentes neste campeonato.`)
    }

    const { data: pendenteExistente } = await supabaseAdmin
      .from('campeonato_manager_convites')
      .select('id')
      .eq('campeonato_id', campeonatoId)
      .eq('manager_id', manager.id)
      .eq('tipo', 'convite')
      .eq('status', 'pendente')
      .maybeSingle()
    if (pendenteExistente?.id) {
      throw new Error('Já existe um convite pendente para este manager neste campeonato.')
    }

    const expiraEm = new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000).toISOString()

    const { data: convite, error: conviteError } = await supabaseAdmin
      .from('campeonato_manager_convites')
      .insert({
        campeonato_id: campeonatoId,
        produtora_id: camp.produtora_id || produtora?.id || null,
        manager_id: manager.id,
        tipo: 'convite',
        criado_por_auth_user_id: user.id,
        manager_username: manager.username,
        mensagem: mensagem || null,
        limite_vagas: limiteVagas,
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
      destinatarioAuthUserId: manager.auth_user_id,
      destinatarioProfileType: 'manager',
      destinatarioProfileId: manager.id,
      remetenteAuthUserId: user.id,
      remetenteProfileType: 'produtora',
      remetenteProfileId: camp.produtora_id || produtora?.id || null,
      tipo: 'convite_manager_campeonato',
      titulo: `Convite: ${camp.nome}`,
      corpo: mensagem || `Você foi convidado para operar o campeonato ${camp.nome}.`,
      payload: {
        convite_id: convite.id,
        campeonato_id: camp.id,
        campeonato_nome: camp.nome,
        campeonato_logo_url: camp.logo_url || null,
        produtora_nome: produtora?.nome || null,
        limite_vagas: limiteVagas,
        permissoes: perms,
        expira_em: expiraEm,
        tipo: 'convite',
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

/** Cancela convite pendente (só tipo=convite criado pelo adm). */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: campeonatoId } = await context.params
    await requireCampeonatoAdmin(campeonatoId, user.id)

    const body = await req.json().catch(() => ({}))
    const conviteId = String(body.convite_id || req.nextUrl.searchParams.get('convite_id') || '').trim()
    if (!conviteId) throw new Error('convite_id obrigatório.')

    const { data: convite, error } = await supabaseAdmin
      .from('campeonato_manager_convites')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', conviteId)
      .eq('campeonato_id', campeonatoId)
      .eq('status', 'pendente')
      .select('id,notificacao_id')
      .maybeSingle()
    if (isMissingRelation(error)) throw new Error('Tabelas de convite ainda não existem.')
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
