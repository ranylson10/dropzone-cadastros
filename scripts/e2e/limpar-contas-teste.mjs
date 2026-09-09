import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

function loadEnv(filePath) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
}

loadEnv(path.resolve('web/.env.local'))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Configuração Supabase ausente para limpar contas E2E.')

const manifest = path.resolve('tests-e2e/.auth/fixture-accounts.json')
if (!existsSync(manifest)) process.exit(0)
const fixtures = JSON.parse(await fs.readFile(manifest, 'utf8'))
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
let failed = false
const fixtureUserIds = fixtures.map((fixture) => fixture.userId).filter(Boolean)

const restrictedReferences = [
  ['sistema_vendas_assistidas', 'vendedor_auth_user_id'],
  ['sistema_saques', 'auth_user_id'],
  ['sistema_restricoes_conta', 'aplicado_por'],
  ['sistema_auditoria', 'administrador_auth_user_id'],
]
for (const [table, column] of restrictedReferences) {
  if (!fixtureUserIds.length) break
  const { error } = await admin.from(table).delete().in(column, fixtureUserIds)
  if (error) {
    failed = true
    console.error(`[ERRO] dependências ${table}.${column}: ${error.message}`)
  }
}

const { data: fixtureProducers, error: fixtureProducersError } = fixtureUserIds.length
  ? await admin.from('produtoras').select('id').in('auth_user_id', fixtureUserIds)
  : { data: [], error: null }
if (fixtureProducersError) {
  failed = true
  console.error(`[ERRO] localizar produtoras temporárias: ${fixtureProducersError.message}`)
} else {
  const producerIds = (fixtureProducers || []).map((producer) => producer.id)
  if (producerIds.length) {
    const { error } = await admin.from('campeonatos').delete().in('produtora_id', producerIds)
    if (error) {
      failed = true
      console.error(`[ERRO] campeonatos temporários: ${error.message}`)
    }
  }
}

for (const fixture of fixtures) {
  const { error } = await admin.auth.admin.deleteUser(fixture.userId)
  if (error && !/not found/i.test(error.message)) {
    failed = true
    console.error(`[ERRO] ${fixture.profile}: ${error.message}`)
  } else {
    console.log(`[OK] removida conta E2E ${fixture.profile}`)
  }
}
if (!failed) await fs.writeFile(manifest, '[]\n', 'utf8')
if (failed) process.exitCode = 1
