import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertPassword, cleanEmail } from '@/lib/validation'
import { verifyCode } from '@/lib/auth-verification-codes'

function clean(value: unknown) {
  return String(value || '').trim()
}

function friendlyResetError(message: string) {
  if (/invalid token|expired/i.test(message)) return 'Codigo invalido ou expirado.'
  if (/password/i.test(message)) return 'A senha precisa ter pelo menos 8 caracteres, uma letra, um numero e um caractere especial.'
  return message || 'Nao foi possivel redefinir a senha.'
}

async function findProfileAuthUserId(email: string) {
  const tables = ['produtoras', 'equipes', 'jogadores', 'managers', 'broadcasts'] as const
  for (const table of tables) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('auth_user_id')
      .eq('email_contato', email)
      .not('auth_user_id', 'is', null)
      .maybeSingle()
    if (error) throw error
    if (data?.auth_user_id) return String(data.auth_user_id)
  }
  return ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = cleanEmail(body.email)
    const code = clean(body.code)
    const password = assertPassword(body.password)
    const confirmPassword = String(body.confirm_password || '')

    if (!/^\d{6}$/.test(code)) throw new Error('Informe o codigo de 6 digitos.')
    if (password !== confirmPassword) throw new Error('A confirmacao da senha nao confere.')

    await verifyCode({
      email,
      purpose: 'reset_password',
      code,
    })

    const authUserId = await findProfileAuthUserId(email)
    if (!authUserId) throw new Error('Conta nao encontrada para esse e-mail.')

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password })
    if (updateError) throw new Error(friendlyResetError(updateError.message))

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: friendlyResetError(error?.message || 'Nao foi possivel redefinir a senha.') }, { status: 400 })
  }
}
