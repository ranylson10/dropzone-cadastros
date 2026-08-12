import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManageArt(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

const SELECT = 'id,campeonato_id,name,width,height,slice_count,slice_direction,slice_width,slice_height,output_format,background_url,background_color,blocks,created_at,updated_at'

function n(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? Math.round(parsed) : fallback))
}

function blocks(value: unknown) { return Array.isArray(value) ? value.slice(0, 100) : [] }

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; artId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id, artId } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManageArt(permission)) return NextResponse.json({ error: 'Sem permissão para editar esta arte.' }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const sliceDirection = body.slice_direction === 'vertical' ? 'vertical' : 'horizontal'
    const sliceCount = n(body.slice_count, 1, 1, 10)
    const sliceWidth = n(body.slice_width, 1080, 240, 7680)
    const sliceHeight = n(body.slice_height, 1350, 240, 7680)
    const row = {
      name: String(body.name || 'Arte').trim().slice(0, 120) || 'Arte',
      slice_count: sliceCount,
      slice_direction: sliceDirection,
      slice_width: sliceWidth,
      slice_height: sliceHeight,
      width: sliceDirection === 'horizontal' ? sliceWidth * sliceCount : sliceWidth,
      height: sliceDirection === 'vertical' ? sliceHeight * sliceCount : sliceHeight,
      output_format: body.output_format === 'jpg' ? 'jpg' : 'png',
      background_url: body.background_url ? String(body.background_url).slice(0, 2000) : null,
      background_color: /^#[0-9a-f]{6}$/i.test(String(body.background_color || '')) ? body.background_color : '#ffffff',
      blocks: blocks(body.blocks),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    const { data, error } = await supabaseAdmin.from('campeonato_post_artworks').update(row).eq('id', artId).eq('campeonato_id', id).select(SELECT).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Arte não encontrada.' }, { status: 404 })
    return NextResponse.json({ item: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar arte.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; artId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id, artId } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManageArt(permission)) return NextResponse.json({ error: 'Sem permissão para excluir esta arte.' }, { status: 403 })
    const { error } = await supabaseAdmin.from('campeonato_post_artworks').delete().eq('id', artId).eq('campeonato_id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao excluir arte.' }, { status: 400 })
  }
}
