import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function resolveManager(managerId: string) {
  const normalized = String(managerId || '').trim()
  if (!isUuid(normalized)) return null
  const { data: manager, error: managerError } = await supabaseAdmin
    .from('managers')
    .select('id,nome,username,avatar_url,status,auth_user_id,whatsapp_url,nome_publico_vendas,portfolio_anuncios')
    .eq('id', normalized)
    .maybeSingle()
  if (managerError && (managerError.code === 'PGRST204' || /column/i.test(managerError.message || ''))) {
    const fallback = await supabaseAdmin
      .from('managers')
      .select('id,nome,username,avatar_url,status,auth_user_id')
      .eq('id', normalized)
      .maybeSingle()
    if (fallback.error) throw fallback.error
    return fallback.data ? { ...fallback.data, whatsapp_url: null, nome_publico_vendas: null, portfolio_anuncios: [] } : null
  }
  if (managerError) throw managerError
  return manager
}

export async function GET(_req: Request, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    const manager = await resolveManager(managerId)
    if (!manager || ['suspenso', 'banido', 'excluido'].includes(String(manager.status || 'ativo'))) {
      throw new Error('Vendedor não encontrado.')
    }

    // Fonte principal: vínculos de campeonato
    const { data: vinculos, error: vinculosError } = await supabaseAdmin
      .from('campeonato_vendedores')
      .select('id,campeonato_id,produtora_id,manager_id,status,limite_vagas,permissoes,whatsapp_url,nome_publico,created_at')
      .eq('manager_id', manager.id)
      .order('created_at', { ascending: false })
    if (vinculosError && !missingRelation(vinculosError)) throw vinculosError

    let rows = vinculos || []

    // Fallback legado: tokens manager_invite
    if (!rows.length) {
      const { data: tokens, error: tokensError } = await supabaseAdmin
        .from('tokens')
        .select('id,campeonato_id,produtora_id,manager_id,status,created_at')
        .eq('tipo', 'manager_invite')
        .eq('manager_id', manager.id)
        .not('campeonato_id', 'is', null)
        .order('created_at', { ascending: false })
      if (tokensError) throw tokensError
      rows = (tokens || []).map((t) => ({
        id: t.id,
        campeonato_id: t.campeonato_id,
        produtora_id: t.produtora_id,
        manager_id: t.manager_id,
        status: t.status,
        limite_vagas: 0,
        permissoes: {},
        whatsapp_url: manager.whatsapp_url,
        nome_publico: manager.nome_publico_vendas || manager.nome,
        created_at: t.created_at,
      }))
    }

    const campeonatoIds = Array.from(new Set(rows.map((item) => item.campeonato_id).filter(Boolean)))
    const produtoraIds = Array.from(new Set(rows.map((item) => item.produtora_id).filter(Boolean)))
    const portfolio = Array.isArray(manager.portfolio_anuncios) ? manager.portfolio_anuncios.map(String) : []

    const authUserId = manager.auth_user_id || null
    const [{ data: campeonatos }, { data: produtoras }, { data: usages }] = await Promise.all([
      campeonatoIds.length
        ? supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status,banner_url').in('id', campeonatoIds)
        : Promise.resolve({ data: [] as any[] }),
      produtoraIds.length
        ? supabaseAdmin.from('produtoras').select('id,nome,logo_url').in('id', produtoraIds)
        : Promise.resolve({ data: [] as any[] }),
      campeonatoIds.length && authUserId
        ? supabaseAdmin
            .from('campeonato_equipes')
            .select('id,campeonato_id,criado_por,origem_entrada,status')
            .in('campeonato_id', campeonatoIds)
            .eq('criado_por', authUserId)
            .eq('status', 'ativo')
            .in('origem_entrada', ['vendedor', 'convite', 'inscricao'])
        : Promise.resolve({ data: [] as any[] }),
    ])

    const campeonatosById = new Map((campeonatos || []).map((item: any) => [item.id, item]))
    const produtorasById = new Map((produtoras || []).map((item: any) => [item.id, item]))
    const usageByCamp = new Map<string, number>()
    for (const row of usages || []) {
      const campId = String(row.campeonato_id || '')
      if (!campId) continue
      usageByCamp.set(campId, (usageByCamp.get(campId) || 0) + 1)
    }

    return NextResponse.json({
      manager: {
        id: manager.id,
        nome: manager.nome,
        username: manager.username,
        avatar_url: manager.avatar_url,
        whatsapp_url: manager.whatsapp_url || null,
        nome_publico_vendas: manager.nome_publico_vendas || manager.nome || manager.username,
        portfolio_anuncios: portfolio,
      },
      public_url: `/vendedores/${manager.id}`,
      campeonatos: rows.map((item: any) => {
        const camp = campeonatosById.get(item.campeonato_id) || null
        const anunciando =
          item.status === 'ativo'
          && (portfolio.length === 0 || portfolio.includes(String(item.campeonato_id)))
        const limite = Number(item.limite_vagas || 0)
        const vagasUsadas = usageByCamp.get(String(item.campeonato_id)) || 0
        return {
          id: item.id,
          campeonato_id: item.campeonato_id,
          nome_publico: item.nome_publico || manager.nome_publico_vendas || manager.nome,
          whatsapp_url: item.whatsapp_url || manager.whatsapp_url || null,
          status: item.status,
          limite_vagas: limite,
          vagas_usadas: vagasUsadas,
          vagas_restantes: limite > 0 ? Math.max(0, limite - vagasUsadas) : null,
          permissoes: item.permissoes || {},
          anunciando,
          campeonatos: camp,
          produtoras: produtorasById.get(item.produtora_id) || null,
        }
      }),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar vendedor.' },
      { status: 404 },
    )
  }
}

