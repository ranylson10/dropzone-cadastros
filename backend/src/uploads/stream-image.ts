import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const PUBLIC_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'broadcast', 'campeonato'])
const blocked = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(network, prefix, 'ipv4')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
blocked.addSubnet('2001::', 23, 'ipv6')
blocked.addSubnet('2001:db8::', 32, 'ipv6')
blocked.addSubnet('2002::', 16, 'ipv6')

export function isPublicImageAddress(address: string) {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
}

function storageOrigin() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!raw) throw new Error('Storage não configurado.')
  return new URL(raw).origin
}

export function allowedRemoteImageUrl(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Origem de imagem não permitida.')
  const ownStorage = storageOrigin()
  if (url.origin === ownStorage) {
    const parts = url.pathname.split('/')
    if (parts.slice(0, 5).join('/') !== '/storage/v1/object/public' || !PUBLIC_BUCKETS.has(parts[5]) || parts.length < 7) throw new Error('Caminho de imagem não permitido.')
  } else {
    const origins = String(process.env.STREAM_IMAGE_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
    if (!origins.includes(url.origin)) throw new Error('Origem de imagem não permitida. Envie a imagem para o DropZone.')
  }
  url.hash = ''
  return url
}

type ImageResult = { bytes: Buffer; contentType: string }
const imageTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml' }

async function localImage(url: URL): Promise<ImageResult> {
  const filename = decodeURIComponent(url.pathname)
  if (!/^\/(ui|branding)\//.test(filename) || filename.includes('\\') || filename.includes('\0')) throw new Error('Caminho de imagem não permitido.')
  const contentType = imageTypes[path.extname(filename).toLowerCase()]
  if (!contentType) throw new Error('Formato de imagem não permitido.')
  const publicRoot = await realpath(/* turbopackIgnore: true */ path.join(process.cwd(), 'public'))
  const target = await realpath(/* turbopackIgnore: true */ path.resolve(publicRoot, `.${filename}`))
  const relative = path.relative(publicRoot, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Caminho de imagem não permitido.')
  const info = await stat(/* turbopackIgnore: true */ target)
  if (!info.isFile() || info.size > MAX_IMAGE_BYTES) throw new Error('Imagem excede o limite de 25 MB.')
  const bytes = await readFile(/* turbopackIgnore: true */ target)
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Imagem excede o limite de 25 MB.')
  return { bytes, contentType }
}

/** Validate every redirect and pin the connection to the checked DNS address. */
async function remoteImage(url: URL, deadline: number, redirects = 0): Promise<ImageResult> {
  const checked = allowedRemoteImageUrl(url.href)
  const addresses = await lookup(checked.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(item => !isPublicImageAddress(item.address))) throw new Error('Endereço de imagem não permitido.')
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new Error('Tempo limite ao carregar imagem.')
  const pinned = addresses[0]
  return new Promise((resolve, reject) => {
    const req = httpsRequest(checked, {
      method: 'GET', agent: false, family: pinned.family, ...{ autoSelectFamily: false },
      headers: { Accept: 'image/*' },
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
    }, response => {
      const status = response.statusCode || 0
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume()
        clearTimeout(abort)
        if (!response.headers.location || redirects >= 3) return reject(new Error('Redirecionamento de imagem inválido.'))
        try { void remoteImage(new URL(response.headers.location, checked), deadline, redirects + 1).then(resolve, reject) }
        catch (error) { reject(error) }
        return
      }
      const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      if (status !== 200 || !Object.values(imageTypes).includes(contentType) || contentType === 'image/svg+xml' || Number(response.headers['content-length'] || 0) > MAX_IMAGE_BYTES) {
        req.destroy(new Error('Não foi possível ler a imagem remota.'))
        return
      }
      let size = 0
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_IMAGE_BYTES) req.destroy(new Error('Imagem excede o limite de 25 MB.'))
        else chunks.push(chunk)
      })
      response.once('error', reject)
      response.once('end', () => {
        clearTimeout(abort)
        if (size > MAX_IMAGE_BYTES) reject(new Error('Imagem excede o limite de 25 MB.'))
        else resolve({ bytes: Buffer.concat(chunks), contentType })
      })
    })
    const abort = setTimeout(() => req.destroy(new Error('Tempo limite ao carregar imagem.')), remaining)
    req.once('error', error => { clearTimeout(abort); reject(error) })
    req.end()
  })
}

export async function loadStreamImage(raw: unknown, requestOrigin: string): Promise<ImageResult> {
  if (typeof raw !== 'string' || !raw || raw.length > 4096) throw new Error('URL de imagem inválida.')
  const url = new URL(raw, requestOrigin)
  if (url.username || url.password) throw new Error('URL de imagem inválida.')
  if (url.origin === requestOrigin) {
    if (/^\/(ui|branding)\//.test(url.pathname)) return localImage(url)
    if (url.pathname.startsWith('/api/media/')) {
      const parts = url.pathname.slice('/api/media/'.length).split('/')
      if (parts.length < 2 || !PUBLIC_BUCKETS.has(parts[0])) throw new Error('Bucket de imagem não permitido.')
      return remoteImage(new URL(`/storage/v1/object/public/${parts.join('/')}`, storageOrigin()), Date.now() + 15000)
    }
    throw new Error('Caminho de imagem não permitido.')
  }
  return remoteImage(allowedRemoteImageUrl(url.href), Date.now() + 15000)
}
