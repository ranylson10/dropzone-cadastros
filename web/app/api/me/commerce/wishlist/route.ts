import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export const dynamic = 'force-dynamic'

function dbSetupError(error: any) {
  return /42P01|PGRST205|does not exist|42703|PGRST204/i.test(String(error?.message || error?.code || ''))
}

async function listWishlist(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('commerce_favoritos')
    .select(`
      id,
      campeonato_id,
      origem,
      created_at,
      campeonato:campeonatos(id,nome,logo_url,banner_url,valor_inscricao,vagas_livres,total_vagas)
    `)
    .eq('auth_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return { items: data || [] }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    return NextResponse.json(await listWishlist(user.id))
  } catch (error: any) {
    if (dbSetupError(error)) {
      return NextResponse.json({ items: [], needs_migration: true }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'Erro ao carregar favoritos.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonato_id || '').trim()
    const origem = ['direto', 'vendedor', 'afiliado', 'lili', 'app'].includes(String(body.origem || ''))
      ? String(body.origem)
      : 'direto'
    const favorito = body.favorito !== false
    if (!campeonatoId) throw new Error('Campeonato obrigatorio.')

    const existing = await supabaseAdmin
      .from('commerce_favoritos')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('campeonato_id', campeonatoId)
      .limit(1)
      .maybeSingle()
    if (existing.error) throw existing.error

    if (favorito && !existing.data) {
      const { error } = await supabaseAdmin
        .from('commerce_favoritos')
        .insert({ auth_user_id: user.id, campeonato_id: campeonatoId, origem })
      if (error) throw error
    }
    if (!favorito) {
      const { error } = await supabaseAdmin
        .from('commerce_favoritos')
        .delete()
        .eq('auth_user_id', user.id)
        .eq('campeonato_id', campeonatoId)
      if (error) throw error
    }

    return NextResponse.json(await listWishlist(user.id))
  } catch (error: any) {
    if (dbSetupError(error)) {
      return NextResponse.json({ error: 'Rode a migration 20260808_commerce_cart_wishlist.sql.', needs_migration: true }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar favoritos.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const campeonatoId = String(new URL(req.url).searchParams.get('campeonato_id') || '').trim()
    if (!campeonatoId) throw new Error('Campeonato obrigatorio.')
    const { error } = await supabaseAdmin
      .from('commerce_favoritos')
      .delete()
      .eq('auth_user_id', user.id)
      .eq('campeonato_id', campeonatoId)
    if (error) throw error
    return NextResponse.json(await listWishlist(user.id))
  } catch (error: any) {
    if (dbSetupError(error)) {
      return NextResponse.json({ error: 'Rode a migration 20260808_commerce_cart_wishlist.sql.', needs_migration: true }, { status: 503 })
    }
    return NextResponse.json({ error: error?.message || 'Erro ao remover favorito.' }, { status: 400 })
  }
}
