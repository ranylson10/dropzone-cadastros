import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { atualizarEstadoTransmissao } from '@backend/campeonatos/stream/transmission-state.service'
import {
  asStreamConfigObject,
  asStreamOverlayTypeList,
  normalizeStreamOverlayPackage,
  normalizeStreamOutputLayouts,
} from '@/features/campeonatos/stream/services/stream-package-config'

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


function missingOutputLayouts(error: any) {
  const message = String(error?.message || '')
  return error?.code === '42703' && message.includes('output_layouts')
}

function missingTransmissionColumns(error: any) {
  const message = String(error?.message || '')
  return message.includes('active_partida_id') || message.includes('live_state_version')
}

function missingPackageColumns(error: any) {
  const message = String(error?.message || '')
  return error?.code === '42703' || [
    'enabled_overlay_types',
    'assets',
    'shared_config',
    'overlay_configs',
    'schema_version',
    'output_layouts',
  ].some((column) => message.includes(column))
}

const PACK_SELECT = 'bg_type,bg_url,active_jogo_id,active_partida_id,live_state_version,enabled_overlay_types,assets,shared_config,overlay_configs,output_layouts,schema_version,updated_at'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

    const [{ data: pack, error }, { data: jogos }] = await Promise.all([
      supabaseAdmin
        .from('campeonato_stream_pack')
        .select(PACK_SELECT)
        .eq('campeonato_id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('campeonato_jogos')
        .select('id,nome,status,data_jogo,horario,numero_partidas')
        .eq('campeonato_id', id)
        .order('data_jogo', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
    ])

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260719_broadcast_desk_e_pack.sql',
          missing_table: true,
        }, { status: 503 })
      }
      if (missingOutputLayouts(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260811_stream_output_layouts.sql',
          needs_package_sql: true,
          needs_output_layouts_sql: true,
        }, { status: 503 })
      }
      if (missingTransmissionColumns(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260829_stream_transmission_state.sql',
          needs_transmission_state_sql: true,
        }, { status: 503 })
      }
      if (missingPackageColumns(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260810_stream_overlay_package_model.sql',
          needs_package_sql: true,
        }, { status: 503 })
      }
      if (String(error.message || '').includes('active_jogo_id')) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260719_stream_active_jogo.sql',
          needs_active_jogo_sql: true,
        }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({
      pack: {
        bg_type: pack?.bg_type || 'none',
        bg_url: pack?.bg_url || null,
        active_jogo_id: pack?.active_jogo_id || null,
        active_partida_id: pack?.active_partida_id || null,
        live_state_version: Number(pack?.live_state_version || 0),
        updated_at: pack?.updated_at || null,
        ...normalizeStreamOverlayPackage(id, pack),
      },
      jogos: (jogos || []).map((jogo) => ({
        id: jogo.id,
        nome: jogo.nome,
        status: jogo.status,
        data_jogo: jogo.data_jogo,
        horario: jogo.horario,
        numero_partidas: jogo.numero_partidas,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const hasEnabledOverlayTypes = Object.prototype.hasOwnProperty.call(body, 'enabled_overlay_types')
    const hasAssets = Object.prototype.hasOwnProperty.call(body, 'assets')
    const hasSharedConfig = Object.prototype.hasOwnProperty.call(body, 'shared_config')
    const hasOverlayConfigs = Object.prototype.hasOwnProperty.call(body, 'overlay_configs')
    const hasSchemaVersion = Object.prototype.hasOwnProperty.call(body, 'schema_version')
    const hasOutputLayouts = Object.prototype.hasOwnProperty.call(body, 'output_layouts')
    const hasBgType = Object.prototype.hasOwnProperty.call(body, 'bg_type')
    const hasBgUrl = Object.prototype.hasOwnProperty.call(body, 'bg_url')
    const bgTypeRaw = String(body.bg_type || 'none').toLowerCase()
    const bgType = (['none', 'image', 'video'].includes(bgTypeRaw) ? bgTypeRaw : 'none') as 'none' | 'image' | 'video'
    const bgUrl = body.bg_url === null || body.bg_url === ''
      ? null
      : String(body.bg_url || '').trim().slice(0, 2000) || null

    let activeJogoId: string | null | undefined
    if (Object.prototype.hasOwnProperty.call(body, 'active_jogo_id')) {
      const raw = body.active_jogo_id
      if (raw === null || raw === '' || raw === 'auto') {
        activeJogoId = null
      } else {
        activeJogoId = String(raw).trim() || null
        if (activeJogoId) {
          const { data: jogoOk } = await supabaseAdmin
            .from('campeonato_jogos')
            .select('id')
            .eq('id', activeJogoId)
            .eq('campeonato_id', id)
            .maybeSingle()
          if (!jogoOk) return NextResponse.json({ error: 'Jogo inválido para este campeonato.' }, { status: 400 })
        }
      }
    }

    if (hasBgType && bgType !== 'none' && !bgUrl) {
      return NextResponse.json({ error: 'Informe a URL do fundo (PNG ou vídeo).' }, { status: 400 })
    }

    const row: Record<string, unknown> = {
      campeonato_id: id,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    if (hasBgType) row.bg_type = bgType
    if (hasBgType) row.bg_url = bgType === 'none' ? null : bgUrl
    else if (hasBgUrl) row.bg_url = bgUrl
    if (activeJogoId !== undefined) {
      await atualizarEstadoTransmissao(id, user.id, {
        activeJogoId,
        activePartidaId: undefined,
      })
    }
    if (hasEnabledOverlayTypes) row.enabled_overlay_types = asStreamOverlayTypeList(body.enabled_overlay_types)
    if (hasAssets) row.assets = asStreamConfigObject(body.assets)
    if (hasSharedConfig) row.shared_config = asStreamConfigObject(body.shared_config)
    if (hasOverlayConfigs) row.overlay_configs = asStreamConfigObject(body.overlay_configs)
    if (hasOutputLayouts) row.output_layouts = normalizeStreamOutputLayouts(body.output_layouts)
    if (hasSchemaVersion) row.schema_version = Math.max(3, Number(body.schema_version) || 3)

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_pack')
      .upsert(row, { onConflict: 'campeonato_id' })
      .select(PACK_SELECT)
      .single()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260719_broadcast_desk_e_pack.sql',
          missing_table: true,
        }, { status: 503 })
      }
      if (missingOutputLayouts(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260811_stream_output_layouts.sql',
          needs_package_sql: true,
          needs_output_layouts_sql: true,
        }, { status: 503 })
      }
      if (missingTransmissionColumns(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260829_stream_transmission_state.sql',
          needs_transmission_state_sql: true,
        }, { status: 503 })
      }
      if (missingPackageColumns(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260810_stream_overlay_package_model.sql',
          needs_package_sql: true,
        }, { status: 503 })
      }
      if (String(error.message || '').includes('active_jogo_id')) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260719_stream_active_jogo.sql',
          needs_active_jogo_sql: true,
        }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({
      pack: {
        bg_type: data.bg_type || 'none',
        bg_url: data.bg_url || null,
        active_jogo_id: data.active_jogo_id || null,
        active_partida_id: data.active_partida_id || null,
        live_state_version: Number(data.live_state_version || 0),
        updated_at: data.updated_at,
        ...normalizeStreamOverlayPackage(id, data),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 400 })
  }
}
