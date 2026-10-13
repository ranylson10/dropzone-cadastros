import {supabase} from './supabase-browser'
import {browserOperationStorage} from './browser-operation-storage'
import {runChampionshipOperation} from './championship-operation'
import {participationAttempts} from './participation-write'
import {slotMovementAttempts} from './slot-movement-attempt'
import {progressionAttempts} from './progression-write'
import {createOperationAttempts} from '@backend/shared/operation-attempt'
import {operationJson,operationUuid} from '@backend/shared/operation-json'
import {seasonIntent,seasonMode,assertSeasonResponse,type LeagueSeasonReadContract} from '@backend/campeonatos/league-season-contract'
export const seasonAttempts=createOperationAttempts('league_season','temporada',seasonIntent,browserOperationStorage)
async function session(){const {data,error}=await supabase.auth.getSession();if(error||!data.session?.user.id||!data.session.access_token)throw new Error('Entre novamente para confirmar a temporada.');return{actor:data.session.user.id,token:data.session.access_token}}
export function notifySeasonAttempt(actor:string,championship:string){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('dz:season-attempt',{detail:{actor,championship}}))}
export async function writeLeagueSeason(championship:string,contract:LeagueSeasonReadContract,value:Record<string,any>,assertCurrent:()=>void=()=>{}){
 championship=operationUuid(championship);const {actor}=await session(),mode=seasonMode(contract),preview=value.mode==='preview_league_season_suggestions'
 if(mode!=='atomic')throw new Error('Confirmação de temporada temporariamente indisponível.')
 if(contract.league_season_actor_id!==actor)throw new Error('A conta mudou. Atualize o acompanhamento antes de confirmar.')
 const body=preview?{mode:value.mode}:seasonIntent(value);assertCurrent()
 return runChampionshipOperation(actor,championship,operationJson(['league_season',body]),true,async()=>{
  try{
   const pending=await seasonAttempts.read(actor,championship)
   if(preview&&pending)throw new Error('Confirme a temporada pendente antes de gerar outra prévia.')
   if(await participationAttempts.read(actor,championship)||await slotMovementAttempts.read(actor,championship)||await progressionAttempts.read(actor,championship))throw new Error('Há outra operação aguardando confirmação neste campeonato.')
   const attempt=preview?null:await seasonAttempts.prepare(actor,championship,body),current=await session()
   if(current.actor!==actor)throw new Error('A conta mudou. Consulte a tentativa anterior.');assertCurrent()
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),35000)
   let response:Response,result:any
   try{response=await fetch(`/api/campeonatos/${encodeURIComponent(championship)}/equipes/temporada-atomica`,{method:'POST',cache:'no-store',signal:controller.signal,
    headers:{Authorization:`Bearer ${current.token}`,'Content-Type':'application/json',...(attempt?{'Idempotency-Key':attempt.requestId}:{})},body:JSON.stringify(body)})
    result=await response.json().catch(()=>null)
   }catch{throw new Error('Não foi possível confirmar a temporada. Confira o acompanhamento e repita a tentativa original.')}finally{clearTimeout(timeout)}
   if(!response.ok)throw new Error(result?.error||'Não foi possível confirmar a temporada. Confira o acompanhamento.')
   assertSeasonResponse(result,actor,championship,body,attempt?.requestId);if(attempt)await seasonAttempts.complete(attempt)
   return result
  }finally{notifySeasonAttempt(actor,championship)}
 })
}
