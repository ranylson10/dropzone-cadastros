import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { normalizeStreamOverlayPackage } from '@/features/campeonatos/stream/services/stream-package-config'
import { loadPublicStreamPackageRenderData } from '@/features/campeonatos/stream/services/stream-package-public.service'
import {
  STREAM_SYSTEM_OVERLAY_META,
  STREAM_SYSTEM_OVERLAYS,
  type StreamSystemOverlayType,
} from '@/features/campeonatos/stream/types/stream-package.types'

/**
 * OBS Browser Source do novo pacote.
 * GET normal: estado leve da mesa + pacote.
 * GET ?data=1: inclui os dados reais apenas da cena atualmente no ar.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const clean = String(token || '').trim()
    if (!clean || clean.length < 16) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
    }

    const { data: session, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('id,nome,campeonato_id,active_overlay_type,updated_at,ativo')
      .eq('obs_token', clean)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code || '')) {
        return NextResponse.json({ error: 'Broadcast não configurado no banco.' }, { status: 503 })
      }
      if (error.code === '42703') {
        return NextResponse.json({ error: 'Rode a migration 20260810_stream_package_broadcast_runtime.sql.' }, { status: 503 })
      }
      throw error
    }
    if (!session) return NextResponse.json({ error: 'Sessão OBS não encontrada.' }, { status: 404 })

    const sessionOut = {
      id: session.id,
      nome: session.nome,
      campeonato_id: session.campeonato_id,
      active_overlay_type: session.active_overlay_type,
      updated_at: session.updated_at,
    }

    if (!session.campeonato_id) {
      return NextResponse.json({ waiting: true, session: sessionOut, pack: null, overlay: null, data: null })
    }

    const { data: packRow, error: packError } = await supabaseAdmin
      .from('campeonato_stream_pack')
      .select('enabled_overlay_types,assets,shared_config,overlay_configs,schema_version,bg_type,bg_url,updated_at')
      .eq('campeonato_id', session.campeonato_id)
      .maybeSingle()

    if (packError) throw packError
    if (!packRow) {
      return NextResponse.json({
        waiting: true,
        session: sessionOut,
        pack: null,
        overlay: null,
        data: null,
        error: 'O campeonato ainda não possui um pacote de overlays configurado.',
      })
    }

    const pack = {
      ...normalizeStreamOverlayPackage(session.campeonato_id, packRow),
      bg_type: packRow.bg_type || 'none',
      bg_url: packRow.bg_url || null,
    }

    const activeType = session.active_overlay_type
      && STREAM_SYSTEM_OVERLAYS.includes(session.active_overlay_type as StreamSystemOverlayType)
      ? session.active_overlay_type as StreamSystemOverlayType
      : null

    const enabled = new Set(pack.enabled_overlay_types)
    const safeType = activeType && enabled.has(activeType) ? activeType : null
    const includeData = req.nextUrl.searchParams.get('data') === '1'

    const data = includeData && safeType
      ? await loadPublicStreamPackageRenderData(session.campeonato_id, safeType)
      : null

    return NextResponse.json({
      waiting: !safeType,
      session: sessionOut,
      pack,
      overlay: safeType
        ? {
            type: safeType,
            name: pack.overlay_configs[safeType]?.title || STREAM_SYSTEM_OVERLAY_META[safeType].name,
            structure: STREAM_SYSTEM_OVERLAY_META[safeType].structure,
          }
        : null,
      data,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
