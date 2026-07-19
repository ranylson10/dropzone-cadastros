import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * OBS Browser Source — resolve sessão e devolve a overlay ativa.
 * O cliente usa share_token com /api/stream/live/[token] para o payload completo.
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

    if (!session.active_overlay_id) {
      return NextResponse.json({
        waiting: true,
        session: {
          id: session.id,
          nome: session.nome,
          campeonato_id: session.campeonato_id,
          active_overlay_id: null,
          updated_at: session.updated_at,
        },
        share_token: null,
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
        session: {
          id: session.id,
          nome: session.nome,
          campeonato_id: session.campeonato_id,
          active_overlay_id: session.active_overlay_id,
          updated_at: session.updated_at,
        },
        share_token: null,
        error: 'Overlay ativa sem token live.',
      })
    }

    return NextResponse.json({
      waiting: false,
      session: {
        id: session.id,
        nome: session.nome,
        campeonato_id: session.campeonato_id,
        active_overlay_id: session.active_overlay_id,
        updated_at: session.updated_at,
      },
      overlay: {
        id: overlay.id,
        name: overlay.nome,
        template: overlay.template,
        share_token: overlay.share_token,
        updated_at: overlay.updated_at,
      },
      share_token: overlay.share_token,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
