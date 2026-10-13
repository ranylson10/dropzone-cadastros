import { carregarPublicacaoEstatisticas, type PublicacaoEstatisticas } from './publicacao.service'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from './statistics-read.service'
import type { StatsFilters } from './statistics-query'

function publishedScope(publicacao: PublicacaoEstatisticas, filters: StatsFilters): StatsFilters {
  const published = new Set(publicacao.partidas_publicadas)
  const ids = Array.isArray(filters.partidaIds) ? filters.partidaIds.filter(id => published.has(id)) : [...published]
  return {
    ...filters,
    partidaIds: filters.partidaId ? ids.filter(id => id === filters.partidaId) : ids,
  }
}

export async function listarEstatisticasEquipesPublicadas(campeonatoId: string, filters: StatsFilters) {
  const publicacao = await carregarPublicacaoEstatisticas(campeonatoId)
  const scope = publishedScope(publicacao, filters)
  const equipes = scope.partidaIds?.length ? await listarEstatisticasEquipes(campeonatoId, scope) : []
  return { equipes, publicacao }
}

export async function listarEstatisticasMvpPublicadas(campeonatoId: string, filters: StatsFilters) {
  const publicacao = await carregarPublicacaoEstatisticas(campeonatoId)
  const scope = publishedScope(publicacao, filters)
  const jogadores = scope.partidaIds?.length ? await listarEstatisticasMvp(campeonatoId, scope) : []
  return { jogadores, publicacao }
}

/** Both tables share one publication cutoff, including the initial public profile. */
export async function listarEstatisticasPublicadas(campeonatoId: string, filters: StatsFilters) {
  const publicacao = await carregarPublicacaoEstatisticas(campeonatoId)
  const scope = publishedScope(publicacao, filters)
  const [equipes, jogadores] = scope.partidaIds?.length
    ? await Promise.all([listarEstatisticasEquipes(campeonatoId, scope), listarEstatisticasMvp(campeonatoId, scope)])
    : [[], []]
  return { equipes, jogadores, publicacao }
}
