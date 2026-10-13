import {supabaseAdmin} from '../shared/supabase-admin'
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
type Parent='campeonato_edicoes'|'campeonato_etapas'|'campeonato_divisoes'|'campeonato_fases'|'campeonato_grupos'|'campeonato_slots'|'campeonato_diario_horarios'
type ParentRow={id:string;campeonato_id?:string;edicao_id?:string;fase_id?:string}
async function parent(championshipId:string,table:Parent,value:unknown) {
  if(typeof value!=='string'||!uuid.test(value))throw new Error('Referência de estrutura inválida.')
  const nested=table==='campeonato_etapas'||table==='campeonato_divisoes'
  const columns=nested?'id,edicao_id':table==='campeonato_grupos'||table==='campeonato_slots'?'id,campeonato_id,fase_id':'id,campeonato_id'
  let query=supabaseAdmin.from(table).select(columns).eq('id',value)
  if(!nested)query=query.eq('campeonato_id',championshipId)
  const {data,error}=await query.maybeSingle()
  if(error)throw error
  const row=data as unknown as ParentRow|null
  if(!row)throw new Error('Referência fora deste campeonato.')
  if(nested)await parent(championshipId,'campeonato_edicoes',row.edicao_id)
  return row
}
/** Validate supplied parent IDs before any legacy write. Does not replace transaction locks. */
export async function assertStructureActionScope(actorId:string,championshipId:string,body:Record<string,unknown>) {
  const optional=async(table:Parent,value:unknown)=>{if(value!=null&&value!=='')await parent(championshipId,table,value)}
  switch(body.action){
    case 'create_division':await parent(championshipId,'campeonato_edicoes',body.edition_id);break
    case 'create_stage':{
      const edition=await parent(championshipId,'campeonato_edicoes',body.edition_id)
      if(body.division_id){const division=await parent(championshipId,'campeonato_divisoes',body.division_id);if(division.edicao_id!==edition.id)throw new Error('A divisão não pertence à edição selecionada.')}
      break
    }
    case 'create_source':
      await parent(championshipId,'campeonato_etapas',body.stage_id);await optional('campeonato_etapas',body.source_stage_id);await optional('campeonato_divisoes',body.source_division_id);break
    case 'create_progression':
      await parent(championshipId,'campeonato_etapas',body.stage_id);await optional('campeonato_etapas',body.destination_stage_id);await optional('campeonato_divisoes',body.destination_division_id);break
    case 'create_prize':await parent(championshipId,'campeonato_etapas',body.stage_id);break
    case 'set_group_choice_block':{
      const phase=await parent(championshipId,'campeonato_fases',body.phase_id)
      const group=Boolean(body.group_id),slot=Boolean(body.slot_id)
      if(group===slot)throw new Error('Informe apenas grupo ou slot para o bloqueio.')
      const target=await parent(championshipId,group?'campeonato_grupos':'campeonato_slots',group?body.group_id:body.slot_id)
      if(target.fase_id!==phase.id)throw new Error('O bloqueio não pertence à fase selecionada.')
      break
    }
    case 'link_daily_group':await parent(championshipId,'campeonato_diario_horarios',body.daily_hour_id);await parent(championshipId,'campeonato_grupos',body.group_id);break
    case 'save_edition':if(body.franchise_id){
      const franchiseId=String(body.franchise_id)
      if(!uuid.test(franchiseId))throw new Error('Franquia inválida.')
      const {data:edition,error}=await supabaseAdmin.from('campeonato_edicoes').select('id,franquia_id').eq('campeonato_id',championshipId).maybeSingle()
      if(error)throw error
      if(edition?.franquia_id!==franchiseId){
        const {data,error:franchiseError}=await supabaseAdmin.from('campeonato_franquias').select('id').eq('id',franchiseId).eq('criado_por',actorId).maybeSingle()
        if(franchiseError)throw franchiseError
        if(!data)throw new Error('Franquia não autorizada para este campeonato.')
      }
    }break
  }
}
