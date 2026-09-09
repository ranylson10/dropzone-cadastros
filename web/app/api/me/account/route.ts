import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertUsername } from '@/lib/validation'

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const hasAvatar = body.avatar_url !== undefined
    const hasUsername = body.username !== undefined
    const hasDisplayName = body.display_name !== undefined
    const avatarUrl = hasAvatar ? String(body.avatar_url || '').trim() : String(user.user_metadata?.avatar_url || user.user_metadata?.picture || '').trim()
    const username = hasUsername
      ? assertUsername(body.username)
      : String(user.user_metadata?.account_username || '').trim().replace(/^@+/, '').toLowerCase()
    const displayName = hasDisplayName
      ? String(body.display_name || '').trim()
      : String(user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || '').trim()

    if (hasDisplayName && (displayName.length < 2 || displayName.length > 60)) {
      throw new Error('O nome de exibição deve ter entre 2 e 60 caracteres.')
    }

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
    const nextMetadata = {
      ...current,
      ...(hasUsername ? { account_username: username } : {}),
      ...(hasDisplayName ? { display_name: displayName, full_name: displayName, name: displayName } : {}),
      ...(hasAvatar ? { avatar_url: avatarUrl || null, picture: avatarUrl || null } : {}),
    }
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: nextMetadata,
    })
    if (error) {
      if (/duplicate|unique|account_identities_username_unique/i.test(error.message)) {
        throw new Error('Este @usuário já está em uso.')
      }
      throw error
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: String(data.user.user_metadata?.display_name || data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email || 'Conta DropZone'),
        username: String(data.user.user_metadata?.account_username || ''),
        avatar_url: String(data.user.user_metadata?.avatar_url || ''),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível atualizar a conta.' }, { status: 400 })
  }
}
