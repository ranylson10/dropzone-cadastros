import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { packOverlayBlocks, unpackOverlayBlocks } from '@/features/campeonatos/stream/utils/overlay-frame'

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

/**
 * Cria overlay no campeonato a partir de um modelo do catálogo.
 * Respeita entitlement (own / purchase / public).
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: campeonatoId } = await context.params
    const permission = await getCampeonatoPermission(user.id, campeonatoId)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão para criar overlay.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const catalogId = String(body.catalog_id || body.catalogId || '')
    if (!catalogId) return NextResponse.json({ error: 'catalog_id obrigatório.' }, { status: 400 })

    const { data: model, error: e0 } = await supabaseAdmin
      .from('stream_overlay_catalog')
      .select('*')
      .eq('id', catalogId)
      .eq('ativo', true)
      .maybeSingle()
    if (e0) {
      if (missingTable(e0)) {
        return NextResponse.json({ error: 'Catálogo ausente no banco.', missing_table: true }, { status: 503 })
      }
      throw e0
    }
    if (!model) return NextResponse.json({ error: 'Modelo não encontrado.' }, { status: 404 })

    const isOwner = model.owner_user_id === user.id
    const isPublic = model.visibility === 'public'
    let license: 'own' | 'public_clone' | 'purchased' = 'own'

    if (isOwner) {
      license = model.is_purchased_copy ? 'purchased' : 'own'
    } else if (isPublic) {
      license = 'public_clone'
    } else {
      const { data: ent } = await supabaseAdmin
        .from('stream_overlay_entitlements')
        .select('source')
        .eq('catalog_id', catalogId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!ent) {
        return NextResponse.json(
          { error: 'Sem acesso a este modelo. Resgate um código de compra ou use um modelo público.' },
          { status: 403 },
        )
      }
      license = ent.source === 'purchase' ? 'purchased' : 'own'
    }

    const packed = unpackOverlayBlocks(model.blocks)
    const blocks = packOverlayBlocks(packed.blocks, packed.frameW, packed.frameH)
    const nome = String(body.name || body.nome || model.nome || 'Overlay').trim() || 'Overlay'

    const insert: Record<string, unknown> = {
      campeonato_id: campeonatoId,
      nome,
      template: 'custom',
      blocks,
      criado_por: user.id,
      updated_at: new Date().toISOString(),
    }

    // colunas opcionais (migration)
    insert.catalog_source_id = model.source_catalog_id || model.id
    insert.license_kind = license

    let { data, error } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .insert(insert)
      .select('*')
      .single()

    // se colunas novas não existem, tenta sem elas
    if (error && /catalog_source_id|license_kind|column/i.test(error.message || '')) {
      const retry = await supabaseAdmin
        .from('campeonato_stream_overlays')
        .insert({
          campeonato_id: campeonatoId,
          nome,
          template: 'custom',
          blocks,
          criado_por: user.id,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single()
      data = retry.data
      error = retry.error
    }

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Tabela de overlays ausente. Rode o SQL de stream.',
          missing_table: true,
        }, { status: 503 })
      }
      throw error
    }

    const outPacked = unpackOverlayBlocks(data.blocks)
    return NextResponse.json({
      overlay: {
        id: data.id,
        campeonato_id: data.campeonato_id,
        name: data.nome,
        template: data.template || 'custom',
        blocks: outPacked.blocks,
        frameW: outPacked.frameW,
        frameH: outPacked.frameH,
        share_token: data.share_token,
        catalog_source_id: data.catalog_source_id || catalogId,
        license_kind: data.license_kind || license,
        updatedAt: data.updated_at,
      },
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar overlay do catálogo.' }, { status: 400 })
  }
}
