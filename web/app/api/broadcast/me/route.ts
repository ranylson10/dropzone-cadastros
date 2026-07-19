import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

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

    const { data: sessions } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('id,campeonato_id,nome,controller_token,obs_token,active_overlay_id,ativo,created_at,updated_at')
      .eq('broadcast_id', profile.id)
      .eq('ativo', true)
      .order('updated_at', { ascending: false })

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        nome: profile.nome,
        papel: profile.papel || 'stream',
        avatar_url: profile.avatar_url,
      },
      links: (links || []).map((l) => ({
        ...l,
        campeonato: byId.get(l.campeonato_id) || null,
      })),
      sessions: sessions || [],
    })
  } catch (e: any) {
    const status = e?.missing_table ? 503 : 400
    return NextResponse.json({ error: e?.message || 'Erro', missing_table: e?.missing_table }, { status })
  }
}
