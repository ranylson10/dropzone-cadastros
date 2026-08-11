import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'

const MAX_IMAGE_BYTES = 25 * 1024 * 1024

function validRemoteImageUrl(raw: unknown) {
  try {
    const url = new URL(String(raw || ''))
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return null
    return url
  } catch { return null }
}

export async function POST(request: NextRequest) {
  try {
    await getBearerUser(request)
    const body = await request.json().catch(() => ({}))
    const url = validRemoteImageUrl(body.url)
    if (!url) return NextResponse.json({ error: 'URL de imagem inválida.' }, { status: 400 })

    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) })
    const contentType = response.headers.get('content-type') || ''
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (!response.ok || !contentType.startsWith('image/') || contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Não foi possível ler a imagem remota.' }, { status: 422 })
    }
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Imagem excede o limite de 25 MB.' }, { status: 422 })
    return new NextResponse(bytes, { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Falha ao preparar imagem.' }, { status: 400 })
  }
}
