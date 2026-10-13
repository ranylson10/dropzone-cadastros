import {supabase} from './supabase-browser'
import {browserOperationStorage} from './browser-operation-storage'
import {runChampionshipOperation} from './championship-operation'
import {createOperationAttempts} from '@backend/shared/operation-attempt'
import {operationJson,operationUuid} from '@backend/shared/operation-json'
import {dailyGroupIntent,assertDailyGroupResponse,type DailyGroupReadContract} from '@backend/campeonatos/daily-group-contract'
export const dailyGroupAttempts=createOperationAttempts('daily_group','vinculação de horário',dailyGroupIntent,browserOperationStorage)
export function notifyDailyGroupAttempt(actor:string,championship:string){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('dz:daily-group-attempt',{detail:{actor,championship}}))}
async function session(){const{data,error}=await supabase.auth.getSession();if(error||!data.session?.user.id||!data.session.access_token)throw new Error('Entre novamente para vincular o horário.');return{actor:data.session.user.id,token:data.session.access_token}}
export async function writeDailyGroup(champ:string,contract:DailyGroupReadContract,value:Record<string,any>,assertCurrent:()=>void=()=>{}){
 champ=operationUuid(champ);const{actor}=await session();if(contract.daily_group_write_mode!=='atomic')throw new Error('Vínculo de horário temporariamente indisponível.')
 if(contract.daily_group_actor_id!==actor)throw new Error('A conta mudou. Atualize a estrutura antes de confirmar.')
 const body=dailyGroupIntent(value);if(body.expected.hours.some(r=>r.campeonato_id!==champ))throw new Error('Estrutura do Diário incompatível.');assertCurrent()
 return runChampionshipOperation(actor,champ,operationJson(['daily_group',body]),true,async()=>{try{
  await dailyGroupAttempts.read(actor,champ)
  const attempt=await dailyGroupAttempts.prepare(actor,champ,body),current=await session();if(current.actor!==actor)throw new Error('A conta mudou. Consulte a tentativa anterior.');assertCurrent()
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);let response:Response,result:any
  try{response=await fetch(`/api/campeonatos/${encodeURIComponent(champ)}/estrutura-avancada/horario-grupo-atomico`,{method:'POST',cache:'no-store',signal:controller.signal,headers:{Authorization:`Bearer ${current.token}`,'Content-Type':'application/json','Idempotency-Key':attempt.requestId},body:JSON.stringify(body)});result=await response.json().catch(()=>null)}
  catch{throw new Error('Não foi possível confirmar o vínculo. Confira a estrutura e repita a tentativa original.')}finally{clearTimeout(timeout)}
  if(!response.ok)throw new Error(result?.error||'Não foi possível confirmar o vínculo.')
  assertDailyGroupResponse(result,actor,champ,body,attempt.requestId);await dailyGroupAttempts.complete(attempt);return result
 }finally{notifyDailyGroupAttempt(actor,champ)}})
}
