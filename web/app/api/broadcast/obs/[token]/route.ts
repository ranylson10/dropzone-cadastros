import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function asIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x || '').trim()).filter(Boolean)
}

/**
 * OBS Browser Source — resolve sessão e devolve:
 * · overlay ativa (share_token)
 * · catálogo das cenas da live (para o client pré-carregar / cache local)
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const clean = String(token || '').trim()
    if (!clean || clean.length < 16) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
    }

    const { data: session, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('id,nome,campeonato_id,active_overlay_id,updated_at,ativo')
      .eq('obs_token', clean)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code || '')) {
        return NextResponse.json({ error: 'Broadcast não configurado no banco.' }, { status: 503 })
      }
      throw error
    }
    if (!session) return NextResponse.json({ error: 'Sessão OBS não encontrada.' }, { status: 404 })

    const sessionOut = {
      id: session.id,
      nome: session.nome,
      campeonato_id: session.campeonato_id,
      active_overlay_id: session.active_overlay_id,
      updated_at: session.updated_at,
    }

    let catalog: Array<{
      id: string
      name: string
      template: string | null
      share_token: string
      updated_at: string | null
    }> = []

    let packBg: { bg_type: string; bg_url: string | null } = { bg_type: 'none', bg_url: null }

    if (session.campeonato_id) {
      const [{ data: pack }, { data: allOverlays }] = await Promise.all([
        supabaseAdmin
          .from('campeonato_stream_pack')
          .select('selected_overlay_ids,bg_type,bg_url')
          .eq('campeonato_id', session.campeonato_id)
          .maybeSingle(),
        supabaseAdmin
          .from('campeonato_stream_overlays')
          .select('id,nome,template,share_token,updated_at,ativo')
          .eq('campeonato_id', session.campeonato_id)
          .eq('ativo', true),
      ])

      packBg = {
        bg_type: pack?.bg_type || 'none',
        bg_url: pack?.bg_url || null,
      }

      const byId = new Map((allOverlays || []).map((o) => [o.id, o]))
      const selected = asIdList(pack?.selected_overlay_ids)
      const ordered = pack
        ? selected.map((id) => byId.get(id)).filter(Boolean)
        : (allOverlays || [])

      catalog = ordered
        .filter((o: any) => o?.share_token)
        .map((o: any) => ({
          id: o.id,
          name: o.nome,
          template: o.template,
          share_token: o.share_token,
          updated_at: o.updated_at,
        }))
    }

    if (!session.active_overlay_id) {
      return NextResponse.json({
        waiting: true,
        session: sessionOut,
        share_token: null,
        catalog,
        pack: packBg,
      })
    }

    const fromCatalog = catalog.find((c) => c.id === session.active_overlay_id)
    if (fromCatalog) {
      return NextResponse.json({
        waiting: false,
        session: sessionOut,
        overlay: {
          id: fromCatalog.id,
          name: fromCatalog.name,
          template: fromCatalog.template,
          share_token: fromCatalog.share_token,
          updated_at: fromCatalog.updated_at,
        },
        share_token: fromCatalog.share_token,
        catalog,
        pack: packBg,
      })
    }

    const { data: overlay } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .select('id,nome,share_token,template,updated_at')
      .eq('id', session.active_overlay_id)
      .eq('ativo', true)
      .maybeSingle()

    if (!overlay?.share_token) {
      return NextResponse.json({
        waiting: true,
        session: sessionOut,
        share_token: null,
        catalog,
        pack: packBg,
        error: 'Overlay ativa sem token live.',
      })
    }

    return NextResponse.json({
      waiting: false,
      session: sessionOut,
      overlay: {
        id: overlay.id,
        name: overlay.nome,
        template: overlay.template,
        share_token: overlay.share_token,
        updated_at: overlay.updated_at,
      },
      share_token: overlay.share_token,
      catalog,
      pack: packBg,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
