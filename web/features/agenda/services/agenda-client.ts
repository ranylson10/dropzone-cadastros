import { supabase } from '@/lib/supabase-browser'
import { authHeaders } from '@/features/dropzone/utils'
import type { AgendaEventForm, AgendaItem, AgendaScope } from '../types/agenda.types'

type AgendaFetchResult = {
  items: AgendaItem[]
  setup_required: boolean
  can_manage: boolean
  managed_championships: Array<{ id: string; nome: string }>
  error?: string
}
const agendaCache = new Map<string, { expiresAt: number; value: AgendaFetchResult }>()
const agendaPending = new Map<string, Promise<AgendaFetchResult>>()

async function sessionToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function fetchAgenda(params: {
  scope: AgendaScope
  scopeId?: string | null
  year: number
  month: number
  from?: string
  to?: string
}): Promise<AgendaFetchResult> {
  const cacheKey = `${params.scope}:${params.scopeId || 'me'}:${params.from || `${params.year}-${params.month}`}:${params.to || ''}`
  const cached = agendaCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const pending = agendaPending.get(cacheKey)
  if (pending) return pending

  const request = (async () => {
    const token = await sessionToken()
    const qs = new URLSearchParams({
      scope: params.scope,
      year: String(params.year),
      month: String(params.month),
    })
    if (params.scopeId) qs.set('id', params.scopeId)
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)

    const headers: Record<string, string> = {}
    if (token) Object.assign(headers, authHeaders(token))

    const res = await fetch(`/api/agenda?${qs.toString()}`, { headers, cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    const value: AgendaFetchResult = !res.ok
      ? { items: [], setup_required: false, can_manage: false, managed_championships: [], error: json.error || 'Erro ao carregar agenda.' }
      : {
          items: (json.items || []) as AgendaItem[],
          setup_required: Boolean(json.setup_required),
          can_manage: Boolean(json.can_manage),
          managed_championships: Array.isArray(json.managed_championships) ? json.managed_championships : [],
        }

    if (!value.error) agendaCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value })
    return value
  })()

  agendaPending.set(cacheKey, request)
  try {
    return await request
  } finally {
    agendaPending.delete(cacheKey)
  }
}

export async function createAgendaItem(form: AgendaEventForm) {
  const token = await sessionToken()
  if (!token) throw new Error('Faça login para adicionar na agenda.')

  const res = await fetch('/api/agenda', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: form.titulo,
      descricao: form.descricao || null,
      data_evento: form.data_evento,
      horario_inicio: form.horario_inicio,
      horario_fim: form.horario_fim || null,
      cor: form.cor,
      tipo: form.tipo,
      visibilidade: form.visibilidade,
      campeonato_id: form.campeonato_id || null,
      equipe_id: form.equipe_id || null,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erro ao criar evento.')
  return json.item
}

export async function updateAgendaItem(form: AgendaEventForm) {
  const token = await sessionToken()
  if (!token) throw new Error('Faça login para editar a agenda.')
  if (!form.id) throw new Error('ID do evento é obrigatório.')

  const res = await fetch('/api/agenda', {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: form.id,
      titulo: form.titulo,
      descricao: form.descricao || null,
      data_evento: form.data_evento,
      horario_inicio: form.horario_inicio,
      horario_fim: form.horario_fim || null,
      cor: form.cor,
      tipo: form.tipo,
      visibilidade: form.visibilidade,
      campeonato_id: form.campeonato_id || null,
      equipe_id: form.equipe_id || null,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erro ao atualizar evento.')
  return json.item
}

export async function deleteAgendaItem(id: string) {
  const token = await sessionToken()
  if (!token) throw new Error('Faça login para excluir da agenda.')

  const res = await fetch(`/api/agenda?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erro ao excluir evento.')
  return true
}

export async function updateAgendaGame(jogoId: string, dataJogo: string, horario: string) {
  const token = await sessionToken()
  if (!token) throw new Error('Faça login para reorganizar um jogo.')
  const res = await fetch('/api/agenda', {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ jogo_id: jogoId, data_jogo: dataJogo, horario }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erro ao atualizar o jogo.')
  return json.jogo
}
