export type GroupChoiceIntent={action:'assign'|'cancel'|'restore';campeonato_equipe_id:string;source_slot_id:string|null;
  group_id:string|null;slot_id:string|null;history_id:string|null}
export type GroupChoiceAttempt={requestId:string;storageKey:string;body:GroupChoiceIntent}
const pattern=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
function uuid(value:unknown,nullable=false){if(nullable&&value===null)return null;if(typeof value!=='string'||!pattern.test(value))throw new Error('Atualize o acompanhamento antes de confirmar.');return value.toLowerCase()}
export function groupChoiceIntent(value:GroupChoiceIntent):GroupChoiceIntent {
  if(!value||!['assign','cancel','restore'].includes(value.action))throw new Error('Escolha inválida.')
  const body={action:value.action,campeonato_equipe_id:uuid(value.campeonato_equipe_id)!,source_slot_id:uuid(value.source_slot_id,true),
    group_id:uuid(value.group_id,true),slot_id:uuid(value.slot_id,true),history_id:uuid(value.history_id,true)}
  if((body.action==='assign'&&(!body.group_id||!body.slot_id||body.history_id))
    ||(body.action==='cancel'&&(!body.source_slot_id||body.group_id||body.slot_id||body.history_id))
    ||(body.action==='restore'&&(body.source_slot_id||body.group_id||body.slot_id||!body.history_id)))throw new Error('Escolha inválida.')
  return body
}
async function key(actor:string,championship:string,scope:'team'|'admin') {
  const identity=JSON.stringify([1,uuid(actor),uuid(championship),scope])
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity))
  return 'dz.group_choice.v1.'+[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('')
}
function parse(record:string,storageKey:string):GroupChoiceAttempt{const value=JSON.parse(record);return {requestId:uuid(value.requestId)!,storageKey,body:groupChoiceIntent(value.body)}}
export async function readGroupChoiceAttempt(actor:string,championship:string,scope:'team'|'admin') {
  try{const storageKey=await key(actor,championship,scope),saved=sessionStorage.getItem(storageKey);return saved?parse(saved,storageKey):null}
  catch{throw new Error('Não foi possível ler a escolha pendente no navegador.')}
}
// Persist original UUID-only intent BEFORE sending. No session token or free text is stored.
const preparing=new Map<string,Promise<GroupChoiceAttempt>>()
export async function prepareGroupChoiceAttempt(actor:string,championship:string,scope:'team'|'admin',value:GroupChoiceIntent) {
  const body=groupChoiceIntent(value),storageKey=await key(actor,championship,scope)
  let operation=preparing.get(storageKey)
  if(!operation){operation=(async()=>{try{const saved=sessionStorage.getItem(storageKey)
    if(saved)return parse(saved,storageKey)
    const requestId=crypto.randomUUID(),record=JSON.stringify({requestId,body})
    sessionStorage.setItem(storageKey,record)
    if(sessionStorage.getItem(storageKey)!==record)throw new Error('Not persisted')
    return {requestId,storageKey,body}
  }catch{throw new Error('Não foi possível guardar esta escolha no navegador. Verifique o armazenamento.')}})();preparing.set(storageKey,operation)}
  try{const attempt=await operation;if(JSON.stringify(attempt.body)!==JSON.stringify(body))throw new Error('Confirme o resultado da escolha pendente antes de iniciar outra.');return attempt}
  finally{if(preparing.get(storageKey)===operation)preparing.delete(storageKey)}
}
export function discardGroupChoiceAttempt(attempt:GroupChoiceAttempt){const saved=sessionStorage.getItem(attempt.storageKey);if(saved&&parse(saved,attempt.storageKey).requestId===attempt.requestId)sessionStorage.removeItem(attempt.storageKey)}
export function completeGroupChoiceAttempt(attempt:GroupChoiceAttempt){try{discardGroupChoiceAttempt(attempt)}catch{/* Retained intent can replay its receipt. */}}
