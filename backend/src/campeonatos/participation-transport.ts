import { supabaseAdmin } from '../shared/supabase-admin'
import { SlotTransferError } from './slot-transfer'
const pattern=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
type Action='request'|'add'|'approve'|'reject'|'remove'
export function participationWriteMode() {
  const mode=process.env.PARTICIPATION_WRITE_MODE?.trim()||'legacy'
  if(!['legacy','atomic'].includes(mode))throw new SlotTransferError('Inscrições temporariamente indisponíveis.',503)
  return mode
}
function uuid(value:unknown,nullable=false):string|null {
  if(nullable&&value==null)return null
  if(typeof value!=='string'||!pattern.test(value.trim()))throw new SlotTransferError('Identificador de participação inválido.')
  return value.trim().toLowerCase()
}
function text(value:unknown,max:number) {
  if(value==null)return null
  if(typeof value!=='string'||value.length>max)throw new SlotTransferError('Texto de participação inválido.')
  return value.trim()||null
}
const messages:Record<string,number>={
  'Dados de participação inválidos.':400,'Acompanhamento de participação inválido.':400,
  'Sem permissão para alterar inscrições.':403,'Permissão de vendedor direto indisponível.':403,
  'A equipe informada não pertence ao seu perfil.':403,'O vendedor só pode remover equipes que ele adicionou.':403,
  'Campeonato fechado ou indisponível para inscrição.':403,'Equipe indisponível para inscrição.':400,
  'Escolha o slot antes de confirmar a inscrição.':400,'Line inválida ou inativa.':400,'Informe um nome real para a line.':400,
  'A participação mudou. Atualize o acompanhamento.':409,'Localização da participação exige reconciliação.':409,
  'A participação mudou durante a confirmação.':409,
  'Espelho da participação exige reconciliação.':409,'Slot fora da estrutura do campeonato.':400,
  'Slot ocupado ou reservado.':409,'Esta line já está inscrita ou pendente.':409,'Limite de vagas do vendedor atingido.':409,
  'Origem da Liga inválida.':400,'Configuração da Liga indisponível.':400,'Cota da origem na Liga preenchida ou indisponível.':409,
  'A equipe já ocupa uma vaga nesta Liga.':409,'Prazo de inscrição encerrou durante a operação.':403,
  'Motivo de revisão inválido.':400,'Gatilho de slots incompatível com a inscrição.':503,
  'Chave de repetição vinculada a outra participação.':409,'Conta indisponível para movimentação.':403,'Campeonato indisponível para movimentação.':403,
}
function rpcError(error?:{code?:string;message?:string}) {
  if(error?.message&&['22023','42501','23505','23514','40001'].includes(error.code||'')&&messages[error.message])return new SlotTransferError(error.message,messages[error.message])
  if(['23505','23514','40001','40P01','55P03'].includes(error?.code||''))return new SlotTransferError('Outra operação alterou a participação. Atualize o acompanhamento.',409)
  if(['PGRST202','42883'].includes(error?.code||''))return new SlotTransferError('Inscrições temporariamente indisponíveis.',503)
  return new SlotTransferError('Não foi possível confirmar a inscrição. Confira o acompanhamento e repita os dados originais.',503,true)
}
/** One RPC with trusted session actor. No table pre-read, retry, compensation or fallback. */
export async function tryAtomicParticipation(actor:string,championship:string,method:'POST'|'PATCH'|'DELETE',body:unknown,key:unknown,removalId?:unknown) {
  if(participationWriteMode()==='legacy')return null
  if(!body||typeof body!=='object'||Array.isArray(body))throw new SlotTransferError('Dados de participação inválidos.')
  const value=body as Record<string,unknown>
  let action:Action
  if(method==='DELETE')action='remove'
  else if(method==='PATCH') {
    if(value.mode!=='review_request')return null
    if(!['approve','reject'].includes(String(value.action)))throw new SlotTransferError('Revisão de participação inválida.')
    action=value.action as 'approve'|'reject'
  }else if(value.mode==='request')action='request'
  else {
    if(value.mode==='apply_league_season_suggestions')throw new SlotTransferError('Sugestões de season ainda precisam de integração transacional.',503)
    if(value.mode!=null&&value.mode!=='')throw new SlotTransferError('Dados de participação inválidos.')
    action='add'
  }
  if(!key)throw new SlotTransferError('Atualize o aplicativo para guardar e confirmar esta inscrição.')
  const args:Record<string,unknown>={}
  if(action==='request'||action==='add') {
    args.equipe_id=uuid(value.equipe_id);args.line_id=uuid(value.line_id,true)
    if(action==='request'&&!args.line_id)throw new SlotTransferError('Selecione a line da inscrição.')
    if(action==='add') {
      args.slot_id=uuid(value.slot_id||value.vaga_id);args.nome_line=text(value.nome_line,120);args.origem_entrada=text(value.origem_entrada,40)
      if(!args.line_id&&!args.nome_line)throw new SlotTransferError('Selecione uma line ou informe seu nome.')
    }
  }else {
    args.participacao_id=uuid(action==='remove'?removalId:value.participacao_id||value.request_id)
    if(!value.expected||typeof value.expected!=='object'||Array.isArray(value.expected))throw new SlotTransferError('Atualize o acompanhamento antes de alterar a participação.')
    const expected=value.expected as Record<string,unknown>
    if(!Object.hasOwn(expected,'slot_id')||!['ativo','pendente','rejeitado'].includes(String(expected.status))
      ||typeof expected.updated_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(expected.updated_at)
      ||!Number.isFinite(Date.parse(expected.updated_at)))throw new SlotTransferError('Acompanhamento de participação inválido.')
    args.expected={equipe_id:uuid(expected.equipe_id),line_id:uuid(expected.line_id),slot_id:uuid(expected.slot_id,true),status:expected.status,updated_at:expected.updated_at}
    if((action==='remove'&&expected.status!=='ativo')||(action!=='remove'&&(expected.status==='ativo'||expected.slot_id!==null)))throw new SlotTransferError('Acompanhamento de participação inválido.')
    if(action==='approve'){args.slot_id=uuid(value.slot_id);args.origem_entrada=text(value.origem_entrada,40)}
    if(action==='reject')args.motivo=text(value.motivo,500)
  }
  const rpcArgs={p_actor_id:uuid(actor),p_request_id:uuid(key),p_campeonato_id:uuid(championship),p_action:action,p_args:args}
  let response
  try{response=await supabaseAdmin.rpc('fn_gravar_participacao_atomica',rpcArgs)}catch{throw rpcError()}
  if(response.error)throw rpcError(response.error)
  const result=response.data,part=result?.participacao,expected=args.expected as Record<string,unknown>|undefined
  const status=action==='request'?'pendente':action==='reject'?'rejeitado':action==='remove'?'removido':'ativo'
  if(!result||result.ok!==true||result.campeonato_id!==rpcArgs.p_campeonato_id||result.action!==action||part?.status!==status
    ||part.campeonato_id!==rpcArgs.p_campeonato_id||!pattern.test(part.id||'')||!pattern.test(part.equipe_id||'')||!pattern.test(part.line_id||'')
    ||typeof part.updated_at!=='string'||!Number.isFinite(Date.parse(part.updated_at))
    ||(args.participacao_id&&part.id!==args.participacao_id)||(args.equipe_id&&part.equipe_id!==args.equipe_id)
    ||(args.line_id&&part.line_id!==args.line_id)||(expected&&(part.equipe_id!==expected.equipe_id||part.line_id!==expected.line_id))
    ||(['add','approve'].includes(action)?part.slot_id!==args.slot_id||!pattern.test(part.grupo_id||'')||!Number.isInteger(part.slot_numero)||part.slot_numero<1
      :part.slot_id!==null||part.grupo_id!==null||part.slot_numero!==null)
    ||(action==='reject'&&part.motivo_rejeicao!==args.motivo)
    ||(['add','request','approve'].includes(action)&&(!result.line||result.line.id!==part.line_id||typeof result.line.nome!=='string'||typeof result.line.criada_agora!=='boolean')))throw rpcError()
  return {ok:true,operation_confirmed:true,campeonato_id:rpcArgs.p_campeonato_id,action,...(result.repetida===true?{repetida:true}:{}),
    participacao:{id:part.id,campeonato_id:part.campeonato_id,equipe_id:part.equipe_id,line_id:part.line_id,status:part.status,
      slot_id:part.slot_id,grupo_id:part.grupo_id,slot_numero:part.slot_numero,updated_at:part.updated_at,
      ...(action==='reject'?{motivo_rejeicao:part.motivo_rejeicao}: {})},
    ...(['add','request','approve'].includes(action)?{line:{id:result.line.id,nome:result.line.nome,criada_agora:result.line.criada_agora}}:{})}
}
