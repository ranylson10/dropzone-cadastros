import type { NextRequest } from 'next/server'
import { appUrl } from '@backend/shared/env'

/** Credentials may only be forwarded to an origin configured by the deployment. */
export function liliInternalOrigin(req: Pick<NextRequest, 'nextUrl'>) {
  const configured = [appUrl(), process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]
  if (process.env.VERCEL_URL) configured.push(`https://${process.env.VERCEL_URL}`)
  if (process.env.VERCEL_BRANCH_URL) configured.push(`https://${process.env.VERCEL_BRANCH_URL}`)
  const origins = new Set(configured.filter(Boolean).map(value => {
    const url = new URL(String(value))
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new Error('Origem da aplicação inválida.')
    return url.origin
  }))
  const requested = new URL(req.nextUrl.origin).origin
  if (!origins.has(requested)) throw new Error('Origem da aplicação não autorizada para esta operação.')
  return requested
}

export function liliInternalRequest(req: NextRequest, path: string) {
  if (!path.startsWith('/api/') || path.startsWith('//')) throw new Error('Caminho de operação inválido.')
  return new URL(path, liliInternalOrigin(req))
}

export function liliInternalFetchOptions(): Pick<RequestInit, 'redirect' | 'signal'> {
  return { redirect: 'error', signal: AbortSignal.timeout(10000) }
}
