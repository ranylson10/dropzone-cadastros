import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManage(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

function missingTable(error: any) { return ['42P01', 'PGRST205'].includes(error?.code || '') }

const ARTWORK_SELECT = 'id,name,width,height,slice_count,slice_direction,slice_width,slice_height,output_format,background_url,background_color,blocks'
const ASSET_SELECT = 'name,url,kind'

type SnapshotArtwork = {
  name: string
  width: number
  height: number
  slice_count: number
  slice_direction: 'horizontal' | 'vertical'
  slice_width: number
  slice_height: number
  output_format: 'png' | 'jpg'
  background_url: string | null
  background_color: string
  blocks: unknown[]
}

function publicArtwork(row: any): SnapshotArtwork {
  return {
    name: String(row.name || 'Arte'),
    width: Number(row.width) || 1080,
    height: Number(row.height) || 1350,
    slice_count: Number(row.slice_count) || 1,
    slice_direction: row.slice_direction === 'vertical' ? 'vertical' : 'horizontal',
    slice_width: Number(row.slice_width) || 1080,
    slice_height: Number(row.slice_height) || 1350,
    output_format: row.output_format === 'jpg' ? 'jpg' : 'png',
    background_url: row.background_url ? String(row.background_url) : null,
    background_color: String(row.background_color || '#ffffff'),
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
  }
}

function createToken() {
  return `DZART-${randomBytes(5).toString('hex').toUpperCase().match(/.{1,4}/g)?.join('-') || randomBytes(5).toString('hex').toUpperCase()}`
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para compartilhar as artes deste campeonato.' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const requestedIds = Array.isArray(body.artwork_ids) ? body.artwork_ids.map(String).filter(Boolean) : []
    const includeAssets = body.include_assets !== false

    const [{ data: campeonato }, { data: allArtworks, error: artworkError }, assetResult] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome').eq('id', id).maybeSingle(),
      supabaseAdmin.from('campeonato_post_artworks').select(ARTWORK_SELECT).eq('campeonato_id', id).order('updated_at', { ascending: false }),
      includeAssets ? supabaseAdmin.from('campeonato_asset_library').select(ASSET_SELECT).eq('campeonato_id', id) : Promise.resolve({ data: [], error: null } as any),
    ])
    if (artworkError) throw artworkError
    if (assetResult.error) throw assetResult.error
    const requestedSet = new Set(requestedIds)
    const artworks = (allArtworks || []).filter((artwork: any) => !requestedSet.size || requestedSet.has(String(artwork.id)))
    if (!artworks.length) return NextResponse.json({ error: 'Selecione ao menos uma arte para compartilhar.' }, { status: 400 })

    const snapshot = {
      version: 1,
      source_name: campeonato?.nome || 'Campeonato',
      artworks: artworks.map(publicArtwork),
      assets: (assetResult.data || []).map((asset: any) => ({ name: String(asset.name || 'Imagem'), url: String(asset.url || ''), kind: String(asset.kind || 'other') })).filter((asset: any) => asset.url),
    }
    const token = createToken()
    const name = String(body.name || `${campeonato?.nome || 'Campeonato'} · Artes`).trim().slice(0, 160) || 'Pacote de artes'
    const { error } = await supabaseAdmin.from('campeonato_post_artwork_share_tokens').insert({
      source_campeonato_id: id,
      created_by: user.id,
      token,
      name,
      payload: snapshot,
      artwork_count: snapshot.artworks.length,
      asset_count: snapshot.assets.length,
    })
    if (error) {
      if (missingTable(error)) return NextResponse.json({ error: 'Rode o SQL: database/migrations/20260812_post_artwork_share_tokens.sql', needs_sql: true }, { status: 503 })
      throw error
    }

    return NextResponse.json({ share: { token, name, artworks: snapshot.artworks.length, assets: snapshot.assets.length, source_name: snapshot.source_name } }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao gerar token de compartilhamento.' }, { status: 400 })
  }
}
