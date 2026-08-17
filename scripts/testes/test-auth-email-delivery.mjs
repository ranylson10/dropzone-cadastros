import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

const root = process.cwd()
loadEnvFile(path.join(root, 'web', '.env.local'))
loadEnvFile(path.join(root, 'web', '.env'))

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
const resendKey = String(process.env.RESEND_AUDIT_API_KEY || '')
const targetEmail = String(process.env.DROPZONE_EMAIL_SMOKE_ADDRESS || '').trim().toLowerCase()
const expectedSubject = String(process.env.DROPZONE_EMAIL_SMOKE_SUBJECT || 'Seu código de recuperação DropZone').trim()

function required(value, name) {
  if (!value) throw new Error(`${name} não configurado.`)
  return value
}

required(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL')
required(anonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
required(resendKey, 'RESEND_AUDIT_API_KEY (chave Full access usada somente no teste local)')
required(targetEmail, 'DROPZONE_EMAIL_SMOKE_ADDRESS')

const startedAt = Date.now() - 5_000
console.log(`Solicitando código de recuperação para ${targetEmail}...`)

const recoverResponse = await fetch(`${supabaseUrl}/auth/v1/recover`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: targetEmail }),
})

if (!recoverResponse.ok) {
  const body = await recoverResponse.text()
  throw new Error(`Supabase recusou o pedido de recuperação (${recoverResponse.status}): ${body}`)
}

console.log('Supabase aceitou o pedido. Aguardando o Resend registrar o envio...')

const acceptedEvents = new Set(['delivered', 'opened', 'clicked'])
let lastMatch = null
for (let attempt = 1; attempt <= 12; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 2500 : 5000))

  const response = await fetch('https://api.resend.com/emails', {
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'User-Agent': 'dropzone-auth-email-smoke/1.0',
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend não permitiu consultar os envios (${response.status}): ${body}`)
  }

  const payload = await response.json()
  const emails = Array.isArray(payload.data) ? payload.data : []
  lastMatch = emails.find((item) => {
    const to = Array.isArray(item.to) ? item.to.map((value) => String(value).toLowerCase()) : []
    const createdAt = Date.parse(String(item.created_at || ''))
    return to.includes(targetEmail)
      && String(item.subject || '').trim() === expectedSubject
      && Number.isFinite(createdAt)
      && createdAt >= startedAt
  }) || null

  if (lastMatch) {
    console.log(`Resend encontrou o e-mail. Evento atual: ${lastMatch.last_event || 'desconhecido'}`)
    if (acceptedEvents.has(String(lastMatch.last_event || '').toLowerCase())) {
      console.log('OK: fluxo Supabase -> SMTP Resend -> destinatário confirmou entrega.')
      process.exit(0)
    }
  } else {
    console.log(`Tentativa ${attempt}/12: e-mail ainda não apareceu no Resend.`)
  }
}

if (lastMatch) {
  throw new Error(`O e-mail apareceu no Resend, mas não chegou ao estado de entrega dentro do tempo do teste. Último evento: ${lastMatch.last_event || 'desconhecido'}.`)
}
throw new Error('O Supabase aceitou a recuperação, mas nenhum e-mail correspondente apareceu no Resend dentro do tempo do teste.')
