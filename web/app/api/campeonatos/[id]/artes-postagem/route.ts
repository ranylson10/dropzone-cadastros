import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManageArt(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

function missingTable(error: any) { return ['42P01', 'PGRST205'].includes(error?.code || '') }

const SELECT = 'id,campeonato_id,name,width,height,slice_count,slice_direction,slice_width,slice_height,output_format,background_url,background_color,blocks,created_at,updated_at'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManageArt(permission)) return NextResponse.json({ error: 'Sem permissão para editar artes deste campeonato.' }, { status: 403 })
    const [{ data: campeonato }, { data, error }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome').eq('id', id).maybeSingle(),
      supabaseAdmin.from('campeonato_post_artworks').select(SELECT).eq('campeonato_id', id).order('updated_at', { ascending: false }),
    ])
    if (error) {
      if (missingTable(error)) return NextResponse.json({ error: 'Rode o SQL: database/migrations/20260812_post_artworks_independentes.sql', needs_sql: true }, { status: 503 })
      throw error
    }
    return NextResponse.json({ campeonato, items: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar artes.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManageArt(permission)) return NextResponse.json({ error: 'Sem permissão para criar artes deste campeonato.' }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const row = {
      campeonato_id: id,
      created_by: user.id,
      name: String(body.name || 'Nova arte').trim().slice(0, 120) || 'Nova arte',
      width: 1080,
      height: 1350,
      slice_count: 1,
      slice_direction: 'horizontal',
      slice_width: 1080,
      slice_height: 1350,
      output_format: 'png',
      background_url: null,
      background_color: '#ffffff',
      blocks: [],
    }
    const { data, error } = await supabaseAdmin.from('campeonato_post_artworks').insert(row).select(SELECT).single()
    if (error) {
      if (missingTable(error)) return NextResponse.json({ error: 'Rode o SQL: database/migrations/20260812_post_artworks_independentes.sql', needs_sql: true }, { status: 503 })
      throw error
    }
    return NextResponse.json({ item: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar arte.' }, { status: 400 })
  }
}
