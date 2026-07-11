import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

type CodePurpose = 'register' | 'reset_password'
type ProfileType = 'produtora' | 'equipe' | 'jogador' | 'manager'

const CODE_TTL_MINUTES = 15
const MAX_ATTEMPTS = 5

function secret() {
  return process.env.AUTH_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dropzone-local-auth-secret'
}

function hashCode(email: string, purpose: CodePurpose, code: string) {
  return createHmac('sha256', secret())
    .update(`${email.toLowerCase()}:${purpose}:${code}`)
    .digest('hex')
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function resendConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  const from = String(process.env.AUTH_EMAIL_FROM || 'DropZone <onboarding@resend.dev>').trim()
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
    email: params.email,
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
}) {
  const { data, error } = await supabaseAdmin
    .from('auth_verification_codes')
    .select('id, code_hash, attempts, expires_at')
    .eq('email', params.email)
    .eq('purpose', params.purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Codigo invalido ou expirado.')
  if (new Date(data.expires_at).getTime() < Date.now()) throw new Error('Codigo expirado. Envie um novo codigo.')
  if (Number(data.attempts || 0) >= MAX_ATTEMPTS) throw new Error('Muitas tentativas. Envie um novo codigo.')

  const ok = safeCompare(String(data.code_hash), hashCode(params.email, params.purpose, params.code))
  if (!ok) {
    await supabaseAdmin
      .from('auth_verification_codes')
      .update({ attempts: Number(data.attempts || 0) + 1 })
      .eq('id', data.id)
    throw new Error('Codigo incorreto.')
  }

  await supabaseAdmin
    .from('auth_verification_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', data.id)
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
