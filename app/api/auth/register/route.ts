import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assertProfileType, assertUsername, authEmail } from '@/lib/validation'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const profileType = assertProfileType(body.profile_type)
    const username = assertUsername(body.username)
    const name = String(body.name || '').trim()
    const password = String(body.password || '')

    if (!name) throw new Error('Informe o nome.')
    if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')

    const { data: existing } = await supabaseAdmin
      .from('DropZone')
      .select('id')
      .eq('entity_type', 'account')
      .eq('profile_type', profileType)
      .ilike('username', username)
      .maybeSingle()

    if (existing) {
      throw new Error('Esse arroba ja existe para esse tipo de perfil.')
    }

    const email = authEmail(profileType, username)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        profile_type: profileType,
        username,
        display_name: name,
      },
    })

    if (userError || !userData.user) {
      throw new Error(userError?.message || 'Nao foi possivel criar o usuario.')
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('DropZone')
      .insert({
        entity_type: 'account',
        auth_user_id: userData.user.id,
        profile_type: profileType,
        username,
        name,
        created_by: userData.user.id,
        data: {
          email_login: email,
        },
      })
      .select('*')
      .single()

    if (accountError) {
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id)
      throw new Error(accountError.message)
    }

    return NextResponse.json({ account })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao cadastrar.' }, { status: 400 })
  }
}
