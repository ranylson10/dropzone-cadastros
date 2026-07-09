import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assertProfileType, assertUsername, authEmail, cleanUsername } from '@/lib/validation'
import { profileTable } from '@/lib/server-auth'

function cleanText(value: unknown) {
  return String(value || '').trim()
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const profileType = assertProfileType(body.profile_type)
    const login = cleanText(body.login || body.username)
    const password = String(body.password || '')
    const table = profileTable(profileType)

    if (!login) throw new Error('Informe seu login.')
    if (!password) throw new Error('Informe sua senha.')

    let username = cleanUsername(login)

    if (/^\d+$/.test(login)) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('username')
        .eq('public_id', Number(login))
        .maybeSingle()
      if (error) throw new Error('Login por ID publico ainda nao esta disponivel para esse perfil.')
      if (!data?.username) throw new Error('ID publico nao encontrado para esse tipo de perfil.')
      username = data.username
    } else {
      username = assertUsername(login)
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: authEmail(profileType, username),
      password,
    })

    if (error || !data.session) throw new Error(error?.message || 'Login invalido.')

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao entrar.' }, { status: 400 })
  }
}
