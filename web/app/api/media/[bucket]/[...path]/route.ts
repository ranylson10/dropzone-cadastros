import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseUrl } from '@backend/shared/supabase-admin'

export const runtime = 'nodejs'

const CACHE_SECONDS = 31_536_000
const PUBLIC_BUCKETS = new Set(['produtora', 'equipe', 'jogador', 'manager', 'broadcast', 'campeonato'])

function safePath(parts: string[]) {
  return parts.length > 0 && parts.every((part) => part && part !== '.' && part !== '..' && !part.includes('\\'))
}

async function deliver(req: NextRequest, context: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await context.params
  if (!PUBLIC_BUCKETS.has(bucket) || !safePath(path)) return new NextResponse('Não encontrado.', { status: 404 })

  const objectPath = path.map(encodeURIComponent).join('/')
  const source = `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`
  const range = req.headers.get('range')
  let upstream = await fetch(source, {
    headers: range ? { Range: range } : undefined,
    next: { revalidate: CACHE_SECONDS },
  })

  // Alguns buckets de mídia são intencionalmente privados no Storage. O app ainda
  // pode exibir arquivos de perfil/vitrine porque esta rota restringe os buckets
  // permitidos e assina somente o objeto solicitado, por poucos segundos.
  if (!upstream.ok && upstream.status !== 206) {
    const storagePath = path.join('/')
    const { data: signed, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 60)
    if (error || !signed?.signedUrl) return new NextResponse('Não encontrado.', { status: upstream.status || 404 })
    upstream = await fetch(signed.signedUrl, { headers: range ? { Range: range } : undefined })
  }

  if (!upstream.ok && upstream.status !== 206) return new NextResponse('Não encontrado.', { status: upstream.status })

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
