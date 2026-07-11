import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertProfileType, assertUsername, authEmail, cleanEmail, cleanUsername } from '@/lib/validation'
import { profileTable } from '@backend/auth/server-auth'

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
    let emailContato: string | null = null

    if (/^\d+$/.test(login)) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('username, email_contato')
        .eq('public_id', Number(login))
        .maybeSingle()
      if (error) throw new Error('Login por ID público ainda não está disponível para esse perfil.')
      if (!data?.username) throw new Error('ID público não encontrado para esse tipo de perfil.')
      username = data.username
      emailContato = data.email_contato ? cleanEmail(data.email_contato) : null
    } else {
      username = assertUsername(login)
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('email_contato')
        .ilike('username', username)
        .maybeSingle()
      if (error) throw error
      emailContato = data?.email_contato ? cleanEmail(data.email_contato) : null
    }

    const emails = [emailContato, authEmail(profileType, username)].filter(Boolean) as string[]
    let lastError = 'Login ou senha inválidos.'

    for (const email of [...new Set(emails)]) {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
      if (!error && data.session) {
        return NextResponse.json({
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          },
        })
      }
      lastError = error?.message || lastError
    }

    throw new Error(lastError === 'Invalid login credentials' ? 'Login ou senha inválidos.' : lastError)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao entrar.' }, { status: 400 })
  }
}
