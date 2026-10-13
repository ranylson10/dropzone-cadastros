import { useCallback, useEffect, useRef, useState } from 'react'
import { dropzoneFetch } from '@/lib/api'

type Page<T> = { scope: string; items: T[]; nextCursor: string | null; loading: boolean; refreshing: boolean; error: string }
type Options = { enabled?: boolean; limit?: number; itemsKey?: string; accessToken?: string | null; authenticated?: boolean; scopeKey?: string }

/** A directory page belongs to its query, resource and session. Old responses never replace it. */
export function usePagedDirectory<T extends { id: string }>(endpoint: string, query: string, options: Options = {}) {
  const { enabled = true, limit = 50, itemsKey = 'items', accessToken, authenticated = false, scopeKey = '' } = options
  const active = enabled && (!authenticated || Boolean(accessToken))
  const term = query.trim()
  const scope = JSON.stringify([endpoint, term, active, limit, itemsKey, authenticated ? accessToken : null, scopeKey])
  const latestScope = useRef(scope)
  latestScope.current = scope
  const request = useRef({ generation: 0, pending: false, controller: null as AbortController | null })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [page, setPage] = useState<Page<T>>({ scope: '', items: [], nextCursor: null, loading: active, refreshing: false, error: '' })
  const load = useCallback(async (cursor: string | null = null, refresh = false) => {
    if (!active || latestScope.current !== scope || (cursor && request.current.pending)) return
    if (timer.current) clearTimeout(timer.current)
    request.current.controller?.abort()
    const controller = new AbortController()
    const generation = ++request.current.generation
    request.current = { generation, pending: true, controller }
    setPage(current => ({ scope, items: cursor && current.scope === scope ? current.items : [], nextCursor: cursor, loading: !refresh, refreshing: refresh, error: '' }))
    const currentRequest = () => generation === request.current.generation && latestScope.current === scope && !controller.signal.aborted
    try {
      const params = new URLSearchParams({ q: term, limit: String(limit) })
      if (cursor) params.set('cursor', cursor)
      const result = await dropzoneFetch<Record<string, unknown>>(`${endpoint}${endpoint.includes('?') ? '&' : '?'}${params}`, {
        cache: 'no-store', signal: controller.signal, ...(authenticated ? { accessToken } : {}),
      })
      if (!currentRequest()) return
      if (!Array.isArray(result?.[itemsKey])) throw new Error('Resposta inválida ao carregar a lista.')
      const received = result[itemsKey] as T[]
      setPage(current => {
        const items = cursor && current.scope === scope ? [...current.items, ...received] : received
        return { scope, items: [...new Map(items.map(item => [item.id, item])).values()], nextCursor: typeof result.nextCursor === 'string' ? result.nextCursor : null, loading: false, refreshing: false, error: '' }
      })
    } catch (error) {
      if (currentRequest()) setPage(current => ({ ...current, loading: false, refreshing: false, error: error instanceof Error ? error.message : 'Não foi possível carregar a lista.' }))
    } finally { if (generation === request.current.generation) request.current.pending = false }
  }, [active, scope, endpoint, term, limit, itemsKey, authenticated, accessToken])
  useEffect(() => {
    if (active) timer.current = setTimeout(() => void load(), 300)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      request.current.generation++
      request.current.pending = false
      request.current.controller?.abort()
    }
  }, [active, load])
  const visible = page.scope === scope && active ? page : { scope, items: [], nextCursor: null, loading: active, refreshing: false, error: '' }
  return { ...visible, refresh: () => load(null, true), more: () => visible.nextCursor ? load(visible.nextCursor) : Promise.resolve() }
}
