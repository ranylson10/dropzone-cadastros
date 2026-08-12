import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManage(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function normalizeColor(value: unknown) {
  const color = String(value || '').trim()
  return HEX_COLOR.test(color) ? color.toUpperCase() : ''
}

function collectColors(value: unknown, counts: Map<string, number>) {
  if (typeof value === 'string') {
    const color = normalizeColor(value)
    if (color) counts.set(color, (counts.get(color) || 0) + 1)
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectColors(entry, counts)
    return
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) collectColors(entry, counts)
  }
}

function replaceExactColor(value: unknown, from: string, to: string): { value: unknown; count: number } {
  if (typeof value === 'string') {
    const matches = normalizeColor(value) === from
    return { value: matches ? to : value, count: matches ? 1 : 0 }
  }
  if (Array.isArray(value)) {
    let count = 0
    const next = value.map((entry) => {
      const replaced = replaceExactColor(entry, from, to)
      count += replaced.count
      return replaced.value
    })
    return { value: next, count }
  }
  if (value && typeof value === 'object') {
    let count = 0
    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const replaced = replaceExactColor(entry, from, to)
      next[key] = replaced.value
      count += replaced.count
    }
    return { value: next, count }
  }
  return { value, count: 0 }
}

async function loadArtworks(campeonatoId: string) {
  const { data, error } = await supabaseAdmin.from('campeonato_post_artworks').select('id,name,background_color,blocks').eq('campeonato_id', campeonatoId)
  if (error) throw error
  return data || []
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para visualizar a identidade visual deste campeonato.' }, { status: 403 })

    const artworks = await loadArtworks(id)
    const inventory = new Map<string, { references: number; uses: Array<{ artworkId: string; artworkName: string; count: number }> }>()
    for (const artwork of artworks) {
      const counts = new Map<string, number>()
      collectColors(artwork.background_color, counts)
      collectColors(artwork.blocks || [], counts)
      for (const [color, count] of counts) {
        const current = inventory.get(color) || { references: 0, uses: [] }
        current.references += count
        current.uses.push({ artworkId: artwork.id, artworkName: artwork.name, count })
        inventory.set(color, current)
      }
    }

    const colors = [...inventory.entries()].map(([color, data]) => ({ color, references: data.references, artworks: data.uses.length, uses: data.uses })).sort((a, b) => b.references - a.references || a.color.localeCompare(b.color))
    return NextResponse.json({ colors })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar as cores usadas nas artes.' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para alterar a identidade visual deste campeonato.' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const from = normalizeColor(body.from)
    const to = normalizeColor(body.to)
    if (!from || !to) return NextResponse.json({ error: 'Informe as cores no formato #RRGGBB.' }, { status: 400 })
    if (from === to) return NextResponse.json({ updated_artworks: 0, updated_references: 0 })

    const artworks = await loadArtworks(id)
    let updatedArtworks = 0
    let updatedReferences = 0
    for (const artwork of artworks) {
      const backgroundChanged = normalizeColor(artwork.background_color) === from
      const replacedBlocks = replaceExactColor(artwork.blocks || [], from, to)
      const references = replacedBlocks.count + (backgroundChanged ? 1 : 0)
      if (!references) continue
      const { error } = await supabaseAdmin.from('campeonato_post_artworks').update({
        background_color: backgroundChanged ? to : artwork.background_color,
        blocks: replacedBlocks.value,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }).eq('id', artwork.id).eq('campeonato_id', id)
      if (error) throw error
      updatedArtworks += 1
      updatedReferences += references
    }

    return NextResponse.json({ updated_artworks: updatedArtworks, updated_references: updatedReferences })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao substituir a cor nas artes.' }, { status: 400 })
  }
}
