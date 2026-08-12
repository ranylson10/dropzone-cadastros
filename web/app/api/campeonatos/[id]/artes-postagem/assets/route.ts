import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManage(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

function missingTable(error: any) { return ['42P01', 'PGRST205'].includes(error?.code || '') }
const SELECT = 'id,campeonato_id,name,url,kind,created_at'
const KINDS = new Set(['background', 'cell', 'card', 'other'])

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para acessar a biblioteca deste campeonato.' }, { status: 403 })
    const { data, error } = await supabaseAdmin.from('campeonato_asset_library').select(SELECT).eq('campeonato_id', id).order('created_at', { ascending: false })
    if (error) {
      if (missingTable(error)) return NextResponse.json({ error: 'Rode o SQL: database/migrations/20260812_asset_library.sql', needs_sql: true }, { status: 503 })
      throw error
    }
    return NextResponse.json({ assets: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar biblioteca de imagens.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para alterar a biblioteca deste campeonato.' }, { status: 403 })
    const body = await req.json().catch(() => ({}))
    const url = String(body.url || '').trim().slice(0, 2000)
    if (!url) return NextResponse.json({ error: 'URL da imagem é obrigatória.' }, { status: 400 })
    const kind = KINDS.has(String(body.kind || '')) ? String(body.kind) : 'other'
    const name = String(body.name || 'Imagem').trim().slice(0, 120) || 'Imagem'

    const { data: existing, error: existingError } = await supabaseAdmin.from('campeonato_asset_library').select(SELECT).eq('campeonato_id', id).eq('url', url).maybeSingle()
    if (existingError && missingTable(existingError)) return NextResponse.json({ error: 'Rode o SQL: database/migrations/20260812_asset_library.sql', needs_sql: true }, { status: 503 })
    if (existingError) throw existingError
    if (existing) return NextResponse.json({ asset: existing })

    const { data, error } = await supabaseAdmin.from('campeonato_asset_library').insert({ campeonato_id: id, created_by: user.id, name, url, kind }).select(SELECT).single()
    if (error) {
      if (missingTable(error)) return NextResponse.json({ error: 'Rode o SQL: database/migrations/20260812_asset_library.sql', needs_sql: true }, { status: 503 })
      throw error
    }
    return NextResponse.json({ asset: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar imagem na biblioteca.' }, { status: 400 })
  }
}
