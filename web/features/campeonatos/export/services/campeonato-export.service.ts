import { supabase } from '@/lib/supabase-browser'
import type { CampeonatoExportPayload, ExportFiltro } from '../types/campeonato-export.types'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function toQuery(filtro?: Partial<ExportFiltro>) {
  const params = new URLSearchParams()
  if (filtro?.fase_id) params.set('fase_id', filtro.fase_id)
  if (filtro?.grupo_ids?.length) params.set('grupo_ids', filtro.grupo_ids.join(','))
  else if (filtro?.grupo_id) params.set('grupo_id', filtro.grupo_id)
  if (filtro?.line_id) params.set('line_id', filtro.line_id)
  if (filtro?.equipe_id) params.set('equipe_id', filtro.equipe_id)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const campeonatoExportService = {
  async carregar(
    campeonatoId: string,
    filtro?: Partial<ExportFiltro>,
  ): Promise<CampeonatoExportPayload> {
    const response = await fetch(`/api/campeonatos/${campeonatoId}/export${toQuery(filtro)}`, {
      headers: await authHeaders(),
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a exportação.')
    return payload as CampeonatoExportPayload
  },
}
