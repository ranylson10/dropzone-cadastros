import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingTable(error: any) {
  return ['42P01', 'PGRST205'].includes(error?.code || '')
}

function mapRow(row: any, extra?: Record<string, unknown>) {
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    nome: row.nome,
    name: row.nome,
    descricao: row.descricao,
    description: row.descricao,
    blocks: row.blocks,
    visibility: row.visibility,
    is_purchased_copy: row.is_purchased_copy,
    source_catalog_id: row.source_catalog_id,
    price_label: row.price_label,
    preview_note: row.preview_note,
    updated_at: row.updated_at,
    created_at: row.created_at,
    ...extra,
  }
}

/** GET ?scope=mine|public|entitled */
export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const scope = req.nextUrl.searchParams.get('scope') || 'mine'

    if (scope === 'public') {
      const { data, error } = await supabaseAdmin
        .from('stream_overlay_catalog')
        .select('*')
        .eq('ativo', true)
        .eq('visibility', 'public')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) {
        if (missingTable(error)) return NextResponse.json({ models: [], missing_table: true })
        throw error
      }
      return NextResponse.json({
        models: (data || []).map((r) => mapRow(r, { is_mine: r.owner_user_id === user.id, entitled: true, entitlement_source: r.owner_user_id === user.id ? 'own' : 'public_clone' })),
        missing_table: false,
      })
    }

    if (scope === 'entitled') {
      const { data: ents, error: e1 } = await supabaseAdmin
        .from('stream_overlay_entitlements')
        .select('catalog_id, source')
        .eq('user_id', user.id)
      if (e1) {
        if (missingTable(e1)) return NextResponse.json({ models: [], missing_table: true })
        throw e1
      }
      const ids = (ents || []).map((e) => e.catalog_id)
      if (!ids.length) return NextResponse.json({ models: [], missing_table: false })
      const { data, error } = await supabaseAdmin
        .from('stream_overlay_catalog')
        .select('*')
        .in('id', ids)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
      if (error) throw error
      const srcMap = new Map((ents || []).map((e) => [e.catalog_id, e.source]))
      return NextResponse.json({
        models: (data || []).map((r) =>
          mapRow(r, {
            is_mine: r.owner_user_id === user.id,
            entitled: true,
            entitlement_source: srcMap.get(r.id) || null,
          }),
        ),
        missing_table: false,
      })
    }

    // mine
    const { data, error } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('ativo', true)
      .order('updated_at', { ascending: false })
    if (error) {
      if (missingTable(error)) return NextResponse.json({ models: [], missing_table: true })
      throw error
    }
    return NextResponse.json({
      models: (data || []).map((r) => mapRow(r, { is_mine: true, entitled: true, entitlement_source: 'own' })),
      missing_table: false,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar catálogo.' }, { status: 400 })
  }
}

/** POST — criar modelo no catálogo */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const nome = String(body.name || body.nome || 'Modelo').trim() || 'Modelo'
    const descricao = String(body.description || body.descricao || '').trim()
    const visibility = String(body.visibility || 'private')
    const isPurchased = Boolean(body.is_purchased_copy)

    if (isPurchased && (visibility === 'public' || visibility === 'for_sale')) {
      return NextResponse.json(
        { error: 'Modelo comprado não pode ser publicado nem colocado à venda.' },
        { status: 403 },
      )
    }
    if (!['private', 'public', 'for_sale'].includes(visibility)) {
      return NextResponse.json({ error: 'Visibilidade inválida.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .insert({
        owner_user_id: user.id,
        nome,
        descricao,
        blocks: body.blocks ?? { v: 3, frameW: 1920, frameH: 1080, items: [] },
        visibility: isPurchased ? 'private' : visibility,
        is_purchased_copy: isPurchased,
        source_catalog_id: body.source_catalog_id || null,
        price_label: isPurchased ? null : body.price_label || null,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Catálogo ainda não existe. Rode DOWNLOAD_stream_overlay_catalog.sql no Supabase.',
          missing_table: true,
        }, { status: 503 })
      }
      throw error
    }

    // entitlement own
    await supabaseAdmin.from('stream_overlay_entitlements').upsert(
      {
        catalog_id: data.id,
        user_id: user.id,
        source: isPurchased ? 'purchase' : 'own',
      },
      { onConflict: 'catalog_id,user_id' },
    )

    return NextResponse.json({ model: mapRow(data, { is_mine: true, entitled: true, entitlement_source: isPurchased ? 'purchase' : 'own' }) }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar modelo.' }, { status: 400 })
  }
}
