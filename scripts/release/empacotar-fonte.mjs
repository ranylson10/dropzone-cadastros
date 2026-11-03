// Gera um ZIP somente com fontes, sem sessoes Playwright, segredos e caches.
// Execute: node scripts/release/empacotar-fonte.mjs [caminho.zip]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BLOCKED_DIRS = new Set([
  '.git', 'node_modules', '.next', '.auth', '.temp', '.expo', '.vercel',
  '.chrome-auth-profile', 'relatorios-testes', 'playwright-report',
  'playwright-resultados', 'test-results', 'coverage', 'dist', 'build',
  '__pycache__', '.cache', 'tmp', 'temp',
])
const PRIVATE_FILE = /^(?:\.env(?:\..+)?|\.npmrc|\.netrc|id_rsa|id_ed25519)$/i
const SECRET_EXT = /\.(?:pem|p12|pfx|key|sqlite|sqlite3|db)$/i
const JWT = /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/
const SESSION_JSON = /"(?:access_token|refresh_token)"\s*:\s*"[^"\r\n]{12,}"/

export function shouldPackage(relativePath) {
  const name = String(relativePath).replaceAll('\\', '/')
  const segments = name.split('/')
  if (segments.some((segment) => BLOCKED_DIRS.has(segment))) return false
  const filename = segments.at(-1)
  if (!filename || filename === '.DS_Store' || /^(?:Thumbs\.db|desktop\.ini)$/i.test(filename)) return false
  // Templates sem credenciais continuam no pacote.
  if (/^\.env(?:\..+)?\.example$/i.test(filename)) return true
  if (PRIVATE_FILE.test(filename) || SECRET_EXT.test(filename)) return false
  if (/\.(?:zip|7z|rar)$/i.test(filename)) return false
  return true
}

export function assertNoSessionSecrets(relativePath, buffer) {
  // Falha fechada: nao gerar um arquivo se encontrar tokens reais em qualquer fonte.
  if (buffer.includes(0)) return
  const content = buffer.toString('utf8')
  if (JWT.test(content) || (/\.json$/i.test(relativePath) && SESSION_JSON.test(content))) {
    throw new Error(`Conteudo com formato de sessao/credencial: ${relativePath}. Pacote nao criado.`)
  }
}

function sources() {
  const result = []
  let omitted = 0
  const visit = (folder, prefix = '') => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (!shouldPackage(relative)) { omitted++; continue }
      const abs = path.join(folder, entry.name)
      const stat = fs.lstatSync(abs)
      if (stat.isSymbolicLink()) { omitted++; continue }
      if (stat.isDirectory()) visit(abs, relative)
      else if (stat.isFile()) {
        const bytes = fs.readFileSync(abs)
        assertNoSessionSecrets(relative, bytes)
        result.push({ name: relative, bytes })
      }
    }
  }
  visit(ROOT)
  result.sort((a, b) => a.name.localeCompare(b.name, 'en'))
  return { result, omitted }
}

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let value = i
  for (let j = 0; j < 8; j++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  crcTable[i] = value >>> 0
}
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function archive(files) {
  if (files.length > 65535) throw new Error('Quantidade de arquivos exige ZIP64.')
  const chunks = [], central = []
  let offset = 0, centralSize = 0
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const compressed = zlib.deflateRawSync(file.bytes, { level: 6 })
    const crc = crc32(file.bytes)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(file.bytes.length, 22)
    local.writeUInt16LE(name.length, 26)
    chunks.push(local, name, compressed)
    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014b50, 0)
    record.writeUInt16LE(0x031e, 4)
    record.writeUInt16LE(20, 6)
    record.writeUInt16LE(0x0800, 8)
    record.writeUInt16LE(8, 10)
    record.writeUInt32LE(crc, 16)
    record.writeUInt32LE(compressed.length, 20)
    record.writeUInt32LE(file.bytes.length, 24)
    record.writeUInt16LE(name.length, 28)
    record.writeUInt32LE(offset, 42)
    central.push(record, name)
    offset += local.length + name.length + compressed.length
    centralSize += record.length + name.length
  }
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50, 0)
  footer.writeUInt16LE(files.length, 8)
  footer.writeUInt16LE(files.length, 10)
  footer.writeUInt32LE(centralSize, 12)
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, ...central, footer])
}

export function generatePackage(output, { dryRun = false } = {}) {
  const { result, omitted } = sources()
  const summary = { included: result.length, omitted, output: dryRun ? null : output }
  if (dryRun) return summary
  if (path.resolve(output).startsWith(ROOT + path.sep)) throw new Error('Grave o ZIP fora da arvore de fontes.')
  const data = archive(result)
  fs.writeFileSync(output, data, { flag: 'w' })
  return { ...summary, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2] || path.join(ROOT, '..', 'DROPZONE_FONTE_SEGURA.zip'))
  const dryRun = process.argv.includes('--dry-run')
  try {
    console.log(JSON.stringify(generatePackage(output, { dryRun }), null, 2))
  } catch (err) {
    console.error('ERRO -', err.message)
    process.exitCode = 1
  }
}
