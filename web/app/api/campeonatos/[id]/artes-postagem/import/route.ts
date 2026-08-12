import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManage(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

function missingTable(error: any) { return ['42P01', 'PGRST205'].includes(error?.code || '') }
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function normalizeToken(value: unknown) { return String(value || '').trim().toUpperCase().replace(/\s+/g, '') }

function collectColors(value: unknown, counts: Map<string, number>) {
  if (typeof value === 'string') {
    if (HEX_COLOR.test(value.trim())) {
      const color = value.trim().toUpperCase()
      counts.set(color, (counts.get(color) || 0) + 1)
    }
    return
  }
  if (Array.isArray(value)) { value.forEach((entry) => collectColors(entry, counts)); return }
  if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach((entry) => collectColors(entry, counts))
}

function safeKind(value: unknown) {
  const kind = String(value || '')
  return ['background', 'cell', 'card', 'other'].includes(kind) ? kind : 'other'
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para importar artes neste campeonato.' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const token = normalizeToken(body.token)
    if (!token.startsWith('DZART-')) return NextResponse.json({ error: 'Informe um token de artes válido.' }, { status: 400 })

    const { data: share, error: shareError } = await supabaseAdmin.from('campeonato_post_artwork_share_tokens').select('id,source_campeonato_id,name,payload,artwork_count,asset_count,use_count,revoked_at').eq('token', token).maybeSingle()
    if (shareError) {
      if (missingTable(shareError)) return NextResponse.json({ error: 'Rode o SQL: database/migrations/20260812_post_artwork_share_tokens.sql', needs_sql: true }, { status: 503 })
      throw shareError
    }
    if (!share || share.revoked_at) return NextResponse.json({ error: 'Token não encontrado ou não está mais disponível.' }, { status: 404 })

    const payload = share.payload && typeof share.payload === 'object' ? share.payload as any : {}
    const artworks = Array.isArray(payload.artworks) ? payload.artworks : []
    const assets = Array.isArray(payload.assets) ? payload.assets : []
    const colors = new Map<string, number>()
    for (const artwork of artworks) { collectColors(artwork.background_color, colors); collectColors(artwork.blocks, colors) }
    const palette = [...colors.entries()].map(([color, references]) => ({ color, references })).sort((a, b) => b.references - a.references).slice(0, 8)

    const preview = {
      token,
      name: String(share.name || 'Pacote de artes'),
      source_name: String(payload.source_name || 'Campeonato'),
      artworks: artworks.map((artwork: any) => ({ name: String(artwork.name || 'Arte'), width: Number(artwork.width) || 1080, height: Number(artwork.height) || 1350, slices: Number(artwork.slice_count) || 1 })),
      assets: assets.map((asset: any) => ({ name: String(asset.name || 'Imagem'), url: String(asset.url || ''), kind: safeKind(asset.kind) })).filter((asset: any) => asset.url),
      colors: palette,
    }
    if (body.preview === true) return NextResponse.json({ preview })
    if (!artworks.length) return NextResponse.json({ error: 'Este pacote não possui artes para importar.' }, { status: 400 })

    const rows = artworks.map((artwork: any) => ({
      campeonato_id: id,
      created_by: user.id,
      updated_by: user.id,
      name: `${String(artwork.name || 'Arte').slice(0, 108)} · importada`,
      width: Number(artwork.width) || 1080,
      height: Number(artwork.height) || 1350,
      slice_count: Number(artwork.slice_count) || 1,
      slice_direction: artwork.slice_direction === 'vertical' ? 'vertical' : 'horizontal',
      slice_width: Number(artwork.slice_width) || 1080,
      slice_height: Number(artwork.slice_height) || 1350,
      output_format: artwork.output_format === 'jpg' ? 'jpg' : 'png',
      background_url: artwork.background_url ? String(artwork.background_url) : null,
      background_color: String(artwork.background_color || '#ffffff'),
      blocks: Array.isArray(artwork.blocks) ? artwork.blocks : [],
    }))
    const { data: inserted, error: insertError } = await supabaseAdmin.from('campeonato_post_artworks').insert(rows).select('id,name')
    if (insertError) throw insertError

    let importedAssets = 0
    for (const asset of assets) {
      const url = String(asset.url || '').trim().slice(0, 2000)
      if (!url) continue
      const { data: existing, error: existingError } = await supabaseAdmin.from('campeonato_asset_library').select('id').eq('campeonato_id', id).eq('url', url).maybeSingle()
      if (existingError) throw existingError
      if (existing) continue
      const { error } = await supabaseAdmin.from('campeonato_asset_library').insert({ campeonato_id: id, created_by: user.id, name: String(asset.name || 'Imagem').slice(0, 120), url, kind: safeKind(asset.kind) })
      if (error) throw error
      importedAssets += 1
    }

    await supabaseAdmin.from('campeonato_post_artwork_share_tokens').update({ use_count: (Number((share as any).use_count) || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', share.id)

    return NextResponse.json({ imported: { artworks: inserted?.length || rows.length, assets: importedAssets, ids: (inserted || []).map((item: any) => item.id) }, preview })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao importar pacote de artes.' }, { status: 400 })
  }
}
