import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertProfileType, assertUsername, authEmail, cleanEmail, cleanUsername } from '@/lib/validation'
import { profileTable } from '@backend/auth/server-auth'

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function friendlyLoginError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-mail, login ou senha incorretos.'
  if (/email not confirmed/i.test(message)) return 'Confirme o codigo enviado por e-mail antes de entrar.'
  return message || 'E-mail, login ou senha incorretos.'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const profileType = assertProfileType(body.profile_type)
    const login = cleanText(body.login || body.username)
    const password = String(body.password || '')
    const table = profileTable(profileType)

    if (!login) throw new Error('Informe seu login, ID publico ou e-mail.')
    if (!password) throw new Error('Informe sua senha.')

    const emails: string[] = []

    if (login.includes('@')) {
      emails.push(cleanEmail(login))
    } else {
      let username = cleanUsername(login)
      let emailContato: string | null = null

      if (/^\d+$/.test(login)) {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select('username, email_contato')
          .eq('public_id', Number(login))
          .maybeSingle()
        if (error) throw error
        if (!data?.username) throw new Error('ID publico nao encontrado para esse tipo de perfil.')
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

      if (emailContato) emails.push(emailContato)
      emails.push(authEmail(profileType, username))
    }

    let lastError = 'E-mail, login ou senha incorretos.'

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

    throw new Error(friendlyLoginError(lastError))
  } catch (error: any) {
    return NextResponse.json({ error: friendlyLoginError(error?.message || 'Erro ao entrar.') }, { status: 400 })
  }
}
