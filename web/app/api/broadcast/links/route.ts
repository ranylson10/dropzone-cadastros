import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

async function getBroadcast(authUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('broadcasts')
    .select('id,papel')
    .eq('auth_user_id', authUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/** POST — resgata chave do campeonato e adiciona à lista do Stream. */
export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const broadcast = await getBroadcast(user.id)
    if (!broadcast) {
      return NextResponse.json({ error: 'Perfil Broadcast não encontrado.' }, { status: 404 })
    }
    if (broadcast.papel && broadcast.papel !== 'stream') {
      // outros papéis podem no futuro; por ora só stream resgata chave
      return NextResponse.json({ error: 'Apenas o papel Stream resgata chave de campeonato neste MVP.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const keyToken = String(body.key_token || body.key || '').trim().toLowerCase()
    const displayName = String(body.display_name || body.nome || '').trim().slice(0, 80)
    if (!keyToken || keyToken.length < 8) {
      return NextResponse.json({ error: 'Informe a chave Stream do campeonato.' }, { status: 400 })
    }
    if (!displayName) {
      return NextResponse.json({ error: 'Informe um nome para identificar este campeonato na sua lista.' }, { status: 400 })
    }

    const { data: keyRow, error: keyError } = await supabaseAdmin
      .from('campeonato_stream_keys')
      .select('id,campeonato_id,ativo')
      .eq('key_token', keyToken)
      .maybeSingle()

    if (keyError) {
      if (['42P01', 'PGRST205'].includes(keyError.code || '')) {
        return NextResponse.json({ error: 'SQL de broadcast não aplicado no Supabase.', missing_table: true }, { status: 503 })
      }
      throw keyError
    }
    if (!keyRow || !keyRow.ativo) {
      return NextResponse.json({ error: 'Chave inválida ou desativada.' }, { status: 404 })
    }

    const { data: champ } = await supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url,status')
      .eq('id', keyRow.campeonato_id)
      .maybeSingle()

    if (!champ) {
      return NextResponse.json({ error: 'Campeonato da chave não encontrado.' }, { status: 404 })
    }

    const { data: link, error: linkError } = await supabaseAdmin
      .from('broadcast_campeonato_links')
      .upsert(
        {
          broadcast_id: broadcast.id,
          campeonato_id: keyRow.campeonato_id,
          stream_key_id: keyRow.id,
          display_name: displayName,
        },
        { onConflict: 'broadcast_id,campeonato_id' },
      )
      .select('id,campeonato_id,display_name,stream_key_id,created_at')
      .single()

    if (linkError) throw linkError

    return NextResponse.json({
      link: { ...link, campeonato: champ },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