async function requireManagerAccount(req: NextRequest, managerId: string) {
  const user = await getBearerUser(req)
  const accounts = await getAccountsForUser(user)
  const account = accounts.find((item) => item.profile_type === 'manager' && item.id === managerId)
  if (!account) throw new Error('Acesso negado.')
  return account
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    await requireManagerAccount(req, managerId)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonatoId || body.campeonato_id || '').trim()
    const publish = body.publish !== undefined ? Boolean(body.publish) : null
    const anunciar = body.anunciar !== undefined ? Boolean(body.anunciar) : null

    if (!campeonatoId) throw new Error('Informe o campeonato a ser atualizado.')

    // Publicar/ocultar vínculo (status no campeonato)
    if (publish !== null) {
      const newStatus = publish ? 'ativo' : 'cancelado'
      const { error: sellerUpdateError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('manager_id', managerId)
        .eq('campeonato_id', campeonatoId)
      if (sellerUpdateError && !missingRelation(sellerUpdateError)) throw sellerUpdateError

      await supabaseAdmin
        .from('tokens')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('tipo', 'manager_invite')
        .eq('manager_id', managerId)
        .eq('campeonato_id', campeonatoId)
    }

    // Portfolio: quais campeonatos aparecem no link público (Shopee-style)
    if (anunciar !== null) {
      const { data: manager, error: managerError } = await supabaseAdmin
        .from('managers')
        .select('portfolio_anuncios')
        .eq('id', managerId)
        .maybeSingle()
      if (managerError && (managerError.code === 'PGRST204' || /portfolio/i.test(managerError.message || ''))) {
        // sem coluna ainda: usa status cancelado/ativo como fallback
        if (publish === null) {
          const newStatus = anunciar ? 'ativo' : 'cancelado'
          await supabaseAdmin
            .from('campeonato_vendedores')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('manager_id', managerId)
            .eq('campeonato_id', campeonatoId)
        }
      } else {
        if (managerError) throw managerError
        const current = Array.isArray(manager?.portfolio_anuncios)
          ? manager.portfolio_anuncios.map(String)
          : []
        // Se lista vazia = anuncia todos; ao marcar/desmarcar explicitamente, materializa lista
        let next: string[]
        if (current.length === 0) {
          // pega todos os ativos e remove/adiciona
          const { data: all } = await supabaseAdmin
            .from('campeonato_vendedores')
            .select('campeonato_id')
            .eq('manager_id', managerId)
            .eq('status', 'ativo')
          const allIds = (all || []).map((r) => String(r.campeonato_id))
          next = anunciar
            ? Array.from(new Set([...allIds, campeonatoId]))
            : allIds.filter((id) => id !== campeonatoId)
        } else {
          next = anunciar
            ? Array.from(new Set([...current, campeonatoId]))
            : current.filter((id) => id !== campeonatoId)
        }
        await supabaseAdmin
          .from('managers')
          .update({ portfolio_anuncios: next, updated_at: new Date().toISOString() })
          .eq('id', managerId)
      }
    }

    return NextResponse.json({ success: true, campeonatoId, publish, anunciar })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar publicação.' },
      { status: 400 },
    )
  }
}
