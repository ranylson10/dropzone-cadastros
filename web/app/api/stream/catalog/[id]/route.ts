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

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const body = await req.json().catch(() => ({}))

    const { data: existing, error: e0 } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle()
    if (e0) {
      if (missingTable(e0)) return NextResponse.json({ error: 'Catálogo ausente.', missing_table: true }, { status: 503 })
      throw e0
    }
    if (!existing) return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 })
    if (existing.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Só o dono pode editar este modelo.' }, { status: 403 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name != null || body.nome != null) patch.nome = String(body.name || body.nome || existing.nome)
    if (body.description != null || body.descricao != null) patch.descricao = String(body.description || body.descricao || '')
    if (body.blocks != null) patch.blocks = body.blocks
    if (body.price_label !== undefined) patch.price_label = body.price_label
    if (body.visibility != null) {
      const v = String(body.visibility)
      if (existing.is_purchased_copy && (v === 'public' || v === 'for_sale')) {
        return NextResponse.json(
          { error: 'Modelo comprado não pode ser publicado nem colocado à venda.' },
          { status: 403 },
        )
      }
      if (!['private', 'public', 'for_sale'].includes(v)) {
        return NextResponse.json({ error: 'Visibilidade inválida.' }, { status: 400 })
      }
      patch.visibility = v
    }

    const { data, error } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ model: mapRow(data, { is_mine: true, entitled: true }) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar modelo.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const { data: existing, error: e0 } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .select('id, owner_user_id')
      .eq('id', id)
      .maybeSingle()
    if (e0) {
      if (missingTable(e0)) return NextResponse.json({ error: 'Catálogo ausente.', missing_table: true }, { status: 503 })
      throw e0
    }
    if (!existing) return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 })
    if (existing.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Só o dono pode excluir.' }, { status: 403 })
    }
    await supabaseAdmin.from('stream_overlay_catalog').update({ ativo: false, updated_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao excluir modelo.' }, { status: 400 })
  }
}
