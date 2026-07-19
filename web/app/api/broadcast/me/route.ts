import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { randomBytes } from 'crypto'

function tok() {
  return randomBytes(18).toString('hex')
}

async function getBroadcastProfile(authUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('broadcasts')
    .select('*')
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code || '')) {
      const err: any = new Error('Tabela broadcasts ausente. Rode 20260718_broadcast_stream.sql')
      err.missing_table = true
      throw err
    }
    throw error
  }
  return data
}

/** Garante 1 mesa permanente (controlador + OBS) para o Stream. */
async function ensureDesk(broadcastId: string) {
  const { data: existing, error } = await supabaseAdmin
    .from('broadcast_live_sessions')
    .select('id,campeonato_id,nome,controller_token,obs_token,active_overlay_id,ativo,created_at,updated_at')
    .eq('broadcast_id', broadcastId)
    .eq('ativo', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (existing) {
    await supabaseAdmin
      .from('broadcast_live_sessions')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('broadcast_id', broadcastId)
      .eq('ativo', true)
      .neq('id', existing.id)
    return existing
  }

  const { data: created, error: insErr } = await supabaseAdmin
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
    .select('id,campeonato_id,nome,controller_token,obs_token,active_overlay_id,ativo,created_at,updated_at')
    .single()

  if (insErr) {
    if (insErr.code === '23505') {
      const { data: again } = await supabaseAdmin
        .from('broadcast_live_sessions')
        .select('id,campeonato_id,nome,controller_token,obs_token,active_overlay_id,ativo,created_at,updated_at')
        .eq('broadcast_id', broadcastId)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (again) return again
    }
    throw insErr
  }
  return created
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const profile = await getBroadcastProfile(user.id)
    if (!profile) {
      return NextResponse.json({ error: 'Nenhum perfil Broadcast neste login.' }, { status: 404 })
    }

    const { data: links, error: linksError } = await supabaseAdmin
      .from('broadcast_campeonato_links')
      .select('id,campeonato_id,display_name,stream_key_id,created_at')
      .eq('broadcast_id', profile.id)
      .order('created_at', { ascending: false })

    if (linksError) throw linksError

    const champIds = (links || []).map((l) => l.campeonato_id)
    let champs: any[] = []
    if (champIds.length) {
      const { data } = await supabaseAdmin
        .from('campeonatos')
        .select('id,nome,logo_url,status')
        .in('id', champIds)
      champs = data || []
    }
    const byId = new Map(champs.map((c) => [c.id, c]))

    // packs por campeonato (quantas cenas configuradas)
    let packsByChamp = new Map<string, number>()
    if (champIds.length) {
      const { data: packs } = await supabaseAdmin
        .from('campeonato_stream_pack')
        .select('campeonato_id,selected_overlay_ids')
        .in('campeonato_id', champIds)
      for (const p of packs || []) {
        const n = Array.isArray(p.selected_overlay_ids) ? p.selected_overlay_ids.length : 0
        packsByChamp.set(p.campeonato_id, n)
      }
    }

    let desk = null as any
    try {
      desk = await ensureDesk(profile.id)
    } catch (e: any) {
      // se sessions table missing, still return profile
      if (!['42P01', 'PGRST205'].includes(e?.code || '')) throw e
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        nome: profile.nome,
        papel: profile.papel || 'stream',
        avatar_url: profile.avatar_url,
      },
      desk,
      // compat
      sessions: desk ? [desk] : [],
      links: (links || []).map((l) => ({
        ...l,
        campeonato: byId.get(l.campeonato_id) || null,
        scenes_count: packsByChamp.get(l.campeonato_id) ?? null,
      })),
    })
  } catch (e: any) {
    const status = e?.missing_table ? 503 : 400
    return NextResponse.json({ error: e?.message || 'Erro', missing_table: e?.missing_table }, { status })
  }
}
