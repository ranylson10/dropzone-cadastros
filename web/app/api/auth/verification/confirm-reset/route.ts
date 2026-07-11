import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { cleanEmail } from '@/lib/validation'

function clean(value: unknown) {
  return String(value || '').trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = cleanEmail(body.email)
    const code = clean(body.code)
    const password = String(body.password || '')
    const confirmPassword = String(body.confirm_password || '')

    if (!/^\d{6}$/.test(code)) throw new Error('Informe o código de 6 dígitos.')
    if (password.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirmPassword) throw new Error('A confirmação da senha não confere.')

    const { data: verified, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    })
    if (verifyError || !verified.user) throw new Error(verifyError?.message || 'Código inválido ou expirado.')

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(verified.user.id, { password })
    if (updateError) throw updateError

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível redefinir a senha.' }, { status: 400 })
  }
}
