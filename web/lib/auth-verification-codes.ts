import { createHmac, randomInt } from 'crypto'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { optionalEnv, requiredEnv } from '@backend/shared/env'

type CodePurpose = 'register' | 'reset_password'
type ProfileType = 'produtora' | 'equipe' | 'jogador' | 'manager' | 'broadcast'

const CODE_TTL_MINUTES = 15

function secret() {
  const value = requiredEnv('AUTH_CODE_SECRET')
  if (value.length < 32) {
    throw new Error('AUTH_CODE_SECRET ausente ou muito curto. Configure um segredo exclusivo com pelo menos 32 caracteres.')
  }
  return value
}

function hashCode(email: string, purpose: CodePurpose, code: string) {
  return createHmac('sha256', secret())
    .update(`${email.toLowerCase()}:${purpose}:${code}`)
    .digest('hex')
}

function resendConfig() {
  const apiKey = optionalEnv('RESEND_API_KEY')
  const from = optionalEnv('AUTH_EMAIL_FROM', 'DropZone <onboarding@resend.dev>')
  if (!apiKey) {
    throw new Error('RESEND_API_KEY nao configurada no servidor. Configure no Vercel para enviar codigos por e-mail.')
  }
  return { apiKey, from }
}

function emailHtml(code: string, title: string) {
  return `
    <div style="font-family:Arial,sans-serif;color:#121826">
      <h2>${title}</h2>
      <p>Seu codigo DropZone e:</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:6px;margin:18px 0">${code}</div>
      <p>Digite os 6 numeros na tela. O codigo expira em ${CODE_TTL_MINUTES} minutos.</p>
    </div>
  `
}

export function generateVerificationCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

export async function createVerificationCode(params: {
  email: string
  purpose: CodePurpose
  profileType: ProfileType
  username?: string
}) {
  const normalizedEmail = params.email.trim().toLowerCase()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recent, error: recentError } = await supabaseAdmin
    .from('auth_verification_codes')
    .select('created_at')
    .eq('email', normalizedEmail)
    .eq('purpose', params.purpose)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5)
  if (recentError) throw recentError
  if (recent?.length && Date.now() - new Date(recent[0].created_at).getTime() < 60_000) {
    throw new Error('Aguarde 1 minuto antes de solicitar outro código.')
  }
  if ((recent?.length || 0) >= 5) {
    throw new Error('Limite de códigos atingido. Aguarde 1 hora e tente novamente.')
  }

  const code = generateVerificationCode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('auth_verification_codes')
    .update({ consumed_at: now.toISOString() })
    .eq('email', params.email)
    .eq('purpose', params.purpose)
    .is('consumed_at', null)

  const { error } = await supabaseAdmin.from('auth_verification_codes').insert({
    email: normalizedEmail,
    purpose: params.purpose,
    profile_type: params.profileType,
    username: params.username || null,
    code_hash: hashCode(params.email, params.purpose, code),
    expires_at: expiresAt,
  })
  if (error) throw error

  return code
}

export async function verifyCode(params: {
  email: string
  purpose: CodePurpose
  code: string
  profileType?: ProfileType | null
  username?: string | null
}) {
  const normalizedEmail = params.email.trim().toLowerCase()
  const expectedHash = hashCode(normalizedEmail, params.purpose, params.code)
  const { data, error } = await supabaseAdmin.rpc('fn_verify_and_consume_auth_code', {
    p_email: normalizedEmail,
    p_purpose: params.purpose,
    p_code_hash: expectedHash,
    p_profile_type: params.profileType || null,
    p_username: params.username || null,
  })
  if (error) throw error
  const status = Array.isArray(data) ? data[0]?.status : data?.status
  if (status === 'ok') return
  if (status === 'incorrect') throw new Error('Codigo incorreto.')
  if (status === 'too_many_attempts') throw new Error('Muitas tentativas. Envie um novo codigo.')
  if (status === 'context_mismatch') throw new Error('O código não pertence a este cadastro. Envie um novo código.')
  throw new Error('Codigo invalido ou expirado.')
}

export async function sendVerificationEmail(params: {
  email: string
  code: string
  purpose: CodePurpose
}) {
  const { apiKey, from } = resendConfig()
  const isReset = params.purpose === 'reset_password'
  const subject = isReset ? 'Codigo para recuperar sua senha DropZone' : 'Codigo de confirmacao DropZone'
  const title = isReset ? 'Recuperacao de senha DropZone' : 'Confirme sua conta DropZone'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.email],
      subject,
      html: emailHtml(params.code, title),
      text: `Seu codigo DropZone e ${params.code}. Ele expira em ${CODE_TTL_MINUTES} minutos.`,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.message || payload?.error || `Resend HTTP ${response.status}`
    if (/only send testing emails to your own email address/i.test(message)) {
      throw new Error('A conta Resend ainda esta em modo teste. Verifique um dominio no Resend e atualize AUTH_EMAIL_FROM para um e-mail desse dominio, ou teste usando o e-mail dono da conta Resend.')
    }
    throw new Error(`Erro ao enviar e-mail pelo Resend: ${message}`)
  }
}
