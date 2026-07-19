import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Controlador de live (token público).
 * GET — estado + lista de overlays
 * POST — { active_overlay_id }
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
      .select('id,nome,campeonato_id,active_overlay_id,controller_token,obs_token,ativo,updated_at')
      .eq('controller_token', clean)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code || '')) {
        return NextResponse.json({ error: 'Broadcast não configurado no banco.' }, { status: 503 })
      }
      throw error
    }
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

    const [{ data: champ }, { data: overlays }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url').eq('id', session.campeonato_id).maybeSingle(),
      supabaseAdmin
        .from('campeonato_stream_overlays')
        .select('id,nome,template,share_token,updated_at,ativo')
        .eq('campeonato_id', session.campeonato_id)
        .eq('ativo', true)
        .order('updated_at', { ascending: false }),
    ])

    return NextResponse.json({
      session: {
        id: session.id,
        nome: session.nome,
        campeonato_id: session.campeonato_id,
        active_overlay_id: session.active_overlay_id,
        obs_token: session.obs_token,
        updated_at: session.updated_at,
      },
      campeonato: champ || null,
      overlays: (overlays || []).map((o) => ({
        id: o.id,
        name: o.nome,
        template: o.template,
        share_token: o.share_token,
        updated_at: o.updated_at,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const clean = String(token || '').trim()
    if (!clean || clean.length < 16) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const overlayId = body.active_overlay_id === null || body.active_overlay_id === ''
      ? null
      : String(body.active_overlay_id || '').trim() || null

    const { data: session, error: sErr } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('id,campeonato_id')
      .eq('controller_token', clean)
      .eq('ativo', true)
      .maybeSingle()

    if (sErr) throw sErr
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

    if (overlayId) {
      const { data: ov } = await supabaseAdmin
        .from('campeonato_stream_overlays')
        .select('id')
        .eq('id', overlayId)
        .eq('campeonato_id', session.campeonato_id)
        .eq('ativo', true)
        .maybeSingle()
      if (!ov) {
        return NextResponse.json({ error: 'Overlay não pertence a este campeonato.' }, { status: 400 })
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .update({
        active_overlay_id: overlayId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .select('id,active_overlay_id,updated_at')
      .single()

    if (error) throw error
    return NextResponse.json({ session: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
