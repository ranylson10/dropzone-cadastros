import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertProfileType, assertUsername, cleanEmail } from '@/lib/validation'
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
    if (data) throw new Error('Esse e-mail já está vinculado a uma conta.')
  }
}

async function findAccount(profileType: string, login: string) {
  const table = profileTable(assertProfileType(profileType))
  let query = supabaseAdmin.from(table).select('auth_user_id, email_contato, username')
  if (/^\d+$/.test(login)) query = query.eq('public_id', Number(login))
  else query = query.ilike('username', login)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data?.auth_user_id || !data?.email_contato) {
    throw new Error('Conta não encontrada ou sem e-mail cadastrado.')
  }
  return data
}

async function ensureRealAuthEmail(authUserId: string, email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(authUserId)
  if (error || !data.user) throw new Error(error?.message || 'Usuário de autenticação não encontrado.')

  if (data.user.email?.toLowerCase() === email.toLowerCase()) return

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
    email,
    email_confirm: true,
  })
  if (updateError) {
    throw new Error('Não foi possível preparar este e-mail para recuperação. Verifique se ele já está sendo usado por outra conta.')
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const purpose = clean(body.purpose)
    const profileType = purpose === 'register' ? assertProfileType(body.profile_type) : null

    if (purpose === 'register') {
      const username = assertUsername(body.username)
      const email = cleanEmail(body.email)
      const password = String(body.password || '')
      const confirmPassword = String(body.confirm_password || '')

      if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
      if (password !== confirmPassword) throw new Error('A confirmação da senha não confere.')

      await assertEmailAvailable(email)

      const table = profileTable(profileType!)
      const { data: existingUsername, error: usernameError } = await supabaseAdmin
        .from(table)
        .select('id')
        .ilike('username', username)
        .maybeSingle()
      if (usernameError) throw usernameError
      if (existingUsername) throw new Error('Esse login já existe.')

      const { error } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            profile_type: profileType,
            username,
          },
        },
      })
      if (error) throw new Error(error.message)

      return NextResponse.json({ ok: true, email_hint: maskEmail(email) })
    }

    if (purpose === 'reset_password') {
      const email = cleanEmail(body.email)
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, email_hint: maskEmail(email) })
    }

    throw new Error('Finalidade de verificação inválida.')
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível enviar o código.' }, { status: 400 })
  }
}
