import {supabaseAdmin} from '../shared/supabase-admin'
const direct=new Set(['campeonato_diario_horarios','campeonato_etapa_equipes','campeonato_grupo_escolha_configuracoes','campeonato_grupo_escolha_bloqueios'])
const edition=new Set(['campeonato_divisoes','campeonato_etapas'])
const stage:Record<string,string>={campeonato_etapa_fontes:'etapa_destino_id',campeonato_progressao_regras:'etapa_origem_id',campeonato_etapa_premiacoes:'etapa_id'}
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
/** Caller must already require championship management. Refuse foreign IDs before DELETE. */
export async function deleteScopedStructureRow(championshipId:string,table:string,rowId:string) {
  if(!uuid.test(championshipId)||!uuid.test(rowId)||(!direct.has(table)&&!edition.has(table)&&!stage[table]))throw new Error('Exclusão inválida.')
  let deletion=supabaseAdmin.from(table).delete().eq('id',rowId)
  if(direct.has(table))deletion=deletion.eq('campeonato_id',championshipId)
  else{
    const parentColumn=edition.has(table)?'edicao_id':stage[table]
    const {data:row,error}=await supabaseAdmin.from(table).select(`id,${parentColumn}`).eq('id',rowId).maybeSingle()
    if(error)throw error
    const record=row as unknown as Record<string,unknown>|null
    const parentId=record?.[parentColumn]
    if(typeof parentId!=='string'||!uuid.test(parentId))throw new Error('Registro não encontrado neste campeonato.')
    let editionId=parentId
    if(!edition.has(table)){
      const {data:parent,error:parentError}=await supabaseAdmin.from('campeonato_etapas').select('id,edicao_id').eq('id',editionId).maybeSingle()
      if(parentError)throw parentError
      if(!parent?.edicao_id)throw new Error('Registro não encontrado neste campeonato.')
      editionId=String(parent.edicao_id)
    }
    const {data:parent,error:parentError}=await supabaseAdmin.from('campeonato_edicoes').select('id').eq('id',editionId).eq('campeonato_id',championshipId).maybeSingle()
    if(parentError)throw parentError
    if(!parent)throw new Error('Registro não encontrado neste campeonato.')
    deletion=deletion.eq(parentColumn,parentId)
  }
  const {data,error}=await deletion.select('id').maybeSingle()
  if(error)throw error
  if(!data)throw new Error('Registro não encontrado neste campeonato ou alterado por outra operação.')
}
