import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const avatarUrl = String(body.avatar_url || '').trim()

    if (avatarUrl) {
      let parsed: URL
      try {
        parsed = new URL(avatarUrl)
      } catch {
        throw new Error('Endereço da foto inválido.')
      }
      if (parsed.protocol !== 'https:') throw new Error('A foto precisa usar uma conexão segura.')
    }

    const current = user.user_metadata || {}
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...current,
        avatar_url: avatarUrl || null,
        picture: avatarUrl || null,
      },
    })
    if (error) throw error

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: String(data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email || 'Conta DropZone'),
        avatar_url: String(data.user.user_metadata?.avatar_url || ''),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível atualizar a foto da conta.' }, { status: 400 })
  }
}
