import {operationJson,operationUuid} from '../shared/operation-json'
export type LeagueSeasonReadContract={league_season_write_mode?:unknown;league_season_actor_id?:unknown}
export type LeagueSeasonIntent={mode:'apply_league_season_suggestions';expected:Record<string,any>}
export const seasonMode=(value:LeagueSeasonReadContract):'legacy'|'atomic'=>{
 if(value.league_season_write_mode==null||value.league_season_write_mode==='legacy')return'legacy'
 if(value.league_season_write_mode==='atomic')return'atomic'
 throw new Error('Temporada temporariamente indisponível.')
}
const object=(value:any)=>!!value&&typeof value==='object'&&!Array.isArray(value)
export function seasonIntent(value:Record<string,any>):LeagueSeasonIntent{
 if(!value||value.mode!=='apply_league_season_suggestions'||!object(value.expected)||!object(value.expected.source)||!object(value.expected.target))throw new Error('Atualize a prévia antes de confirmar a temporada.')
 return{mode:value.mode,expected:JSON.parse(operationJson(value.expected))}
}
export function assertSeasonResponse(result:any,actor:string,champ:string,body:Record<string,any>,request?:string){
 const action=body.mode==='preview_league_season_suggestions'?'preview':'apply',fail=()=>{throw new Error('Não foi possível confirmar a temporada. Confira o acompanhamento e repita a tentativa original.')}
 if(!object(result)||result.ok!==true||result.actor_id!==actor||result.campeonato_id!==champ||result.season_action!==action)fail()
 if(action==='preview'){
  const p=result.preview;if(!object(p)||!Array.isArray(p.suggestions)||!Array.isArray(p.pending)||p.pending.length>1000||!p.previous_championship_id)fail()
  operationUuid(p.previous_championship_id);seasonIntent({mode:'apply_league_season_suggestions',expected:p.fence})
  if(!p.suggestions.every((s:any)=>object(s)&&Array.isArray(s.candidatos)&&Number.isSafeInteger(s.quantidade_planejada)&&s.quantidade_planejada>=0)
   ||p.suggestions.reduce((sum:number,s:any)=>sum+s.candidatos.length,0)!==p.pending.length)fail()
  const teams=new Set(),lines=new Set(),slots=new Set()
  for(const row of p.pending){operationUuid(row.equipe_id);operationUuid(row.line_id);operationUuid(row.slot_id);operationUuid(row.grupo_id)
   if(teams.has(row.equipe_id)||lines.has(row.line_id)||slots.has(row.slot_id)||!['mantida','promovida','rebaixada'].includes(row.origem_entrada))fail()
   teams.add(row.equipe_id);lines.add(row.line_id);slots.add(row.slot_id)}
 }else{
  if(result.operation_confirmed!==true||result.request_id!==request||!Number.isSafeInteger(result.aplicadas)||result.aplicadas<1||result.aplicadas>1000
   ||!Array.isArray(result.participacoes)||result.participacoes.length!==result.aplicadas)fail()
  const ids=new Set(),slots=new Set(),teams=new Set(),lines=new Set()
  for(const row of result.participacoes){const p=row.participacao;if(!object(p)||p.campeonato_id!==champ||p.status!=='ativo'||!['liga_mantida','liga_promovida','liga_rebaixada'].includes(p.origem_entrada))fail()
   for(const value of [row.request_id,p.id,p.slot_id,p.equipe_id,p.line_id])operationUuid(value)
   if(ids.has(p.id)||slots.has(p.slot_id)||teams.has(p.equipe_id)||lines.has(p.line_id))fail();ids.add(p.id);slots.add(p.slot_id);teams.add(p.equipe_id);lines.add(p.line_id)}
 }
}
