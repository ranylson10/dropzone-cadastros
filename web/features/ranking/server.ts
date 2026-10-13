import { carregarRankingCompleto } from '@backend/ranking/tier-ranking.service'
import { unstable_cache } from 'next/cache'

const getCachedRankingSnapshot = unstable_cache(
  carregarRankingCompleto,
  ['public-ranking-published-snapshot-v2'],
  { revalidate: 30, tags: ['ranking:publico', 'directory:campeonatos'] },
)

export async function getCachedRankingTiers() {
  const ranking = await getCachedRankingSnapshot()
  return { ...ranking, players: ranking.players.slice(0, 100), teams: ranking.teams.slice(0, 100), championships: ranking.championships.slice(0, 100) }
}

export async function getCachedRankingEntityRows(kind: 'equipes' | 'jogadores', id: string) {
  const ranking = await getCachedRankingSnapshot()
  return kind === 'jogadores'
    ? ranking.players.filter(row => row.jogador_id === id)
    : ranking.teams.filter(row => row.equipe_id === id)
}
