import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertPassword, cleanEmail } from '@/lib/validation'

function clean(value: unknown) {
  return String(value || '').trim()
}

function friendlyResetError(message: string) {
  if (/invalid token|expired/i.test(message)) return 'Codigo invalido ou expirado.'
  if (/password/i.test(message)) return 'A senha precisa ter pelo menos 8 caracteres, uma letra, um numero e um caractere especial.'
  return message || 'Nao foi possivel redefinir a senha.'
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

    const { data: verified, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    })
    if (verifyError || !verified.user) throw new Error(friendlyResetError(verifyError?.message || 'Codigo invalido ou expirado.'))

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(verified.user.id, { password })
    if (updateError) throw new Error(friendlyResetError(updateError.message))

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: friendlyResetError(error?.message || 'Nao foi possivel redefinir a senha.') }, { status: 400 })
  }
}
