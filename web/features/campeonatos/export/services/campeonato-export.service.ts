import { supabase } from '@/lib/supabase-browser'
import type { CampeonatoExportPayload } from '../types/campeonato-export.types'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const campeonatoExportService = {
  async carregar(campeonatoId: string): Promise<CampeonatoExportPayload> {
    const response = await fetch(`/api/campeonatos/${campeonatoId}/export`, {
      headers: await authHeaders(),
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a exportação.')
    return payload as CampeonatoExportPayload
  },
}
