import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertPassword, assertProfileType, assertUsername, cleanEmail } from '@/lib/validation'
import { profileTable } from '@backend/auth/server-auth'

function clean(value: unknown) {
  return String(value || '').trim()
}

function maskEmail(email: string) {
  return email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
}

async function assertEmailAvailable(email: string) {
  const tables = ['produtoras', 'equipes', 'jogadores', 'managers'] as const
  for (const table of tables) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('id')
      .eq('email_contato', email)
      .maybeSingle()
    if (error) throw error
    if (data) throw new Error('Esse e-mail ja esta vinculado a uma conta. Use login ou recupere a senha.')
  }
}

function friendlyEmailError(message: string) {
  if (/rate limit|too many/i.test(message)) return 'Muitas tentativas de envio. Aguarde um pouco antes de reenviar o codigo.'
  if (/invalid email/i.test(message)) return 'Informe um e-mail valido.'
  if (/password/i.test(message)) return 'A senha precisa ter pelo menos 8 caracteres, uma letra, um numero e um caractere especial.'
  return message || 'Nao foi possivel enviar o codigo.'
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const purpose = clean(body.purpose)
    const isResend = Boolean(body.resend)
    const profileType = purpose === 'register' ? assertProfileType(body.profile_type) : null

    if (purpose === 'register') {
      const username = assertUsername(body.username)
      const email = cleanEmail(body.email)
      const password = assertPassword(body.password)
      const confirmPassword = String(body.confirm_password || '')

      if (password !== confirmPassword) throw new Error('A confirmacao da senha nao confere.')

      await assertEmailAvailable(email)

      const table = profileTable(profileType!)
      const { data: existingUsername, error: usernameError } = await supabaseAdmin
        .from(table)
        .select('id')
        .ilike('username', username)
        .maybeSingle()
      if (usernameError) throw usernameError
      if (existingUsername) throw new Error('Esse login ja existe.')

      const { error } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            profile_type: profileType,
            username,
            requested_flow: isResend ? 'register_resend' : 'register',
          },
        },
      })
      if (error) throw new Error(friendlyEmailError(error.message))

      return NextResponse.json({ ok: true, email_hint: maskEmail(email) })
    }

    if (purpose === 'reset_password') {
      const email = cleanEmail(body.email)
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email)
      if (error) throw new Error(friendlyEmailError(error.message))
      return NextResponse.json({ ok: true, email_hint: maskEmail(email) })
    }

    throw new Error('Finalidade de verificacao invalida.')
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Nao foi possivel enviar o codigo.' }, { status: 400 })
  }
}
