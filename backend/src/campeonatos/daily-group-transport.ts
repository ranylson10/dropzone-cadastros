import {supabaseAdmin} from '../shared/supabase-admin'
import {operationUuid} from '../shared/operation-json'
import {SlotTransferError} from './slot-transfer'
import {dailyGroupIntent,assertDailyGroupResponse} from './daily-group-contract'
export function dailyGroupWriteMode():'legacy'|'atomic'{const value=process.env.DAILY_GROUP_WRITE_MODE?.trim()||'legacy';if(value!=='legacy'&&value!=='atomic')throw new SlotTransferError('Vínculo de horário temporariamente indisponível.',503);return value}
export async function tryAtomicDailyGroup(actor:string,champ:string,body:any,key:unknown){
 if(body?.action!=='link_daily_group')return null
 if(dailyGroupWriteMode()!=='atomic')throw new SlotTransferError('Vínculo de horário temporariamente indisponível.',503)
 let intent,request
 try{actor=operationUuid(actor);champ=operationUuid(champ);request=operationUuid(key);intent=dailyGroupIntent(body);if(intent.expected.hours.some(r=>r.campeonato_id!==champ))throw Error('Scope')}catch{throw new SlotTransferError('Atualize a estrutura e a chave de confirmação do vínculo.')}
 const args={p_actor_id:actor,p_request_id:request,p_campeonato_id:champ,p_daily_hour_id:intent.daily_hour_id,p_group_id:intent.group_id,p_expected:intent.expected}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000)
 const uncertain=()=>new SlotTransferError('Não foi possível confirmar o vínculo. Confira a estrutura e repita a tentativa original.',503,true)
 try{for(let n=0;n<2;n++){let result;try{result=await supabaseAdmin.rpc('fn_vincular_diario_grupo_atomico',args).abortSignal(controller.signal)}catch{throw uncertain()}
  if(result.error?.code==='40P01'&&n===0)continue
  if(result.error){const code=result.error.code;if(code==='42501')throw new SlotTransferError('Sem permissão para vincular horários.',403)
   if(['23505','23514','23503','40001','40P01','55P03'].includes(code))throw new SlotTransferError('A estrutura mudou ou possui vínculos inconsistentes. Confira antes de repetir.',409)
   if(['22023','22P02','22007','22008','54000'].includes(code))throw new SlotTransferError('Dados do vínculo inválidos ou excessivos. Atualize a estrutura.')
   throw uncertain()}
  try{assertDailyGroupResponse(result.data,actor,champ,intent,request)}catch{throw uncertain()}return result.data
 }throw uncertain()}finally{clearTimeout(timeout)}
}
