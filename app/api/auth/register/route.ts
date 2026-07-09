import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assertProfileType, assertUsername, authEmail, cleanEmail } from '@/lib/validation'
import { profileTable } from '@/lib/server-auth'

const TYPE_PREFIX = {
  produtora: 'PD',
  equipe: 'EQ',
  manager: 'MN',
  jogador: 'JG',
} as const

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const profileType = assertProfileType(body.profile_type)
    const username = assertUsername(body.username)
    const name = String(body.name || '').trim()
    const password = String(body.password || '')
    const emailContato = body.email ? cleanEmail(body.email) : null
    const mediaUrl = String(body.media_url || '').trim() || null

    if (!name) throw new Error('Informe o nome.')
    if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')

    const table = profileTable(profileType)

    const { data: existingLogin } = await supabaseAdmin
      .from(table)
      .select('id')
      .ilike('username', username)
      .maybeSingle()

    if (existingLogin) throw new Error('Esse login ja existe para esse tipo de perfil.')

    if (emailContato) {
      const { data: existingEmail } = await supabaseAdmin
        .from(table)
        .select('id')
        .eq('email_contato', emailContato)
        .maybeSingle()
      if (existingEmail) throw new Error('Esse e-mail ja tem uma conta desse tipo.')
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
        email_contato: emailContato,
      },
    })

    if (userError || !userData.user) throw new Error(userError?.message || 'Nao foi possivel criar o usuario.')

    const payload: Record<string, any> = {
      auth_user_id: userData.user.id,
      username,
      nome_exibido: name,
      email_contato: emailContato,
      email_verificado: false,
      status: 'ativo',
    }

    if (mediaUrl) {
      if (profileType === 'produtora' || profileType === 'equipe') payload.logo_url = mediaUrl
      else payload.avatar_url = mediaUrl
    }

    if (profileType !== 'jogador') {
      payload.public_id_prefix = TYPE_PREFIX[profileType]
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from(table)
      .insert(payload)
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
