import { supabaseAdmin } from '../shared/supabase-admin'
import { SlotTransferError } from './slot-transfer'

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function requiredUuid(value:unknown):string {
  if(typeof value!=='string'||!uuidPattern.test(value.trim()))throw new SlotTransferError('Identificador de bloqueio inválido.',400)
  return value.trim().toLowerCase()
}
function optionalUuid(value:unknown):string|null {
  if(value==null||value==='')return null
  return requiredUuid(value)
}
/** Opt-in only after staging deployment of BOTH R10 writers and R09 atomic callers. */
export function groupBlockWriteMode():'legacy'|'atomic' {
  const mode=process.env.DROPZONE_GROUP_BLOCK_WRITE_MODE?.trim()||'legacy'
  if(mode!=='legacy'&&mode!=='atomic')throw new SlotTransferError('Bloqueios temporariamente indisponíveis.',503)
  return mode
}
function mappedError(error?:{code?:string;message?:string}){
  const code=error?.code||''
  if(['PGRST202','42883'].includes(code))return new SlotTransferError('Bloqueios temporariamente indisponíveis.',503)
  if(code==='42501')return new SlotTransferError('Sem permissão para bloquear vagas.',403)
  if(code==='22023')return new SlotTransferError('Dados de bloqueio inválidos ou desatualizados.',400)
  if(['23505','40001','40P01','55P03'].includes(code))return new SlotTransferError('O bloqueio mudou. Atualize a estrutura e tente novamente.',409)
  return new SlotTransferError('Não foi possível confirmar o bloqueio. Confira a estrutura antes de repetir.',503,true)
}
export async function tryAtomicGroupBlock(actorId:string,championshipId:string,body:unknown,key:unknown){
  if(groupBlockWriteMode()==='legacy')return null
  if(!body||typeof body!=='object'||Array.isArray(body))throw new SlotTransferError('Dados de bloqueio inválidos.',400)
  const b=body as Record<string,unknown>
  if(b.action!=='set_group_choice_block'&&b.action!=='remove_group_choice_block')return null
  if(!key)throw new SlotTransferError('Atualize a página para confirmar este bloqueio com uma chave de repetição.',409)
  const block=b.action==='set_group_choice_block'
  const args={
    p_actor_id:requiredUuid(actorId),p_request_id:requiredUuid(key),p_campeonato_id:requiredUuid(championshipId),
    p_action:block?'block':'unblock',p_fase_id:block?requiredUuid(b.phase_id):null,
    p_grupo_id:block?optionalUuid(b.group_id):null,
    p_slot_id:block?optionalUuid(b.slot_id):null,
    p_block_id:block?null:requiredUuid(b.block_id),
    p_reason:block?(typeof b.reason==='string'?(b.reason.trim()||null):null):null,
  }
  if(block&&((args.p_grupo_id===null)===(args.p_slot_id===null)))throw new SlotTransferError('Informe um grupo ou um slot.',400)
  if(args.p_reason&&args.p_reason.length>300)throw new SlotTransferError('Motivo muito longo.',400)
  let response
  try{response=await supabaseAdmin.rpc('fn_alterar_bloqueio_grupo_atomico',args)}catch{throw mappedError()}
  if(response.error)throw mappedError(response.error)
  const result=response.data
  if(!result||result.ok!==true||result.campeonato_id!==args.p_campeonato_id||result.action!==args.p_action
    ||!uuidPattern.test(result.block_id||'')||typeof result.ativo!=='boolean'
    ||result.ativo!==block||(!block&&result.block_id!==args.p_block_id))throw mappedError()
  return {ok:true,operation_confirmed:true,action:b.action,block_id:result.block_id,
    ...(result.repetida===true?{repetida:true}:{})}
}
