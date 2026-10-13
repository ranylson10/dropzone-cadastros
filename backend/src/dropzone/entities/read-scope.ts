import { getAccountsByUserId } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import { readPagedRows } from '@backend/shared/paginated-query'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { EntityContext } from './context'

/** Resolve access independently of the entity types included in the response. */
export async function entityTeamReadScope({ user, account }: EntityContext) {
  const accounts = [...await getAccountsByUserId(user.id), account]
  const controlled = await listControllableEquipes(user.id, accounts)
  const managedIds = controlled.filter(team => team.permissoes.pode_ver).map(team => team.id)
  const memberIds: string[] = []
  if (account.profile_type === 'jogador') {
    const queries = [
      supabaseAdmin.from('equipe_jogadores').select('equipe_id').eq('jogador_id', account.id).order('id'),
      supabaseAdmin.from('equipe_jogadores').select('equipe_id').eq('jogador_auth_user_id', user.id).order('id'),
    ]
    const batches = await Promise.all(queries.map(query => readPagedRows<{ equipe_id: string }>(query)))
    memberIds.push(...batches.flat().map(row => row.equipe_id).filter(Boolean))
  }
  return {
    managedIds: [...new Set(managedIds)],
    lineIds: [...new Set([...managedIds, ...memberIds])],
    controlled,
  }
}

export async function entityChampionshipReadScope(context: EntityContext, teamScope: Awaited<ReturnType<typeof entityTeamReadScope>>) {
  const { account, user } = context
  const ids: string[] = []
  if (teamScope.lineIds.length) {
    const rows = await readPagedRows<{ campeonato_id: string }>(supabaseAdmin
      .from('campeonato_equipes').select('campeonato_id').in('equipe_id', teamScope.lineIds).eq('status', 'ativo').order('id'))
    ids.push(...rows.map(row => row.campeonato_id))
  }
  if (account.profile_type === 'jogador') {
    const queries = [
      supabaseAdmin.from('campeonato_jogadores').select('campeonato_id').eq('jogador_id', account.id).order('id'),
      supabaseAdmin.from('campeonato_jogadores').select('campeonato_id').eq('criado_por', user.id).order('id'),
    ]
    const batches = await Promise.all(queries.map(query => readPagedRows<{ campeonato_id: string }>(query)))
    ids.push(...batches.flat().map(row => row.campeonato_id))
  }
  return [...new Set(ids.filter(Boolean))]
}
