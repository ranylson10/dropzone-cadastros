import { supabaseAdmin } from '../shared/supabase-admin'
import { SlotTransferError, slotMovementMode } from './slot-transfer'
const pattern=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
function uuid(value: unknown, nullable=false) {
  if(nullable && value===null)return null
  if(typeof value!=='string'||!pattern.test(value.trim()))throw new SlotTransferError('Identificador de escolha inválido.')
  return value.trim().toLowerCase()
}
const messages: Record<string,number>={
  'Dados de escolha inválidos.':400,'Ação de escolha inválida.':400,'Grupo ou slot fora do campeonato.':400,
  'Cancele a escolha atual antes de restaurar outra.':409,'Destino diferente do último cancelamento.':409,
  'Chave de repetição vinculada a outra escolha.':409,'A participação mudou. Atualize o plano.':409,
  'O histórico mudou. Atualize o acompanhamento.':409,'Destino ocupado ou reservado fora do plano.':409,
  'Espelho de origem exige reconciliação.':409,'Localização legada exige reconciliação.':409,
  'Participação indisponível para escolha.':403,'Esta participação não pertence à sua equipe.':403,
  'Conta indisponível para movimentação.':403,'Campeonato indisponível para movimentação.':403,
  'Sem permissão para movimentar slots.':403,'A escolha de grupos não está aberta para esta fase.':403,
  'A alteração de escolha está bloqueada nesta fase.':403,'O grupo ou slot está bloqueado pela administração.':403,
  'Gatilho de slots incompatível com a movimentação.':503,
}
function rpcError(error?:{code?:string;message?:string}) {
  if(error?.message&&['22023','42501','23505','23514','40001'].includes(error.code||'')&&messages[error.message])return new SlotTransferError(error.message,messages[error.message])
  if(['23505','23514','40001','40P01','55P03'].includes(error?.code||''))return new SlotTransferError('Outra operação alterou a escolha. Confira o acompanhamento e tente novamente.',409)
  if(['PGRST202','42883'].includes(error?.code||''))return new SlotTransferError('Escolha temporariamente indisponível.',503)
  return new SlotTransferError('Não foi possível confirmar a escolha. Confira o acompanhamento e repita com os mesmos dados.',503,true)
}
/** ONE RPC, no slot/history pre-read, automatic retry, compensation or fallback. */
export async function tryAtomicGroupChoice(actorId:string,championshipId:string,scope:'team'|'admin',action:'assign'|'cancel'|'restore',body:unknown,key:unknown) {
  if(slotMovementMode()==='legacy')return null
  if(!body||typeof body!=='object'||Array.isArray(body))throw new SlotTransferError('Dados de escolha inválidos.')
  const value=body as Record<string,unknown>
  if(!Object.hasOwn(value,'source_slot_id'))throw new SlotTransferError('Atualize o acompanhamento antes de confirmar a escolha.')
  if(!key)throw new SlotTransferError('Atualize o aplicativo para guardar e confirmar esta escolha.')
  if(value.note!=null&&typeof value.note!=='string')throw new SlotTransferError('Observação inválida.')
  const note=typeof value.note==='string'?value.note.trim()||null:null
  if(note&&note.length>500)throw new SlotTransferError('Observação inválida.')
  const args={p_actor_id:uuid(actorId),p_request_id:uuid(key),p_campeonato_id:uuid(championshipId),p_scope:scope,p_action:action,
    p_participation_id:uuid(value.campeonato_equipe_id),p_expected_source_slot_id:uuid(value.source_slot_id,true),
    p_group_id:action==='assign'?uuid(scope==='team'?value.grupo_id:value.group_id):null,
    p_slot_id:action==='assign'?uuid(value.slot_id):null,p_history_id:action==='restore'?uuid(value.history_id):null,p_note:scope==='admin'?note:null}
  if((action==='cancel'&&!args.p_expected_source_slot_id)||(action==='restore'&&args.p_expected_source_slot_id))throw new SlotTransferError('Dados de escolha inválidos.')
  let response
  try{response=await supabaseAdmin.rpc('fn_escolher_grupo_atomico',args)}catch{throw rpcError()}
  if(response.error)throw rpcError(response.error)
  const result=response.data,part=result?.participacoes?.[0]
  if(!result||result.ok!==true||result.campeonato_id!==args.p_campeonato_id||result.action!==action||result.choice_action!==action
    ||result.scope!==scope||result.participation_id!==args.p_participation_id||result.source_slot_id!==args.p_expected_source_slot_id
    ||result.history_id!==args.p_history_id||!Array.isArray(result.participacoes)||result.participacoes.length!==1||part?.id!==args.p_participation_id
    ||!pattern.test(part.equipe_id||'')||!pattern.test(part.line_id||'')||typeof part.updated_at!=='string'||!Number.isFinite(Date.parse(part.updated_at))
    ||(action==='cancel'?(result.target_slot_id!==null||part.slot_id!==null||part.grupo_id!==null||part.slot_numero!==null)
      :(!pattern.test(result.target_slot_id||'')||part.slot_id!==result.target_slot_id||!pattern.test(part.grupo_id||'')||!Number.isInteger(part.slot_numero)||part.slot_numero<1))
    ||(action==='assign'&&(result.target_slot_id!==args.p_slot_id||part.grupo_id!==args.p_group_id)))throw rpcError()
  return {ok:true,operation_confirmed:true,campeonato_id:result.campeonato_id,choice_action:action,scope,
    participation_id:part.id,source_slot_id:result.source_slot_id,target_slot_id:result.target_slot_id,history_id:result.history_id,
    ...(result.repetida===true?{repetida:true}:{}),participacoes:[{id:part.id,equipe_id:part.equipe_id,line_id:part.line_id,
      grupo_id:part.grupo_id,slot_id:part.slot_id,slot_numero:part.slot_numero,updated_at:part.updated_at}]}
}
