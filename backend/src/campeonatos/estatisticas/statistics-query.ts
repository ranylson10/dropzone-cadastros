import { readPagedRows, readRowsByIds } from '../../shared/paginated-query'

export type StatsFilters = {
  faseId?: string | null
  rodadaId?: string | null
  jogoId?: string | null
  partidaId?: string | null
  mapaCodigo?: string | null
  grupoId?: string | null
  partidaIds?: string[] | null
}

export function applyStatsFilters(query: any, filters: StatsFilters) {
  let result = query
  if (filters.faseId) result = result.eq('fase_id', filters.faseId)
  if (filters.rodadaId) result = result.eq('rodada_id', filters.rodadaId)
  if (filters.jogoId) result = result.eq('jogo_id', filters.jogoId)
  if (filters.partidaId) result = result.eq('partida_id', filters.partidaId)
  if (filters.mapaCodigo) result = result.eq('mapa_codigo', filters.mapaCodigo)
  if (filters.grupoId) result = result.eq('grupo_id', filters.grupoId)
  if (filters.partidaIds?.length) result = result.in('partida_id', filters.partidaIds)
  return result
}

/** The factory must already scope the query to the authorized championship. */
export async function readStatsRows<T = any>(queryForChampionship: () => any, filters: StatsFilters, orderColumn = 'resultado_id'): Promise<T[]> {
  const query = (scope: StatsFilters) => applyStatsFilters(queryForChampionship(), scope).order(orderColumn, { ascending: true })
  if (Array.isArray(filters.partidaIds)) {
    // [] is an explicit empty publication scope, never an unfiltered read.
    return readRowsByIds<T>(filters.partidaIds, batch => query({ ...filters, partidaIds: batch }))
  }
  return readPagedRows<T>(query(filters))
}
