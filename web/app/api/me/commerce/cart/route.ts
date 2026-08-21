import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export const dynamic = 'force-dynamic'

function cents(value: unknown) {
  const number = Number(value || 0)
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0
}

function dbSetupError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  if (!['42P01', 'PGRST205'].includes(code)) return false
  return /commerce_carrinhos|commerce_carrinho_itens/i.test(message)
}

async function getOrCreateCart(userId: string) {
  const existing = await supabaseAdmin
    .from('commerce_carrinhos')
    .select('id,auth_user_id,status,created_at,updated_at')
    .eq('auth_user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data) return existing.data

  const created = await supabaseAdmin
    .from('commerce_carrinhos')
    .insert({ auth_user_id: userId, status: 'ativo' })
    .select('id,auth_user_id,status,created_at,updated_at')
    .single()

  if (created.error) {
    // O indice parcial permite apenas um carrinho ativo. Em dois cliques quase
    // simultâneos, outro request pode criá-lo antes deste terminar.
    if (created.error.code === '23505') {
      const retry = await supabaseAdmin
        .from('commerce_carrinhos')
        .select('id,auth_user_id,status,created_at,updated_at')
        .eq('auth_user_id', userId)
        .eq('status', 'ativo')
        .single()
      if (!retry.error && retry.data) return retry.data
    }
    throw created.error
  }
  return created.data
}

async function championshipData(campeonatoIds: string[]) {
  if (!campeonatoIds.length) return new Map<string, any>()

  const [{ data: championships, error: championshipsError }, { data: configs, error: configsError }] = await Promise.all([
    supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url,banner_url')
      .in('id', campeonatoIds),
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('campeonato_id,valor_inscricao,numero_vagas')
      .in('campeonato_id', campeonatoIds),
  ])

  if (championshipsError) throw championshipsError
  if (configsError) throw configsError

  const configByChamp = new Map((configs || []).map((row: any) => [String(row.campeonato_id), row]))
  return new Map(
    (championships || []).map((row: any) => {
      const config = configByChamp.get(String(row.id)) || {}
      return [
        String(row.id),
        {
          ...row,
          valor_inscricao: config.valor_inscricao ?? null,
          total_vagas: config.numero_vagas ?? null,
          vagas_livres: config.numero_vagas ?? null,
        },
      ]
    }),
  )
}

async function listCart(userId: string) {
  const cart = await getOrCreateCart(userId)
  const { data, error } = await supabaseAdmin
    .from('commerce_carrinho_itens')
    .select('id,campeonato_id,quantidade,preco_unitario_centavos,origem,vendedor_manager_id,created_at')
    .eq('carrinho_id', cart.id)
    .order('created_at', { ascending: false })

  if (error) throw error

  const items = data || []
  const championshipById = await championshipData(
    [...new Set(items.map((row: any) => String(row.campeonato_id || '')).filter(Boolean))],
  )

  return {
    cart,
    items: items.map((row: any) => ({
      ...row,
      campeonato: championshipById.get(String(row.campeonato_id)) || null,
    })),
  }
}

function errorResponse(error: any, fallback: string) {
  if (dbSetupError(error)) {
    return NextResponse.json(
      { error: 'Estrutura de carrinho não encontrada no banco.', needs_migration: true },
      { status: 503 },
    )
  }
  return NextResponse.json(
    {
      error: error?.message || fallback,
      code: error?.code || null,
    },
    { status: 400 },
  )
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    return NextResponse.json(await listCart(user.id))
  } catch (error: any) {
    return errorResponse(error, 'Erro ao carregar carrinho.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonato_id || '').trim()
    const quantidade = Math.max(1, Math.min(100, Number(body.quantidade || 1)))
    const origem = ['direto', 'vendedor', 'afiliado', 'lili', 'app'].includes(String(body.origem || ''))
      ? String(body.origem)
      : 'direto'
    const vendedorManagerId = body.vendedor_manager_id ? String(body.vendedor_manager_id) : null
    if (!campeonatoId) throw new Error('Campeonato obrigatorio.')

    const [{ data: campeonato, error: campeonatoError }, { data: config, error: configError }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id').eq('id', campeonatoId).maybeSingle(),
      supabaseAdmin
        .from('campeonato_configuracoes')
        .select('valor_inscricao')
        .eq('campeonato_id', campeonatoId)
        .maybeSingle(),
    ])

    if (campeonatoError) throw campeonatoError
    if (configError) throw configError
    if (!campeonato) throw new Error('Campeonato nao encontrado.')

    const cart = await getOrCreateCart(user.id)
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('commerce_carrinho_itens')
      .select('id')
      .eq('carrinho_id', cart.id)
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()

    if (existingError) throw existingError

    const payload = {
      carrinho_id: cart.id,
      campeonato_id: campeonatoId,
      quantidade,
      preco_unitario_centavos: cents(config?.valor_inscricao),
      origem,
      vendedor_manager_id: vendedorManagerId,
      updated_at: new Date().toISOString(),
    }

    const result = existing
      ? await supabaseAdmin.from('commerce_carrinho_itens').update(payload).eq('id', existing.id)
      : await supabaseAdmin.from('commerce_carrinho_itens').insert(payload)

    if (result.error) throw result.error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return errorResponse(error, 'Erro ao atualizar carrinho.')
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const itemId = String(body.item_id || '').trim()
    const quantidade = Math.max(1, Math.min(100, Number(body.quantidade || 1)))
    if (!itemId) throw new Error('Item obrigatorio.')

    const cart = await getOrCreateCart(user.id)
    const { error } = await supabaseAdmin
      .from('commerce_carrinho_itens')
      .update({ quantidade, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('carrinho_id', cart.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return errorResponse(error, 'Erro ao atualizar carrinho.')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const params = new URL(req.url).searchParams
    const itemId = String(params.get('item_id') || '').trim()
    const campeonatoId = String(params.get('campeonato_id') || '').trim()
    if (!itemId && !campeonatoId) throw new Error('Item ou campeonato obrigatorio.')

    const cart = await getOrCreateCart(user.id)
    let query = supabaseAdmin
      .from('commerce_carrinho_itens')
      .delete()
      .eq('carrinho_id', cart.id)

    query = itemId ? query.eq('id', itemId) : query.eq('campeonato_id', campeonatoId)
    const { error } = await query

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return errorResponse(error, 'Erro ao remover item.')
  }
}
