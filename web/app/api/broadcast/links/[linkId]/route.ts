import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'


export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ linkId: string }> },
) {
  try {
    const user = await getBearerUser(req)
    const { linkId } = await context.params
    const body = await req.json().catch(() => ({}))
    const displayName = String(body.display_name || body.nome || '').trim().slice(0, 80)

    if (!displayName) {
      return NextResponse.json({ error: 'Informe um nome para identificar este campeonato.' }, { status: 400 })
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

    const { data: link, error } = await supabaseAdmin
      .from('broadcast_campeonato_links')
      .update({ display_name: displayName })
      .eq('id', linkId)
      .eq('broadcast_id', broadcast.id)
      .select('id,campeonato_id,display_name,stream_key_id,created_at')
      .maybeSingle()

    if (error) throw error
    if (!link) {
      return NextResponse.json({ error: 'Campeonato não encontrado na sua lista.' }, { status: 404 })
    }

    return NextResponse.json({ link })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ linkId: string }> },
) {
  try {
    const user = await getBearerUser(req)
    const { linkId } = await context.params

    const { data: broadcast } = await supabaseAdmin
      .from('broadcasts')
      .select('id')
      .eq('auth_user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!broadcast) {
      return NextResponse.json({ error: 'Perfil Broadcast não encontrado.' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('broadcast_campeonato_links')
      .delete()
      .eq('id', linkId)
      .eq('broadcast_id', broadcast.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
