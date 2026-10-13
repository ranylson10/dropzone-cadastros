'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import type { DropZoneRow } from '@/lib/types'
import type { ProducerWorkspaceSummary } from '@backend/dropzone/entities/producer-summary'
import { authHeaders } from './utils'
import { producerRequestKey, type ProducerEntityRequest } from './workspace-entities'

const emptyRequest: ProducerEntityRequest = { championshipId: '', types: [], summary: false }
type Result = { key: string; rows: DropZoneRow[]; summary?: ProducerWorkspaceSummary; error: string; loading: boolean }

/** Only the current profile/scope can publish a result; aborted or old responses are discarded. */
export function useProducerEntities(account: DropZoneRow | null, enabled: boolean) {
  const [{ ownerId, request }, setRequest] = useState({ ownerId: '', request: emptyRequest })
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<Result>({ key: '', rows: [], error: '', loading: false })
  const scopeKey = producerRequestKey(request)
  const accountId = account?.profile_type === 'produtora' && enabled ? account.id : ''
  const key = `${accountId}:${scopeKey}:${version}`
  const active = Boolean(accountId && ownerId === accountId && (request.summary || request.types.length))
  const changeRequest = useCallback((next: ProducerEntityRequest) => {
    setRequest(current => current.ownerId === accountId && producerRequestKey(current.request) === producerRequestKey(next) ? current : { ownerId: accountId, request: next })
  }, [accountId])
  const refresh = useCallback(() => setVersion(current => current + 1), [])

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    let current = true
    async function load() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session?.access_token) throw new Error('Sessão expirada. Entre novamente.')
        if (!current) return
        const query = new URLSearchParams({ entity_types: request.types.join(',') })
        if (request.championshipId) query.set('championship_id', request.championshipId)
        if (request.summary) query.set('summary', '1')
        const response = await fetch(`/api/dropzone?${query}`, {
          headers: authHeaders(data.session.access_token, 'produtora', accountId),
          signal: controller.signal, cache: 'no-store',
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Não foi possível carregar esta área.')
        if (current) setResult({ key, rows: json.rows || [], summary: json.summary, loading: false, error: '' })
      } catch (cause) {
        if (current) setResult({ key, rows: [], loading: false, error: cause instanceof Error ? cause.message : 'Não foi possível carregar esta área.' })
      }
    }
    void load()
    return () => { current = false; controller.abort() }
  }, [active, key, accountId, request])

  return useMemo(() => ({
    rows: active && result.key === key ? result.rows : [],
    summary: active && result.key === key ? result.summary : undefined,
    error: active && result.key === key ? result.error : '',
    loading: active && result.key !== key,
    scopeKey, changeRequest, refresh,
  }), [active, result, key, scopeKey, changeRequest, refresh])
}
