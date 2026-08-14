import { NextRequest, NextResponse } from 'next/server'
import { supabaseUrl } from '@backend/shared/supabase-admin'

export const runtime = 'nodejs'

const CACHE_SECONDS = 31_536_000
const PUBLIC_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'broadcast', 'campeonato'])

function safePath(parts: string[]) {
  return parts.length > 0 && parts.every((part) => part && part !== '.' && part !== '..' && !part.includes('\\'))
}

async function deliver(req: NextRequest, context: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await context.params
  if (!PUBLIC_BUCKETS.has(bucket) || !safePath(path)) return new NextResponse('NÃ£o encontrado.', { status: 404 })

  const objectPath = path.map(encodeURIComponent).join('/')
  const source = `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`
  const range = req.headers.get('range')
  const upstream = await fetch(source, {
    headers: range ? { Range: range } : undefined,
    next: { revalidate: CACHE_SECONDS },
  })
  if (!upstream.ok && upstream.status !== 206) return new NextResponse('NÃ£o encontrado.', { status: upstream.status })

  const headers = new Headers({
    'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
  })
  for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new NextResponse(req.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers })
}

export async function GET(req: NextRequest, context: { params: Promise<{ bucket: string; path: string[] }> }) {
  return deliver(req, context)
}

export async function HEAD(req: NextRequest, context: { params: Promise<{ bucket: string; path: string[] }> }) {
  return deliver(req, context)
}
