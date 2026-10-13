import {supabaseAdmin} from '../shared/supabase-admin'
import {operationUuid} from '../shared/operation-json'
import {SlotTransferError} from './slot-transfer'
import {editionIntent,assertEditionResponse} from './edition-contract'
export function editionWriteMode():'legacy'|'atomic'{const value=process.env.EDITION_WRITE_MODE?.trim()||'legacy';if(value!=='legacy'&&value!=='atomic')throw new SlotTransferError('Edição temporariamente indisponível.',503);return value}
export async function tryAtomicEdition(actor:string,champ:string,body:any,key:unknown){
 if(body?.action!=='save_edition')return null
 if(editionWriteMode()!=='atomic')throw new SlotTransferError('Edição temporariamente indisponível.',503)
 let intent,request
 try{actor=operationUuid(actor);champ=operationUuid(champ);request=operationUuid(key);intent=editionIntent(body);if(intent.expected.edition&&intent.expected.edition.campeonato_id!==champ)throw Error('Scope')}catch{throw new SlotTransferError('Atualize a edição e a chave de confirmação.')}
 const {action,expected,...values}=intent;void action
 const args={p_actor_id:actor,p_request_id:request,p_campeonato_id:champ,p_values:values,p_expected:expected},controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000)
 const uncertain=()=>new SlotTransferError('Não foi possível confirmar a edição. Confira o histórico e repita a tentativa original.',503,true)
 try{for(let n=0;n<2;n++){let result;try{result=await supabaseAdmin.rpc('fn_salvar_edicao_atomica',args).abortSignal(controller.signal)}catch{throw uncertain()}
  if(result.error?.code==='40P01'&&n===0)continue
  if(result.error){const code=result.error.code;if(code==='42501')throw new SlotTransferError('Sem permissão para a edição ou para os dados compartilhados da franquia.',403)
   if(['23505','23514','23503','40001','40P01','55P03'].includes(code))throw new SlotTransferError('A edição, a franquia ou seus vínculos mudaram. Confira antes de repetir.',409)
   if(['22023','22P02','22007','22008','22003','54000'].includes(code))throw new SlotTransferError('Dados de edição inválidos ou excessivos. Atualize o histórico.')
   throw uncertain()}
  try{assertEditionResponse(result.data,actor,champ,request,intent)}catch{throw uncertain()}return result.data
 }throw uncertain()}finally{clearTimeout(timeout)}
}
