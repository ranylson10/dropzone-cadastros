import { supabase } from './supabase-browser'
import { browserOperationStorage } from './browser-operation-storage'
import { runChampionshipOperation } from './championship-operation'
import { createOperationAttempts, type OperationAttempt } from '@backend/shared/operation-attempt'
import { operationJson, operationUuid } from '@backend/shared/operation-json'
import { assertStructureGroupResponse, structureGroupIntent, structureGroupValues, type StructureGroupIntent, type StructureGroupReadContract } from '@backend/campeonatos/structure-group-contract'

export type { StructureGroupIntent, StructureGroupReadContract }
export const structureGroupAttempts = createOperationAttempts('structure_group', 'criação de grupo', structureGroupIntent, browserOperationStorage)
export function notifyStructureGroupAttempt(actor: string, championship: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dz:structure-group-attempt', { detail: { actor, championship } }))
}
async function session(actor?: string) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user.id || !data.session.access_token || actor && actor !== data.session.user.id) throw new Error('A conta mudou. Consulte a tentativa anterior.')
  return { actor: data.session.user.id, token: data.session.access_token }
}
async function send(champ: string, actor: string, requestId: string, body: Record<string, any>, assertCurrent: () => void) {
  const current = await session(actor); assertCurrent()
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 35000)
  let response: Response, result: any
  try {
    response = await fetch(`/api/campeonatos/${encodeURIComponent(champ)}/estrutura/grupo-atomico`, {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { Authorization: `Bearer ${current.token}`, 'Content-Type': 'application/json', 'Idempotency-Key': requestId }, body: JSON.stringify(body),
    })
    result = await response.json().catch(() => null)
  } catch { throw new Error('Não foi possível confirmar o grupo. Confira a estrutura e repita a tentativa original.') } finally { clearTimeout(timeout) }
  if (!response.ok) throw new Error(result?.error || 'Criação de grupo indisponível. Repita a tentativa original.')
  assertStructureGroupResponse(result, actor, champ, requestId, body.action, structureGroupValues(body))
  return result
}
export async function writeStructureGroup(champ: string, contract: StructureGroupReadContract, value: Record<string, any>, assertCurrent: () => void = () => {}) {
  champ = operationUuid(champ)
  const { actor } = await session()
  if (contract.structure_group_write_mode !== 'atomic') throw new Error('Criação de grupo temporariamente indisponível.')
  if (contract.structure_group_actor_id !== actor) throw new Error('A conta mudou. Atualize a estrutura antes de confirmar.')
  const values = structureGroupValues(value); assertCurrent()
  return runChampionshipOperation(actor, champ, operationJson(['structure_group', values, value.expected ?? null]), true, async () => {
    try {
      const saved = await structureGroupAttempts.read(actor, champ)
      let body: StructureGroupIntent
      if (saved) {
        if (operationJson(structureGroupValues(saved.body)) !== operationJson(values) || value.expected != null && value.expected !== saved.body.expected) throw new Error('Repita ou encerre a tentativa original antes de criar outro grupo.')
        body = saved.body
      } else if (value.expected != null) body = structureGroupIntent(value)
      else {
        const preview = await send(champ, actor, operationUuid(browserOperationStorage.uuid()), { action: 'preview_create_group', ...values }, assertCurrent)
        await session(actor); assertCurrent()
        body = structureGroupIntent({ action: 'create_group', ...values, expected: preview.preview.fence })
      }
      await session(actor); assertCurrent()
      const attempt = await structureGroupAttempts.prepare(actor, champ, body)
      const result = await send(champ, actor, attempt.requestId, attempt.body, assertCurrent)
      await structureGroupAttempts.complete(attempt)
      await session(actor); assertCurrent()
      return result
    } finally { notifyStructureGroupAttempt(actor, champ) }
  })
}
export async function discardStructureGroup(champ: string, actor: string, attempt: OperationAttempt<StructureGroupIntent>, assertCurrent: () => void) {
  champ = operationUuid(champ); await session(actor); assertCurrent()
  return runChampionshipOperation(actor, champ, operationJson(['structure_group-discard', attempt.requestId]), false, async () => {
    const saved = await structureGroupAttempts.read(actor, champ)
    if (!saved || saved.requestId !== attempt.requestId || saved.storageKey !== attempt.storageKey) throw new Error('A tentativa mudou. Consulte novamente a estrutura.')
    await session(actor); assertCurrent(); await structureGroupAttempts.discard(saved); assertCurrent()
    notifyStructureGroupAttempt(actor, champ)
  })
}

/** A saved retry cannot create a fresh UUID after its receipt has been acknowledged. */
export async function retryStructureGroup(champ: string, actor: string, attempt: OperationAttempt<StructureGroupIntent>, assertCurrent: () => void) {
  champ = operationUuid(champ); actor = operationUuid(actor)
  await session(actor); assertCurrent()
  return runChampionshipOperation(actor, champ, operationJson(['structure_group-retry', attempt.requestId]), true, async () => {
    try {
      const saved = await structureGroupAttempts.read(actor, champ)
      if (!saved || saved.requestId !== attempt.requestId || saved.storageKey !== attempt.storageKey || operationJson(saved.body) !== operationJson(attempt.body)) throw new Error('A tentativa mudou. Consulte novamente a estrutura.')
      const result = await send(champ, actor, saved.requestId, saved.body, assertCurrent)
      await structureGroupAttempts.complete(saved)
      await session(actor); assertCurrent()
      return result
    } finally { notifyStructureGroupAttempt(actor, champ) }
  })
}
