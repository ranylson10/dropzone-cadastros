import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { randomBytes } from 'crypto'

function tok() {
  return randomBytes(18).toString('hex')
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const { data: broadcast } = await supabaseAdmin
      .from('broadcasts')
      .select('id')
      .eq('auth_user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!broadcast) {
      return NextResponse.json({ error: 'Perfil Broadcast não encontrado.' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('*')
      .eq('broadcast_id', broadcast.id)
      .eq('ativo', true)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ sessions: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

/** POST — cria sessão de live (controlador + OBS) para um campeonato da lista. */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonato_id || '').trim()
    const nome = String(body.nome || 'Live').trim().slice(0, 80) || 'Live'
    if (!campeonatoId) {
      return NextResponse.json({ error: 'campeonato_id obrigatório.' }, { status: 400 })
    }

    const { data: broadcast } = await supabaseAdmin
      .from('broadcasts')
      .select('id')
      .eq('auth_user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!broadcast) {
      return NextResponse.json({ error: 'Perfil Broadcast não encontrado.' }, { status: 404 })
    }

    const { data: link } = await supabaseAdmin
      .from('broadcast_campeonato_links')
      .select('id')
      .eq('broadcast_id', broadcast.id)
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()

    if (!link) {
      return NextResponse.json({ error: 'Campeonato não está na sua lista. Resgate a chave primeiro.' }, { status: 403 })
    }

    // primeira overlay do campeonato como ativa (se houver)
    const { data: firstOverlay } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .select('id')
      .eq('campeonato_id', campeonatoId)
      .eq('ativo', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: session, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .insert({
        broadcast_id: broadcast.id,
        campeonato_id: campeonatoId,
        nome,
        controller_token: tok(),
        obs_token: tok(),
        active_overlay_id: firstOverlay?.id || null,
        ativo: true,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ session })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
