import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function loadEnv(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match) continue
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
  } catch {
    // O arquivo local pode não existir em CI.
  }
}

loadEnv(path.resolve('web/.env.local'))

const baseURL = String(process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const origin = new URL(baseURL).origin
const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseURL || !anonKey || !serviceRoleKey) {
  throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY em web/.env.local.')
}

const admin = createClient(supabaseURL, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const projectRef = new URL(supabaseURL).hostname.split('.')[0]
const authStorageKey = `sb-${projectRef}-auth-token`
const authDir = path.resolve('tests-e2e/.auth')

const profiles = [
  { name: 'admin', table: 'sistema_administradores', env: 'E2E_ADMIN_EMAIL' },
  { name: 'produtora', table: 'produtoras', env: 'E2E_PRODUTORA_EMAIL' },
  { name: 'manager', table: 'managers', env: 'E2E_MANAGER_EMAIL' },
  { name: 'equipe', table: 'equipes', env: 'E2E_EQUIPE_EMAIL' },
  { name: 'jogador', table: 'jogadores', env: 'E2E_JOGADOR_EMAIL' },
]

function userIdFromRow(row, profile) {
  if (!row || typeof row !== 'object') return null
  if (profile === 'equipe') return row.auth_user_id || row.dono_auth_user_id || null
  return row.auth_user_id || row.user_id || row.usuario_id || null
}

function isActiveRow(row) {
  const status = String(row?.status || 'ativo').toLowerCase()
  return !['inativo', 'bloqueado', 'banido', 'excluido'].includes(status)
}

async function usersFromProfileTable(profile) {
  const candidates = profile.name === 'equipe'
    ? ['id,auth_user_id,dono_auth_user_id,status,created_at', '*']
    : ['id,auth_user_id,user_id,usuario_id,status,created_at', '*']

  for (const selection of candidates) {
    const { data, error } = await admin.from(profile.table).select(selection).limit(200)
    if (error) continue
    const rows = Array.isArray(data) ? data : []
    return [
      ...rows.filter((row) => isActiveRow(row)),
      ...rows.filter((row) => !isActiveRow(row)),
    ]
  }
  return []
}

async function automaticIdentity(profile, excludedUserIds = new Set(), excludedEmails = new Set()) {
  const rows = await usersFromProfileTable(profile)
  const visited = new Set()

  for (const row of rows) {
    const userId = String(userIdFromRow(row, profile.name) || '')
    if (!userId || visited.has(userId) || excludedUserIds.has(userId)) continue
    visited.add(userId)

    const { data, error } = await admin.auth.admin.getUserById(userId)
    const email = String(data?.user?.email || '').trim().toLowerCase()
    if (error || !email || excludedEmails.has(email)) continue
    return { userId, email }
  }
  return null
}

async function identityForProfile(profile, excludedUserIds = new Set(), excludedEmails = new Set()) {
  const configured = String(process.env[profile.env] || '').trim().toLowerCase()
  if (configured) {
    if (excludedEmails.has(configured)) {
      throw new Error(`${profile.name}: ${profile.env} usa a mesma conta de outro perfil incompatível (${configured}). Informe uma conta diferente.`)
    }
    return { userId: null, email: configured }
  }

  const identity = await automaticIdentity(profile, excludedUserIds, excludedEmails)
  if (!identity) {
    const extra = profile.name === 'manager'
      ? ' O teste exige um manager pertencente a uma conta diferente da produtora/admin.'
      : ''
    throw new Error(`${profile.name}: nenhum usuário compatível foi encontrado em ${profile.table}.${extra} Defina ${profile.env} em web/.env.local.`)
  }
  return identity
}

async function sessionForEmail(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const tokenHash = data?.properties?.hashed_token
  if (!tokenHash) throw new Error(`O Supabase não retornou hashed_token para ${email}.`)

  const client = createClient(supabaseURL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  })
  if (verifyError) throw verifyError
  if (!verified.session) throw new Error(`O Supabase não criou uma sessão para ${email}.`)
  return verified.session
}

async function validateSession(profile, session) {
  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    ...(profile.name === 'admin' ? {} : { 'x-profile-type': profile.name }),
  }
  const response = await fetch(`${baseURL}/api/me`, { headers })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`${profile.name}: /api/me respondeu ${response.status}: ${body?.error || 'não autorizado'}`)
  }
  if (profile.name !== 'admin' && body?.account?.profile_type !== profile.name) {
    throw new Error(`${profile.name}: /api/me retornou o perfil ${body?.account?.profile_type || 'desconhecido'}.`)
  }
}

async function writeStorageState(profile, session) {
  const localStorage = [
    { name: authStorageKey, value: JSON.stringify(session) },
    { name: 'dropzone_active_profile_type', value: profile.name === 'admin' ? 'produtora' : profile.name },
  ]
  const state = { cookies: [], origins: [{ origin, localStorage }] }
  const output = path.join(authDir, `${profile.name}.json`)
  await fs.writeFile(output, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  return output
}

await fs.mkdir(authDir, { recursive: true })

const selected = new Map()
const sessionsByEmail = new Map()
console.log(`Gerando sessões automáticas para ${origin}...\n`)
for (const profile of profiles) {
  try {
    // Manager precisa ser uma identidade diferente da produtora/admin para que os
    // testes de convite, autoaprovação e autoelevação validem usuários distintos.
    const distinctProfile = profile.name === 'manager'
    const excludedUserIds = new Set()
    const excludedEmails = new Set()
    if (distinctProfile) {
      for (const name of ['admin', 'produtora']) {
        const item = selected.get(name)
        if (item?.userId) excludedUserIds.add(item.userId)
        if (item?.email) excludedEmails.add(item.email)
      }
    }

    const identity = await identityForProfile(profile, excludedUserIds, excludedEmails)
    // Uma mesma conta pode representar mais de um perfil no ambiente E2E.
    // Gerar outro magic link para o mesmo e-mail pode invalidar a sessão criada
    // anteriormente enquanto os projetos desktop e mobile rodam em paralelo.
    // Reutilize a mesma sessão por identidade e varie apenas o perfil ativo.
    let session = sessionsByEmail.get(identity.email)
    if (!session) {
      session = await sessionForEmail(identity.email)
      sessionsByEmail.set(identity.email, session)
    }
    await validateSession(profile, session)
    const output = await writeStorageState(profile, session)
    selected.set(profile.name, identity)
    console.log(`[OK] ${profile.name.padEnd(9)} ${identity.email} -> ${output}`)
  } catch (error) {
    console.error(`[ERRO] ${profile.name}: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

if (process.exitCode) {
  console.error('\nAlgumas sessões não foram geradas. Configure apenas os e-mails apontados no erro e execute novamente.')
} else {
  console.log('\nTodas as sessões foram geradas sem abrir navegador e sem login manual.')
  console.log('Agora execute: npm run test:e2e:auth')
}
