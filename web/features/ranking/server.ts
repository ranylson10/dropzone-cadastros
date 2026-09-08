import { carregarRankingTiers } from '@backend/ranking/tier-ranking.service'
import { unstable_cache } from 'next/cache'

export const getCachedRankingTiers = unstable_cache(
  carregarRankingTiers,
  ['public-ranking-tiers-v1'],
  { revalidate: 30, tags: ['ranking:publico'] },
)
