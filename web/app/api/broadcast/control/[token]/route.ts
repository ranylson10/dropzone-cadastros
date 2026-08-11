import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import {
  asStreamConfigObject,
  asStreamOverlayTypeList,
  normalizeStreamOverlayPackage,
} from '@/features/campeonatos/stream/services/stream-package-config'
import {
  STREAM_SYSTEM_OVERLAY_META,
  STREAM_SYSTEM_OVERLAYS,
  type StreamSystemOverlayType,
} from '@/features/campeonatos/stream/types/stream-package.types'

async function loadPackOverlays(campeonatoId: string | null) {
  if (!campeonatoId) return { pack: null as any, overlays: [] as any[] }

  const { data: pack, error } = await supabaseAdmin
    .from('campeonato_stream_pack')
    .select('enabled_overlay_types,overlay_configs,bg_type,bg_url,updated_at,schema_version')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()

  if (error) throw error
  if (!pack) return { pack: null as any, overlays: [] as any[] }

  const normalized = normalizeStreamOverlayPackage(campeonatoId, pack)
  const enabled = normalized.enabled_overlay_types
  const configs = normalized.overlay_configs
  const overlays = enabled.map((type) => {
    const config = asStreamConfigObject(configs[type])
    return {
      id: type,
      type,
      name: String(config.title || STREAM_SYSTEM_OVERLAY_META[type].name),
      structure: STREAM_SYSTEM_OVERLAY_META[type].structure,
    }
  })

  return {
    pack: {
      ...normalized,
      bg_type: pack.bg_type || 'none',
      bg_url: pack.bg_url || null,
    },
    overlays,
  }
}

async function loadLives(broadcastId: string) {
  const { data: links } = await supabaseAdmin
    .from('broadcast_campeonato_links')
    .select('id,campeonato_id,display_name,created_at')
    .eq('broadcast_id', broadcastId)
    .order('created_at', { ascending: false })

  const champIds = (links || []).map((link) => link.campeonato_id)
  let champs: any[] = []
  if (champIds.length) {
    const { data } = await supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url,status')
      .in('id', champIds)
    champs = data || []
  }
  const byId = new Map(champs.map((champ) => [champ.id, champ]))

  return (links || []).map((link) => ({
    id: link.id,
    campeonato_id: link.campeonato_id,
    display_name: link.display_name,
    campeonato: byId.get(link.campeonato_id) || null,
  }))
}

/**
 * Controlador público da mesa Stream.
 * GET — lives + overlays oficiais habilitadas no pacote selecionado.
 * POST — { campeonato_id } troca a live | { active_overlay_type } troca a cena.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const clean = String(token || '').trim()
    if (!clean || clean.length < 16) return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })

    const { data: session, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('id,broadcast_id,nome,campeonato_id,active_overlay_type,controller_token,obs_token,ativo,updated_at')
      .eq('controller_token', clean)
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
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

    const [lives, packData, champ] = await Promise.all([
      loadLives(session.broadcast_id),
      loadPackOverlays(session.campeonato_id),
      session.campeonato_id
        ? supabaseAdmin.from('campeonatos').select('id,nome,logo_url').eq('id', session.campeonato_id).maybeSingle().then((result) => result.data)
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      session: {
        id: session.id,
        nome: session.nome,
        campeonato_id: session.campeonato_id,
        active_overlay_type: session.active_overlay_type,
        obs_token: session.obs_token,
        updated_at: session.updated_at,
      },
      lives,
      campeonato: champ || null,
      pack: packData.pack,
      overlays: packData.overlays,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const clean = String(token || '').trim()
    if (!clean || clean.length < 16) return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('id,broadcast_id,campeonato_id')
      .eq('controller_token', clean)
      .eq('ativo', true)
      .maybeSingle()

    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (Object.prototype.hasOwnProperty.call(body, 'campeonato_id')) {
      const nextChamp = body.campeonato_id === null || body.campeonato_id === ''
        ? null
        : String(body.campeonato_id || '').trim() || null

      if (nextChamp) {
        const { data: link } = await supabaseAdmin
          .from('broadcast_campeonato_links')
          .select('id')
          .eq('broadcast_id', session.broadcast_id)
          .eq('campeonato_id', nextChamp)
          .maybeSingle()
        if (!link) return NextResponse.json({ error: 'Campeonato não está na lista deste Stream.' }, { status: 403 })
      }

      patch.campeonato_id = nextChamp
      patch.active_overlay_type = null
    }

    if (Object.prototype.hasOwnProperty.call(body, 'active_overlay_type')) {
      const overlayType = body.active_overlay_type === null || body.active_overlay_type === ''
        ? null
        : String(body.active_overlay_type || '').trim() || null

      const champId = (patch.campeonato_id as string | null | undefined) !== undefined
        ? patch.campeonato_id as string | null
        : session.campeonato_id

      if (overlayType) {
        if (!champId) return NextResponse.json({ error: 'Selecione uma live antes da cena.' }, { status: 400 })
        if (!STREAM_SYSTEM_OVERLAYS.includes(overlayType as StreamSystemOverlayType)) {
          return NextResponse.json({ error: 'Tipo de overlay inválido.' }, { status: 400 })
        }

        const { data: pack } = await supabaseAdmin
          .from('campeonato_stream_pack')
          .select('enabled_overlay_types')
          .eq('campeonato_id', champId)
          .maybeSingle()
        const enabled = asStreamOverlayTypeList(pack?.enabled_overlay_types)
        if (!enabled.includes(overlayType as StreamSystemOverlayType)) {
          return NextResponse.json({ error: 'Esta overlay não está habilitada no pacote do campeonato.' }, { status: 400 })
        }
      }

      patch.active_overlay_type = overlayType
    }

    if (Object.keys(patch).length <= 1) {
      return NextResponse.json({ error: 'Nada para atualizar. Envie campeonato_id ou active_overlay_type.' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .update(patch)
      .eq('id', session.id)
      .select('id,campeonato_id,active_overlay_type,updated_at,nome')
      .single()
    if (error) throw error

    const packData = await loadPackOverlays(updated.campeonato_id)
    const champ = updated.campeonato_id
      ? (await supabaseAdmin.from('campeonatos').select('id,nome,logo_url').eq('id', updated.campeonato_id).maybeSingle()).data
      : null

    return NextResponse.json({
      session: updated,
      campeonato: champ,
      pack: packData.pack,
      overlays: packData.overlays,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro' }, { status: 400 })
  }
}
