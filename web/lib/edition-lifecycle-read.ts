import { supabase } from '@/lib/supabase-browser'
import type { LifecycleReadContract } from '@backend/campeonatos/lifecycle-contract'

export type EditionLifecycleStatus = { status: string; data_fim: string | null } | null
export type EditionLifecycleBoard = { edition: EditionLifecycleStatus; contract: LifecycleReadContract }
const statuses = new Set(['planejada', 'ativa', 'encerrada', 'cancelada', 'arquivada'])

/** Read only; atomic actions require a negotiated mode and management permission. */
export async function readEditionLifecycleBoard(championship: string, actor: string, isCurrent: () => boolean, signal: AbortSignal): Promise<EditionLifecycleBoard> {
  const assertScope = async () => {
    const { data } = await supabase.auth.getSession()
    if (!isCurrent() || !data.session?.access_token || data.session.user.id !== actor) throw new Error('Atualize a sessão para consultar a edição.')
    return data.session.access_token
  }
  const token = await assertScope()
  const response = await fetch(`/api/campeonatos/${encodeURIComponent(championship)}/estrutura-avancada`, {
    method: 'GET', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
  })
  if (!response.ok) throw new Error('Não foi possível consultar o estado da edição.')
  const body = await response.json()
  await assertScope()
  if (body?.edition_actor_id !== actor) throw new Error('Atualize a sessão para consultar a edição.')
  const contract: LifecycleReadContract = { lifecycle_write_mode: body.lifecycle_write_mode === 'atomic' && body.lifecycle_manage_allowed === true ? 'atomic' : 'unavailable', edition_actor_id: actor }
  if (body.edition === null) return { edition: null, contract }
  const edition = body?.edition
  if (!edition || edition.campeonato_id !== championship || !statuses.has(edition.status)
    || !(edition.data_fim === null || (typeof edition.data_fim === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(edition.data_fim)))) {
    throw new Error('Não foi possível confirmar o estado da edição.')
  }
  return { edition: { status: edition.status, data_fim: edition.data_fim }, contract }
}

export async function readEditionLifecycle(championship: string, actor: string, isCurrent: () => boolean, signal: AbortSignal): Promise<EditionLifecycleStatus> {
  return (await readEditionLifecycleBoard(championship, actor, isCurrent, signal)).edition
}
