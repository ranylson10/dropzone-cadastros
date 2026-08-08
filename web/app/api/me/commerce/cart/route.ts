import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export const dynamic = 'force-dynamic'

function cents(value: unknown) {
  const number = Number(value || 0)
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0
}

function dbSetupError(error: any) {
  return /42P01|PGRST205|does not exist|42703|PGRST204/i.test(String(error?.message || error?.code || ''))
}

async function getOrCreateCart(userId: string) {
  const existing = await supabaseAdmin
    .from('commerce_carrinhos')
    .select('id,auth_user_id,status,created_at,updated_at')
    .eq('auth_user_id', userId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (existing.error && !dbSetupError(existing.error)) throw existing.error
  if (existing.data) return existing.data

  const created = await supabaseAdmin
    .from('commerce_carrinhos')
    .insert({ auth_user_id: userId, status: 'ativo' })
    .select('id,auth_user_id,status,created_at,updated_at')
    .single()

  if (created.error) throw created.error
  return created.data
}

async function listCart(userId: string) {
  const cart = await getOrCreateCart(userId)
  const { data, error } = await supabaseAdmin
    .from('commerce_carrinho_itens')
    .select(`
      id,
      campeonato_id,
      quantidade,
      preco_unitario_centavos,
      origem,
      vendedor_manager_id,
      created_at,
      campeonato:campeonatos(id,nome,logo_url,banner_url,valor_inscricao,vagas_livres,total_vagas)
    `)
    .eq('carrinho_id', cart.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return { cart, items: data || [] }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    return NextResponse.json(await listCart(user.id))
  } catch (error: any) {
    if (dbSetupError(error)) {
      return NextResponse.json({ cart: null, items: [], needs_migration: true }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'Erro ao carregar carrinho.' }, { status: 400 })
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

    const { data: campeonato, error: campeonatoError } = await supabaseAdmin
      .from('campeonatos')
      .select('id,valor_inscricao,vagas_livres,total_vagas')
      .eq('id', campeonatoId)
      .maybeSingle()
    if (campeonatoError) throw campeonatoError
    if (!campeonato) throw new Error('Campeonato nao encontrado.')

    const cart = await getOrCreateCart(user.id)
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('commerce_carrinho_itens')
      .select('id,quantidade')
      .eq('carrinho_id', cart.id)
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()
    if (existingError) throw existingError

    const payload = {
      carrinho_id: cart.id,
      campeonato_id: campeonatoId,
      quantidade: existing ? Math.max(1, Math.min(100, Number(existing.quantidade || 1) + quantidade)) : quantidade,
      preco_unitario_centavos: cents(campeonato.valor_inscricao),
      origem,
      vendedor_manager_id: vendedorManagerId,
      updated_at: new Date().toISOString(),
    }

    const result = existing
      ? await supabaseAdmin.from('commerce_carrinho_itens').update(payload).eq('id', existing.id)
      : await supabaseAdmin.from('commerce_carrinho_itens').insert(payload)
    if (result.error) throw result.error

    return NextResponse.json(await listCart(user.id))
  } catch (error: any) {
    if (dbSetupError(error)) {
      return NextResponse.json({ error: 'Rode a migration 20260808_commerce_cart_wishlist.sql.', needs_migration: true }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar carrinho.' }, { status: 400 })
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

    return NextResponse.json(await listCart(user.id))
  } catch (error: any) {
    if (dbSetupError(error)) {
      return NextResponse.json({ error: 'Rode a migration 20260808_commerce_cart_wishlist.sql.', needs_migration: true }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar carrinho.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const itemId = String(new URL(req.url).searchParams.get('item_id') || '').trim()
    if (!itemId) throw new Error('Item obrigatorio.')
    const cart = await getOrCreateCart(user.id)
    const { error } = await supabaseAdmin
      .from('commerce_carrinho_itens')
      .delete()
      .eq('id', itemId)
      .eq('carrinho_id', cart.id)
    if (error) throw error

    return NextResponse.json(await listCart(user.id))
  } catch (error: any) {
    if (dbSetupError(error)) {
      return NextResponse.json({ error: 'Rode a migration 20260808_commerce_cart_wishlist.sql.', needs_migration: true }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'Erro ao remover item.' }, { status: 400 })
  }
}
