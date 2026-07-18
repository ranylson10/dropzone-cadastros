import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { packOverlayBlocks, unpackOverlayBlocks } from '@/features/campeonatos/stream/utils/overlay-frame'

function canStreamWrite(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
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
  const packed = unpackOverlayBlocks(row.blocks)
  return {
    id: row.id,
    campeonato_id: row.campeonato_id,
    name: row.nome,
    template: row.template || 'custom',
    blocks: packed.blocks,
    frameW: packed.frameW,
    frameH: packed.frameH,
    share_token: row.share_token,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; overlayId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id, overlayId } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStreamWrite(permission) && permission.role === 'none') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .select('*')
      .eq('id', overlayId)
      .eq('campeonato_id', id)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      if (missingTable(error)) return NextResponse.json({ error: 'Tabela stream ausente.', missing_table: true }, { status: 503 })
      throw error
    }
    if (!data) return NextResponse.json({ error: 'Overlay não encontrada.' }, { status: 404 })
    return NextResponse.json({ overlay: mapRow(data) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar overlay.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string; overlayId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id, overlayId } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStreamWrite(permission)) {
      return NextResponse.json({ error: 'Sem permissão para editar overlay.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name != null || body.nome != null) patch.nome = String(body.name || body.nome || 'Overlay').trim() || 'Overlay'
    if (body.template != null) patch.template = String(body.template)
    if (body.blocks != null || body.frameW != null || body.frameH != null) {
      const existing = await supabaseAdmin
        .from('campeonato_stream_overlays')
        .select('blocks')
        .eq('id', overlayId)
        .eq('campeonato_id', id)
        .maybeSingle()
      const prev = unpackOverlayBlocks(existing.data?.blocks)
      const items = Array.isArray(body.blocks) ? body.blocks : prev.blocks
      const frameW = body.frameW != null ? body.frameW : prev.frameW
      const frameH = body.frameH != null ? body.frameH : prev.frameH
      patch.blocks = packOverlayBlocks(items, frameW, frameH)
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .update(patch)
      .eq('id', overlayId)
      .eq('campeonato_id', id)
      .eq('ativo', true)
      .select('*')
      .maybeSingle()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Tabela de stream ainda não existe. Rode 20260718_campeonato_stream_overlays.sql',
          missing_table: true,
        }, { status: 503 })
      }
      throw error
    }
    if (!data) return NextResponse.json({ error: 'Overlay não encontrada.' }, { status: 404 })
    return NextResponse.json({ overlay: mapRow(data) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao salvar overlay.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; overlayId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id, overlayId } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStreamWrite(permission)) {
      return NextResponse.json({ error: 'Sem permissão para excluir overlay.' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', overlayId)
      .eq('campeonato_id', id)

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({ error: 'Tabela stream ausente.', missing_table: true }, { status: 503 })
      }
      throw error
    }
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao excluir overlay.' }, { status: 400 })
  }
}
