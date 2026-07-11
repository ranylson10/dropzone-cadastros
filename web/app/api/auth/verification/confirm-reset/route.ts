import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { assertProfileType, cleanEmail } from '@/lib/validation'
import { profileTable } from '@backend/auth/server-auth'

function clean(value: unknown) {
  return String(value || '').trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const profileType = assertProfileType(body.profile_type)
    const login = clean(body.username).toLowerCase()
    const code = clean(body.code)
    const password = String(body.password || '')
    const confirmPassword = String(body.confirm_password || '')

    if (!login) throw new Error('Informe seu login ou ID público.')
    if (!/^\d{6}$/.test(code)) throw new Error('Informe o código de 6 dígitos.')
    if (password.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirmPassword) throw new Error('A confirmação da senha não confere.')

    const table = profileTable(profileType)
    let query = supabaseAdmin.from(table).select('auth_user_id, email_contato')
    if (/^\d+$/.test(login)) query = query.eq('public_id', Number(login))
    else query = query.ilike('username', login)

    const { data: account, error } = await query.maybeSingle()
    if (error) throw error
    if (!account?.auth_user_id || !account?.email_contato) throw new Error('Conta não encontrada.')

    const email = cleanEmail(account.email_contato)
    const { data: verified, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    })
    if (verifyError || !verified.user) throw new Error(verifyError?.message || 'Código inválido ou expirado.')
    if (verified.user.id !== account.auth_user_id) throw new Error('O código não pertence a esta conta.')

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(account.auth_user_id, { password })
    if (updateError) throw updateError

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível redefinir a senha.' }, { status: 400 })
  }
}
