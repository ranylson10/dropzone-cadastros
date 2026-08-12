import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManage(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

const ASSET_SELECT = 'id,campeonato_id,name,url,kind,created_at'

type ReplaceResult = { value: unknown; count: number }

function replaceExactUrl(value: unknown, oldUrl: string, newUrl: string): ReplaceResult {
  if (typeof value === 'string') return { value: value === oldUrl ? newUrl : value, count: value === oldUrl ? 1 : 0 }
  if (Array.isArray(value)) {
    let count = 0
    const next = value.map((entry) => {
      const replaced = replaceExactUrl(entry, oldUrl, newUrl)
      count += replaced.count
      return replaced.value
    })
    return { value: next, count }
  }
  if (value && typeof value === 'object') {
    let count = 0
    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const replaced = replaceExactUrl(entry, oldUrl, newUrl)
      next[key] = replaced.value
      count += replaced.count
    }
    return { value: next, count }
  }
  return { value, count: 0 }
}

async function usageCount(campeonatoId: string, url: string) {
  const { data, error } = await supabaseAdmin.from('campeonato_post_artworks').select('id,background_url,blocks').eq('campeonato_id', campeonatoId)
  if (error) throw error
  let references = 0
  let artworks = 0
  for (const item of data || []) {
    let itemReferences = item.background_url === url ? 1 : 0
    itemReferences += replaceExactUrl(item.blocks || [], url, url).count
    if (itemReferences) artworks += 1
    references += itemReferences
  }
  return { references, artworks }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id, assetId } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para alterar a biblioteca deste campeonato.' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const newUrl = String(body.url || '').trim().slice(0, 2000)
    if (!newUrl) return NextResponse.json({ error: 'A nova imagem é obrigatória.' }, { status: 400 })

    const { data: asset, error: assetError } = await supabaseAdmin.from('campeonato_asset_library').select(ASSET_SELECT).eq('id', assetId).eq('campeonato_id', id).maybeSingle()
    if (assetError) throw assetError
    if (!asset) return NextResponse.json({ error: 'Imagem não encontrada na biblioteca.' }, { status: 404 })

    const { data: artworks, error: artworkError } = await supabaseAdmin.from('campeonato_post_artworks').select('id,name,background_url,blocks').eq('campeonato_id', id)
    if (artworkError) throw artworkError

    let updatedArtworks = 0
    let updatedReferences = 0
    for (const artwork of artworks || []) {
      const replacedBlocks = replaceExactUrl(artwork.blocks || [], asset.url, newUrl)
      const backgroundChanged = artwork.background_url === asset.url
      const references = replacedBlocks.count + (backgroundChanged ? 1 : 0)
      if (!references) continue
      const { error } = await supabaseAdmin.from('campeonato_post_artworks').update({
        background_url: backgroundChanged ? newUrl : artwork.background_url,
        blocks: replacedBlocks.value,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }).eq('id', artwork.id).eq('campeonato_id', id)
      if (error) throw error
      updatedArtworks += 1
      updatedReferences += references
    }

    const name = String(body.name || asset.name || 'Imagem').trim().slice(0, 120) || 'Imagem'
    const { data: updatedAsset, error: updateError } = await supabaseAdmin.from('campeonato_asset_library').update({ url: newUrl, name }).eq('id', assetId).eq('campeonato_id', id).select(ASSET_SELECT).single()
    if (updateError) throw updateError

    return NextResponse.json({ asset: updatedAsset, updated_artworks: updatedArtworks, updated_references: updatedReferences })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao substituir imagem da biblioteca.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id, assetId } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para alterar a biblioteca deste campeonato.' }, { status: 403 })

    const { data: asset, error: assetError } = await supabaseAdmin.from('campeonato_asset_library').select(ASSET_SELECT).eq('id', assetId).eq('campeonato_id', id).maybeSingle()
    if (assetError) throw assetError
    if (!asset) return NextResponse.json({ ok: true })

    const uses = await usageCount(id, asset.url)
    if (uses.references > 0) return NextResponse.json({ error: `Esta imagem ainda é usada ${uses.references} vez(es) em ${uses.artworks} arte(s). Substitua os usos antes de removê-la da biblioteca.`, uses }, { status: 409 })

    const { error } = await supabaseAdmin.from('campeonato_asset_library').delete().eq('id', assetId).eq('campeonato_id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao remover imagem da biblioteca.' }, { status: 400 })
  }
}
