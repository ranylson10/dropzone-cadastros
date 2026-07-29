import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { randomBytes } from 'crypto'

function tok() {
  return randomBytes(18).toString('hex')
}

async function getBroadcastId(authUserId: string) {
  const { data: broadcast } = await supabaseAdmin
    .from('broadcasts')
    .select('id')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle()
  return broadcast?.id as string | undefined
}

/**
 * Garante 1 mesa (controlador + OBS) por perfil Stream.
 * Tokens são estáveis — não mudam ao trocar de campeonato.
 */
async function ensureDesk(broadcastId: string) {
  const { data: existing, error: findErr } = await supabaseAdmin
    .from('broadcast_live_sessions')
    .select('*')
    .eq('broadcast_id', broadcastId)
    .eq('ativo', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findErr) {
    if (['42P01', 'PGRST205'].includes(findErr.code || '')) {
      const err: any = new Error('Rode o SQL de broadcast no Supabase.')
      err.missing_table = true
      throw err
    }
    throw findErr
  }

  if (existing) {
    // desativa duplicatas antigas (modelo antigo: 1 sessão por campeonato)
    await supabaseAdmin
      .from('broadcast_live_sessions')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('broadcast_id', broadcastId)
      .eq('ativo', true)
      .neq('id', existing.id)

    return existing
  }

  const { data: session, error } = await supabaseAdmin
    .from('broadcast_live_sessions')
    .insert({
      broadcast_id: broadcastId,
      campeonato_id: null,
      nome: 'Mesa Stream',
      controller_token: tok(),
      obs_token: tok(),
      active_overlay_id: null,
      ativo: true,
    })
    .select('*')
    .single()

  if (error) {
    // corrida: índice único — re-lê
    if (error.code === '23505') {
      const { data: again } = await supabaseAdmin
        .from('broadcast_live_sessions')
        .select('*')
        .eq('broadcast_id', broadcastId)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (again) return again
    }
    throw error
  }
  return session
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const broadcastId = await getBroadcastId(user.id)
    if (!broadcastId) {
      return NextResponse.json({ error: 'Perfil Broadcast não encontrado.' }, { status: 404 })
    }

    const desk = await ensureDesk(broadcastId)
    return NextResponse.json({ desk, sessions: desk ? [desk] : [] })
  } catch (e: any) {
    const status = e?.missing_table ? 503 : 400
    return NextResponse.json({ error: e?.message || 'Erro', missing_table: e?.missing_table }, { status })
  }
}

/**
 * POST — garante mesa única (sem campeonato).
 * Body opcional: { campeonato_id } para já selecionar a live.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonato_id || '').trim() || null

    const broadcastId = await getBroadcastId(user.id)
    if (!broadcastId) {
      return NextResponse.json({ error: 'Perfil Broadcast não encontrado.' }, { status: 404 })
    }

    let desk = await ensureDesk(broadcastId)

    if (campeonatoId) {
      const { data: link } = await supabaseAdmin
        .from('broadcast_campeonato_links')
        .select('id')
        .eq('broadcast_id', broadcastId)
        .eq('campeonato_id', campeonatoId)
        .maybeSingle()

      if (!link) {
        return NextResponse.json(
          { error: 'Campeonato não está na sua lista. Resgate a chave primeiro.' },
          { status: 403 },
        )
      }

      const { data: updated, error } = await supabaseAdmin
        .from('broadcast_live_sessions')
        .update({
          campeonato_id: campeonatoId,
          active_overlay_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', desk.id)
        .select('*')
        .single()

      if (error) throw error
      desk = updated
    }

    return NextResponse.json({ desk, session: desk })
  } catch (e: any) {
    const status = e?.missing_table ? 503 : 400
    return NextResponse.json({ error: e?.message || 'Erro', missing_table: e?.missing_table }, { status })
  }
}


/**
 * PATCH — mantém a mesa Stream sem expor sessões de outros perfis.
 * Permite renomear, trocar/limpar campeonato, limpar overlay e regenerar tokens.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const broadcastId = await getBroadcastId(user.id)
    if (!broadcastId) {
      return NextResponse.json({ error: 'Perfil Broadcast não encontrado.' }, { status: 404 })
    }

    const desk = await ensureDesk(broadcastId)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (Object.prototype.hasOwnProperty.call(body, 'nome')) {
      const nome = String(body.nome || '').trim()
      if (!nome || nome.length > 80) {
        return NextResponse.json({ error: 'Nome da mesa deve ter entre 1 e 80 caracteres.' }, { status: 400 })
      }
      updates.nome = nome
    }

    if (Object.prototype.hasOwnProperty.call(body, 'campeonato_id')) {
      const campeonatoId = String(body.campeonato_id || '').trim() || null
      if (campeonatoId) {
        const { data: link, error: linkError } = await supabaseAdmin
          .from('broadcast_campeonato_links')
          .select('id')
          .eq('broadcast_id', broadcastId)
          .eq('campeonato_id', campeonatoId)
          .maybeSingle()
        if (linkError) throw linkError
        if (!link) {
          return NextResponse.json({ error: 'Campeonato não pertence à sua lista de transmissão.' }, { status: 403 })
        }
      }
      updates.campeonato_id = campeonatoId
      updates.active_overlay_id = null
    }

    if (body.clear_overlay === true) updates.active_overlay_id = null
    if (body.regenerate_controller_token === true) updates.controller_token = tok()
    if (body.regenerate_obs_token === true) updates.obs_token = tok()

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'Nenhuma alteração válida foi informada.' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .update(updates)
      .eq('id', desk.id)
      .eq('broadcast_id', broadcastId)
      .eq('ativo', true)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ desk: updated, session: updated })
  } catch (e: any) {
    const status = e?.missing_table ? 503 : 400
    return NextResponse.json({ error: e?.message || 'Erro', missing_table: e?.missing_table }, { status })
  }
}

/**
 * DELETE — encerra a mesa atual e invalida imediatamente os links/tokens antigos.
 * Uma nova mesa será criada automaticamente no próximo acesso autenticado.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const broadcastId = await getBroadcastId(user.id)
    if (!broadcastId) {
      return NextResponse.json({ error: 'Perfil Broadcast não encontrado.' }, { status: 404 })
    }

    const { data: sessions, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .update({ ativo: false, campeonato_id: null, active_overlay_id: null, updated_at: new Date().toISOString() })
      .eq('broadcast_id', broadcastId)
      .eq('ativo', true)
      .select('id')

    if (error) throw error
    return NextResponse.json({ ok: true, encerradas: sessions?.length || 0 })
  } catch (e: any) {
    const status = e?.missing_table ? 503 : 400
    return NextResponse.json({ error: e?.message || 'Erro', missing_table: e?.missing_table }, { status })
  }
}
