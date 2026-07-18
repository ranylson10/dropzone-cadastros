import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canStream(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return (
    permission.role === 'owner'
    || permission.role === 'manager'
    || permission.canManage
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
  )
}

function missingTable(error: any) {
  return ['42P01', 'PGRST205'].includes(error?.code || '')
}

function mapRow(row: any) {
  return {
    id: row.id,
    campeonato_id: row.campeonato_id,
    name: row.nome,
    template: row.template || 'custom',
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    share_token: row.share_token,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão para stream deste campeonato.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .select('*')
      .eq('campeonato_id', id)
      .eq('ativo', true)
      .order('updated_at', { ascending: false })

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({ overlays: [], missing_table: true })
      }
      throw error
    }

    return NextResponse.json({ overlays: (data || []).map(mapRow), missing_table: false })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar overlays.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão para criar overlay.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const nome = String(body.name || body.nome || 'Overlay').trim() || 'Overlay'
    const template = String(body.template || 'custom')
    const blocks = Array.isArray(body.blocks) ? body.blocks : []

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .insert({
        campeonato_id: id,
        nome,
        template,
        blocks,
        criado_por: user.id,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Tabela de stream ainda não existe no Supabase. Rode database/migrations/20260718_campeonato_stream_overlays.sql',
          missing_table: true,
        }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({ overlay: mapRow(data) }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar overlay.' }, { status: 400 })
  }
}
