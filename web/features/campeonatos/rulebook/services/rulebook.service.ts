import type { AnswerValue, InfracaoConfig, RulebookApiResponse, RulebookPerfil } from '../types/rulebook.types'

async function parseJson(res: Response) {
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.error || `Erro HTTP ${res.status}`)
  }
  return json
}

function authHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export const rulebookService = {
  async load(campeonatoId: string, token: string): Promise<RulebookApiResponse> {
    const res = await fetch(`/api/campeonatos/${campeonatoId}/rulebook`, {
      headers: authHeaders(token),
      cache: 'no-store',
    })
    return parseJson(res)
  },

  async create(campeonatoId: string, token: string, perfil?: RulebookPerfil) {
    const res = await fetch(`/api/campeonatos/${campeonatoId}/rulebook`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ perfil }),
    })
    return parseJson(res) as Promise<RulebookApiResponse>
  },

  async save(
    campeonatoId: string,
    token: string,
    payload: {
      perfil?: RulebookPerfil
      etapa_atual?: number
      respostas?: Record<string, AnswerValue>
      infracoes?: InfracaoConfig[]
      confirmacoes_alertas?: Record<string, boolean>
    },
  ) {
    const res = await fetch(`/api/campeonatos/${campeonatoId}/rulebook`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    })
    return parseJson(res) as Promise<RulebookApiResponse>
  },

  async publish(
    campeonatoId: string,
    token: string,
    confirmacoes_alertas?: Record<string, boolean>,
  ) {
    const res = await fetch(`/api/campeonatos/${campeonatoId}/rulebook/publish`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ confirmacoes_alertas }),
    })
    return parseJson(res) as Promise<RulebookApiResponse>
  },

  async loadPublic(campeonatoId: string) {
    const res = await fetch(`/api/campeonatos/${campeonatoId}/rulebook?public=1`, {
      cache: 'no-store',
    })
    return parseJson(res)
  },
}
