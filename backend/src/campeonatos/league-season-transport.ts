import {supabaseAdmin} from '../shared/supabase-admin'
import {operationUuid} from '../shared/operation-json'
import {SlotTransferError} from './slot-transfer'
import {assertSeasonResponse,seasonIntent} from './league-season-contract'
export function leagueSeasonWriteMode():'legacy'|'atomic'{const mode=process.env.LEAGUE_SEASON_WRITE_MODE?.trim()||'legacy';if(mode!=='legacy'&&mode!=='atomic')throw new SlotTransferError('Temporada temporariamente indisponível.',503);return mode}
function failure(error?:{code?:string}){
 if(error?.code==='42501')return new SlotTransferError('Sem permissão para importar esta temporada.',403)
 if(['23505','23514','23503','40001','40P01','55P03'].includes(error?.code||''))return new SlotTransferError('A classificação, as cotas ou a estrutura mudaram. Confira o acompanhamento antes de repetir.',409)
 if(['22023','22003','22P02','54000'].includes(error?.code||''))return new SlotTransferError('Dados da temporada inválidos ou excessivos. Atualize a prévia.')
 return new SlotTransferError('Não foi possível confirmar a temporada. Confira o acompanhamento e repita a tentativa original.',503,true)
}
export async function tryAtomicLeagueSeason(actor:string,championship:string,body:any,key:unknown){
 if(!body||!['preview_league_season_suggestions','apply_league_season_suggestions'].includes(body.mode))return null
 if(leagueSeasonWriteMode()==='legacy')return null
 let intent,request:string|null
 try{actor=operationUuid(actor);championship=operationUuid(championship);request=body.mode==='preview_league_season_suggestions'?null:operationUuid(key);intent=request?seasonIntent(body):{mode:body.mode}}
 catch{throw new SlotTransferError('Atualize a prévia e a chave de confirmação da temporada.')}
 const args={p_actor_id:actor,p_request_id:request,p_campeonato_id:championship,p_action:request?'apply':'preview',p_expected:request?(intent as ReturnType<typeof seasonIntent>).expected:null}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000)
 try{for(let attempt=0;attempt<2;attempt++){
  let response;try{response=await supabaseAdmin.rpc('fn_operar_liga_season_atomica',args).abortSignal(controller.signal)}catch{throw failure()}
  if(response.error?.code==='40P01'&&attempt===0)continue
  if(response.error)throw failure(response.error)
  try{assertSeasonResponse(response.data,actor,championship,intent,request||undefined)}catch{throw failure()}
  return response.data
 }throw failure()}finally{clearTimeout(timeout)}
}
