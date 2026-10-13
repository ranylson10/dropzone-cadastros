import { supabase } from './supabase-browser'
import { browserOperationStorage } from './browser-operation-storage'
import { runChampionshipOperation } from './championship-operation'
import { createOperationAttempts } from '@backend/shared/operation-attempt'
import { operationJson, operationUuid } from '@backend/shared/operation-json'
import { lifecycleIntent, assertLifecycleResponse, type LifecycleReadContract, type LifecycleAction } from '@backend/campeonatos/lifecycle-contract'
export const lifecycleAttempts = createOperationAttempts('lifecycle','confirmação de encerramento',lifecycleIntent,browserOperationStorage)
export function notifyLifecycleAttempt(actor: string, championship: string) { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dz:lifecycle-attempt',{ detail:{ actor,championship } })) }
async function session() { const { data,error } = await supabase.auth.getSession(); if(error || !data.session?.user.id || !data.session.access_token) throw new Error('Entre novamente para confirmar a edição.'); return { actor:data.session.user.id,token:data.session.access_token } }
async function send(champ: string, actor: string, requestId: string, body: any, assertCurrent: () => void) {
  const current = await session(); if(current.actor !== actor) throw new Error('A conta mudou. Consulte a tentativa anterior.'); assertCurrent()
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),35000)
  let response: Response, result: any
  try { response = await fetch(`/api/campeonatos/${encodeURIComponent(champ)}/estrutura-avancada/lifecycle-atomico`,{ method:'POST',cache:'no-store',signal:controller.signal,headers:{ Authorization:`Bearer ${current.token}`,'Content-Type':'application/json','Idempotency-Key':requestId },body:JSON.stringify(body) }); result = await response.json().catch(() => null) }
  catch { throw new Error('Não foi possível confirmar o resultado. Confira o histórico e repita a tentativa original.') } finally { clearTimeout(timeout) }
  if(!response.ok) throw new Error(result?.error || 'Não foi possível confirmar o resultado.')
  assertLifecycleResponse(result,actor,champ,requestId,body)
  return result
}
function bind(contract: LifecycleReadContract, actor: string) { if(contract.lifecycle_write_mode !== 'atomic') throw new Error('Encerramento e reabertura temporariamente indisponíveis.'); if(contract.edition_actor_id !== actor) throw new Error('A conta mudou. Atualize o acompanhamento.') }
export async function previewLifecycle(champ: string, contract: LifecycleReadContract, action: LifecycleAction, assertCurrent: () => void = () => {}) {
  champ = operationUuid(champ); const { actor } = await session(); bind(contract,actor); assertCurrent()
  if(!['publish_final','reopen_final'].includes(action)) throw new Error('Ação inválida.')
  const result = await send(champ,actor,operationUuid(crypto.randomUUID()),{ action:'preview_'+action },assertCurrent)
  const after = await session(); if(after.actor !== actor) throw new Error('A conta mudou. Atualize o acompanhamento.'); assertCurrent()
  return result
}
export async function writeLifecycle(champ: string, contract: LifecycleReadContract, value: Record<string,any>, assertCurrent: () => void = () => {}) {
  champ = operationUuid(champ); const { actor } = await session(); bind(contract,actor); const body = lifecycleIntent(value); assertCurrent()
  return runChampionshipOperation(actor,champ,operationJson(['lifecycle',body]),true,async () => {
    try {
      await lifecycleAttempts.read(actor,champ); const attempt = await lifecycleAttempts.prepare(actor,champ,body)
      const result = await send(champ,actor,attempt.requestId,body,assertCurrent)
      await lifecycleAttempts.complete(attempt); return result
    } finally { notifyLifecycleAttempt(actor,champ) }
  })
}
