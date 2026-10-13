import {supabase} from './supabase-browser'
import {browserOperationStorage} from './browser-operation-storage'
import {runChampionshipOperation} from './championship-operation'
import {createOperationAttempts} from '@backend/shared/operation-attempt'
import {operationJson,operationUuid} from '@backend/shared/operation-json'
import {editionIntent,assertEditionResponse,type EditionReadContract} from '@backend/campeonatos/edition-contract'
export const editionAttempts=createOperationAttempts('edition','edição',editionIntent,browserOperationStorage)
export function notifyEditionAttempt(actor:string,championship:string){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('dz:edition-attempt',{detail:{actor,championship}}))}
async function session(){const{data,error}=await supabase.auth.getSession();if(error||!data.session?.user.id||!data.session.access_token)throw new Error('Entre novamente para salvar a edição.');return{actor:data.session.user.id,token:data.session.access_token}}
export async function writeEdition(champ:string,contract:EditionReadContract,value:Record<string,any>,assertCurrent:()=>void=()=>{}){
 champ=operationUuid(champ);const{actor}=await session();if(contract.edition_write_mode!=='atomic')throw new Error('Edição temporariamente indisponível.')
 if(contract.edition_actor_id!==actor)throw new Error('A conta mudou. Atualize a estrutura antes de confirmar.')
 const body=editionIntent(value);if(body.expected.edition&&body.expected.edition.campeonato_id!==champ)throw new Error('Edição incompatível.');assertCurrent()
 return runChampionshipOperation(actor,champ,operationJson(['edition',body]),true,async()=>{try{
  await editionAttempts.read(actor,champ)
  const attempt=await editionAttempts.prepare(actor,champ,body),current=await session();if(current.actor!==actor)throw new Error('A conta mudou. Consulte a tentativa anterior.');assertCurrent()
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),35000);let response:Response,result:any
  try{response=await fetch(`/api/campeonatos/${encodeURIComponent(champ)}/estrutura-avancada/edicao-atomica`,{method:'POST',cache:'no-store',signal:controller.signal,headers:{Authorization:`Bearer ${current.token}`,'Content-Type':'application/json','Idempotency-Key':attempt.requestId},body:JSON.stringify(body)});result=await response.json().catch(()=>null)}
  catch{throw new Error('Não foi possível confirmar o resultado da edição. Confira a estrutura e repita a tentativa original.')}finally{clearTimeout(timeout)}
  if(!response.ok)throw new Error(result?.error||'Não foi possível confirmar o resultado da edição.')
  assertEditionResponse(result,actor,champ,attempt.requestId,body);await editionAttempts.complete(attempt);return result
 }finally{notifyEditionAttempt(actor,champ)}})
}
