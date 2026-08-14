/*
 * Regrava apenas os objetos pÃºblicos que ainda respondem com Cache-Control: no-cache.
 *
 * Uso seguro (somente auditoria): node scripts/maintenance/repair-storage-cache.mjs
 * Aplicar:                         node scripts/maintenance/repair-storage-cache.mjs --apply
 *
 * Os caminhos do DropZone incluem UUID e nÃ£o sÃ£o sobrescritos pelo app. Por isso,
 * max-age de um ano Ã© seguro e impede que previews, cards e overlays baixem o
 * mesmo arquivo em todas as navegaÃ§Ãµes.
 */
import fs from 'node:fs'
import path from 'node:path'

const CACHE_CONTROL = 'max-age=31536000'
const APPLY = process.argv.includes('--apply')

function readEnv(file) {
  const values = {}
  if (!fs.existsSync(file)) return values
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return values
}

const env = {
  ...readEnv(path.resolve('.env')),
  ...readEnv(path.resolve('web/.env.local')),
}
const baseUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || '')
if (!baseUrl || !serviceKey) throw new Error('Credenciais Supabase ausentes em .env ou web/.env.local.')

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
const objectUrl = (bucket, filePath) => `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${filePath.split('/').map(encodeURIComponent).join('/')}`

async function listAll(bucket, prefix = '') {
  const response = await fetch(`${baseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
  })
  if (!response.ok) throw new Error(`NÃ£o foi possÃ­vel listar ${bucket}: ${response.status}`)
  const entries = await response.json()
  const files = []
  for (const entry of entries) {
    const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.id) files.push({ path: itemPath, size: Number(entry.metadata?.size) || 0 })
    else files.push(...await listAll(bucket, itemPath))
  }
  return files
}

async function repair(bucket, file) {
  const publicUrl = objectUrl(bucket, file.path)
  // O CDN pode continuar expondo o cabeÃ§alho anterior durante a propagaÃ§Ã£o.
  // A fonte de verdade Ã© o metadado do prÃ³prio objeto.
  const infoUrl = `${baseUrl}/storage/v1/object/info/${encodeURIComponent(bucket)}/${file.path.split('/').map(encodeURIComponent).join('/')}`
  const infoResponse = await fetch(infoUrl, { headers })
  if (!infoResponse.ok) throw new Error(`info ${infoResponse.status}`)
  const info = await infoResponse.json()
  const currentCache = String(info.cache_control || '').toLowerCase()
  if (currentCache.includes('max-age=31536000')) return { candidate: false, repaired: false }

  if (!APPLY) return { candidate: true, repaired: false }

  const source = await fetch(publicUrl)
  if (!source.ok) throw new Error(`GET ${source.status}`)
  const body = await source.arrayBuffer()
  const contentType = source.headers.get('content-type') || 'application/octet-stream'
  const target = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${file.path.split('/').map(encodeURIComponent).join('/')}`
  const saved = await fetch(target, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': contentType,
      'Cache-Control': CACHE_CONTROL,
      'x-upsert': 'true',
    },
    body,
  })
  if (!saved.ok) throw new Error(`reenvio ${saved.status}`)
  return { candidate: true, repaired: true }
}

const bucketResponse = await fetch(`${baseUrl}/storage/v1/bucket`, { headers })
if (!bucketResponse.ok) throw new Error(`NÃ£o foi possÃ­vel listar buckets: ${bucketResponse.status}`)
const buckets = await bucketResponse.json()
let scanned = 0
let candidates = 0
let repaired = 0
let candidateBytes = 0

for (const bucket of buckets.filter((item) => item.public)) {
  const files = await listAll(bucket.id)
  for (const file of files) {
    scanned += 1
    try {
      const result = await repair(bucket.id, file)
      if (result.candidate) {
        candidates += 1
        candidateBytes += file.size
      }
      if (result.repaired) repaired += 1
    } catch (error) {
      console.error(`Erro em ${bucket.id}/${file.path}: ${error.message}`)
    }
  }
}

const mb = (candidateBytes / 1024 / 1024).toFixed(1)
console.log(`${APPLY ? 'Reparo' : 'Auditoria'} concluÃ­do: ${scanned} arquivos, ${candidates} sem cache longo, ${mb} MB candidatos${APPLY ? `, ${repaired} reparados` : ''}.`)
if (!APPLY && candidates) console.log('Execute novamente com --apply para regravar somente esses arquivos com max-age de um ano.')
