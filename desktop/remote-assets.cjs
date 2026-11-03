'use strict'

// Fonte e tamanho das imagens que o Electron salva para uso no OBS.
// Sem depender de DNS do usuário: domínios permitidos são os do próprio projeto
// ou endpoints públicos do Supabase. Redirecionamentos são rejeitados.
const SITE_ORIGIN = 'https://dropzone-cadastros.vercel.app'
const MAX_ASSET_BYTES = 8 * 1024 * 1024
const PUBLIC_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'broadcast', 'campeonato'])
const CONTENT_EXTENSIONS = new Map([
  ['image/png', 'png'], ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'], ['image/gif', 'gif'],
])

function allowedAssetUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 4096) return null
  let url
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null

  if (url.origin === SITE_ORIGIN) {
    if (!(/^\/api\/media\/(produtora|equipe|jogador|manager|broadcast|campeonato)\/[^/]/.test(url.pathname)
      || /^\/(?:ui|branding)\/[A-Za-z0-9]/.test(url.pathname))) return null
  } else {
    // Nao aceitar um host que apenas termina com esse texto (ex: notsupabase.co).
    if (!/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) return null
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/([^/].*)$/)
    if (!match || !PUBLIC_BUCKETS.has(match[1])) return null
  }
  // Evita interpretar segmentos codificados de forma diferente no servidor remoto.
  if (/%(?:2f|5c|00)/i.test(url.pathname) || /(?:^|\/)\.\.?\//.test(url.pathname)) return null
  return url
}

async function downloadSafeImage(fetchImage, raw) {
  const url = allowedAssetUrl(raw)
  if (!url) return null
  let response
  try {
    response = await fetchImage(url.href, {
      signal: AbortSignal.timeout(12_000),
      redirect: 'manual', // nao seguir redirecionamento para rede interna
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' },
    })
    if (!response.ok || response.status >= 300 && response.status < 400) return null
    const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const extension = CONTENT_EXTENSIONS.get(contentType)
    if (!extension) return null
    const declaredSize = response.headers.get('content-length')
    if (declaredSize != null && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > MAX_ASSET_BYTES)) return null
    if (!response.body) return null
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.byteLength
      if (size > MAX_ASSET_BYTES) {
        await response.body.cancel().catch(() => {})
        return null
      }
      chunks.push(Buffer.from(chunk))
    }
    return { data: Buffer.concat(chunks, size), extension }
  } catch {
    return null
  }
}

function allowedOutputLink(raw, port) {
  try {
    const url = new URL(String(raw))
    return url.origin === `http://127.0.0.1:${port}`
      && /^\/overlay\/[a-zA-Z0-9-]{8,80}$/.test(url.pathname)
      && !url.search && !url.hash && !url.username && !url.password
  } catch { return false }
}

module.exports = { allowedAssetUrl, downloadSafeImage, allowedOutputLink, MAX_ASSET_BYTES }
