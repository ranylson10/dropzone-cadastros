'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'

type Page<T> = { scope: string; items: T[]; nextCursor: string | null; error: string; loading: boolean }
export function usePagedSearch<T extends { id: string }>(endpoint: string, { authenticated = false, accessToken, itemsKey = 'items', limit = 30 }: { authenticated?: boolean; accessToken?: string | null; itemsKey?: string; limit?: number } = {}) {
  const scope = JSON.stringify([endpoint, authenticated, accessToken || '', itemsKey, limit])
  const [page, setPage] = useState<Page<T>>({ scope: '', items: [], nextCursor: null, error: '', loading: false })
  const request = useRef({ generation: 0, term: '', controller: null as AbortController | null })
  const clear = useCallback(() => {
    request.current.controller?.abort()
    request.current = { generation: request.current.generation + 1, term: '', controller: null }
    setPage({ scope: '', items: [], nextCursor: null, error: '', loading: false })
  }, [])
  useEffect(() => { clear(); return () => { request.current.generation++; request.current.controller?.abort() } }, [endpoint, authenticated, accessToken, itemsKey, limit, clear])

  const run = useCallback(async (term: string, cursor: string | null = null) => {
    if (cursor && request.current.controller) return
    request.current.controller?.abort()
    const generation = request.current.generation + 1
    const controller = new AbortController()
    request.current = { generation, term, controller }
    setPage(current => ({ scope, items: cursor && current.scope === scope ? current.items : [], nextCursor: cursor ? current.nextCursor : null, error: '', loading: true }))
    try {
      const token = authenticated ? accessToken || (await supabase.auth.getSession()).data.session?.access_token : null
      if (request.current.generation !== generation) return
      if (authenticated && !token) throw new Error('Sessão expirada. Entre novamente.')
      const params = new URLSearchParams({ q: term, limit: String(limit) })
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`${endpoint}?${params}`, { cache: 'no-store', signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível buscar. Tente novamente.')
      if (request.current.generation !== generation) return
      setPage(current => {
        const items = cursor ? [...current.items, ...(payload[itemsKey] || [])] : payload[itemsKey] || []
        return { scope, items: [...new Map<string, T>(items.map((item: T) => [item.id, item])).values()], nextCursor: payload.nextCursor || null, error: '', loading: false }
      })
      return (payload[itemsKey] || []) as T[]
    } catch (error) {
      if (request.current.generation === generation) setPage(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Não foi possível buscar.' }))
    } finally { if (request.current.generation === generation) request.current.controller = null }
  }, [endpoint, authenticated, accessToken, itemsKey, limit, scope])
  const visible = page.scope === scope ? page : { scope, items: [], nextCursor: null, error: '', loading: false }
  return { ...visible, term: page.scope === scope ? request.current.term : '', clear, search: (term: string) => run(term.trim()), more: () => visible.nextCursor ? run(request.current.term, visible.nextCursor) : Promise.resolve() }
}
