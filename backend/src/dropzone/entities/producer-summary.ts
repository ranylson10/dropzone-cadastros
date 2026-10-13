import { supabaseAdmin } from '@backend/shared/supabase-admin'

export type ProducerWorkspaceSummary = {
  teamCount: number
  gameCount: number
  phaseCount?: number
  groupCount?: number
}

async function exactCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count, error } = await query
  if (error) throw error
  if (count === null) throw new Error('A contagem do workspace não foi retornada.')
  return count
}

/** Counts never download the records used by the inactive tabs. IDs must be authorized first. */
export async function producerWorkspaceSummary(ownedIds: string[], championshipId: string): Promise<ProducerWorkspaceSummary> {
  if (championshipId && !ownedIds.includes(championshipId)) throw new Error('Campeonato não pertence à produtora ativa.')
  const ids = championshipId ? [championshipId] : ownedIds
  async function scopedCount(table: string, activeOnly = false) {
    let count = 0
    for (let offset = 0; offset < ids.length; offset += 150) {
      let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).in('campeonato_id', ids.slice(offset, offset + 150))
      if (activeOnly) query = query.eq('status', 'ativo')
      count += await exactCount(query)
    }
    return count
  }
  const [teamCount, gameCount] = await Promise.all([
    championshipId ? scopedCount('campeonato_equipes', true) : exactCount(supabaseAdmin.from('equipes').select('id', { count: 'exact', head: true })),
    scopedCount('campeonato_jogos'),
  ])
  if (!championshipId) return { teamCount, gameCount }
  const [phaseCount, groupCount] = await Promise.all([scopedCount('campeonato_fases'), scopedCount('campeonato_grupos')])
  return { teamCount, gameCount, phaseCount, groupCount }
}
