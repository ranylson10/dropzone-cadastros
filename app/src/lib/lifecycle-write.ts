import * as Crypto from 'expo-crypto'
import { dropzoneFetch } from './api'
import { championshipSession } from './championship-session'
import { mobileLifecycleAttempts } from './lifecycle-attempt'
import { runChampionshipOperation } from '../../../backend/src/campeonatos/championship-operation'
import { operationJson, operationUuid } from '../../../backend/src/shared/operation-json'
import type { OperationAttempt } from '../../../backend/src/shared/operation-attempt'
import { assertLifecycleResponse, lifecycleIntent, type LifecycleAction, type LifecycleIntent, type LifecycleReadContract } from '../../../backend/src/campeonatos/lifecycle-contract'

export { mobileLifecycleAttempts }
export type { LifecycleAction, LifecycleIntent, LifecycleReadContract }
export type MobileLifecycleAttempt = OperationAttempt<LifecycleIntent>
const statuses = new Set(['planejada', 'ativa', 'encerrada', 'cancelada', 'arquivada'])
type Current = () => void
function bind(contract: LifecycleReadContract, actor: string) {
  if (contract.lifecycle_write_mode !== 'atomic') throw new Error('Encerramento e reabertura temporariamente indisponíveis.')
  if (contract.edition_actor_id !== actor) throw new Error('A conta mudou. Atualize o acompanhamento.')
}

export async function readMobileLifecycleBoard(champ: string, actor: string, assertCurrent: Current, signal?: AbortSignal) {
  champ = operationUuid(champ); actor = operationUuid(actor)
  const current = await championshipSession(actor); assertCurrent()
  const body = await dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(champ)}/estrutura-avancada`, {
    accessToken: current.token, cache: 'no-store', signal, timeoutMs: 15000,
  })
  await championshipSession(actor); assertCurrent()
  if (body?.edition_actor_id !== actor) throw new Error('Atualize a sessão para consultar a edição.')
  const contract: LifecycleReadContract = { lifecycle_write_mode: body.lifecycle_write_mode === 'atomic' && body.lifecycle_manage_allowed === true ? 'atomic' : 'unavailable', edition_actor_id: actor }
  const edition = body.edition
  if (edition !== null && (!edition || edition.campeonato_id !== champ || !statuses.has(edition.status)
    || !(edition.data_fim === null || typeof edition.data_fim === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(edition.data_fim)))) throw new Error('Não foi possível confirmar o estado da edição.')
  return { contract, edition: edition ? { status: String(edition.status), data_fim: edition.data_fim as string | null } : null }
}

async function send(champ: string, actor: string, requestId: string, body: { action: string; expected?: LifecycleIntent['expected'] }, assertCurrent: Current) {
  const current = await championshipSession(actor); assertCurrent()
  const result = await dropzoneFetch<any>(`/api/campeonatos/${encodeURIComponent(champ)}/estrutura-avancada/lifecycle-atomico`, {
    method: 'POST', cache: 'no-store', accessToken: current.token, timeoutMs: 35000,
    headers: { 'Idempotency-Key': requestId }, body: JSON.stringify(body),
  })
  assertLifecycleResponse(result, actor, champ, requestId, body)
  return result
}

export async function previewMobileLifecycle(champ: string, actor: string, contract: LifecycleReadContract, action: LifecycleAction, assertCurrent: Current = () => {}) {
  champ = operationUuid(champ); actor = operationUuid(actor); bind(contract, actor)
  await championshipSession(actor); assertCurrent()
  if (!['publish_final', 'reopen_final'].includes(action)) throw new Error('Ação inválida.')
  const result = await send(champ, actor, operationUuid(Crypto.randomUUID()), { action: 'preview_' + action }, assertCurrent)
  await championshipSession(actor); assertCurrent()
  return result
}

export async function writeMobileLifecycle(champ: string, actor: string, contract: LifecycleReadContract, value: Record<string, any>, assertCurrent: Current = () => {}) {
  champ = operationUuid(champ); actor = operationUuid(actor); bind(contract, actor)
  const body = lifecycleIntent(value)
  await championshipSession(actor); assertCurrent()
  return runChampionshipOperation(actor, champ, operationJson(['lifecycle', body]), true, async () => {
    await mobileLifecycleAttempts.read(actor, champ)
    const attempt = await mobileLifecycleAttempts.prepare(actor, champ, body)
    const result = await send(champ, actor, attempt.requestId, attempt.body, assertCurrent)
    await mobileLifecycleAttempts.complete(attempt)
    await championshipSession(actor); assertCurrent()
    return result
  })
}

/** Replays only the already persisted UUID/body; a stale Retry callback cannot create a new attempt. */
export async function retryMobileLifecycle(champ: string, actor: string, attempt: MobileLifecycleAttempt, assertCurrent: Current = () => {}) {
  champ = operationUuid(champ); actor = operationUuid(actor)
  await championshipSession(actor); assertCurrent()
  return runChampionshipOperation(actor, champ, operationJson(['lifecycle-retry', attempt.requestId]), true, async () => {
    const saved = await mobileLifecycleAttempts.read(actor, champ)
    if (!saved || saved.requestId !== attempt.requestId || saved.storageKey !== attempt.storageKey || operationJson(saved.body) !== operationJson(attempt.body)) throw new Error('A tentativa mudou. Confira novamente o acompanhamento.')
    const result = await send(champ, actor, saved.requestId, saved.body, assertCurrent)
    await mobileLifecycleAttempts.complete(saved)
    await championshipSession(actor); assertCurrent()
    return result
  })
}

/** Explicit discard is local only, and shares the same lease as network operations. */
export async function discardMobileLifecycle(champ: string, actor: string, attempt: MobileLifecycleAttempt, assertCurrent: Current = () => {}) {
  champ = operationUuid(champ); actor = operationUuid(actor)
  await championshipSession(actor); assertCurrent()
  return runChampionshipOperation(actor, champ, operationJson(['lifecycle-discard', attempt.requestId]), false, async () => {
    const saved = await mobileLifecycleAttempts.read(actor, champ)
    if (!saved || saved.requestId !== attempt.requestId || saved.storageKey !== attempt.storageKey) throw new Error('A tentativa mudou. Confira novamente o acompanhamento.')
    await championshipSession(actor); assertCurrent()
    await mobileLifecycleAttempts.discard(saved); assertCurrent()
  })
}
