import {operationJson,operationUuid} from '../shared/operation-json'
export type DailyGroupReadContract={daily_group_write_mode?:unknown;daily_group_actor_id?:unknown}
export type DailyGroupIntent={action:'link_daily_group';daily_hour_id:string;group_id:string;expected:{groups:Record<string,any>[];hours:Record<string,any>[]}}
const timestamp=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Atualize a estrutura antes de vincular o horário.');return value}
export function dailyGroupSnapshot(champ:string,groups:Record<string,any>[],hours:Record<string,any>[]){
 champ=operationUuid(champ);const project=(rows:Record<string,any>[],link:string)=>{if(!Array.isArray(rows)||rows.length>2000)throw new Error('Estrutura do Diário excessiva.');const ids=new Set<string>()
  return rows.map(row=>{const id=operationUuid(row.id);if(ids.has(id)||row.campeonato_id!==champ)throw new Error('Estrutura do Diário incompatível.');ids.add(id);return{id,campeonato_id:champ,[link]:row[link]==null?null:operationUuid(row[link]),updated_at:timestamp(row.updated_at)}}).sort((a,b)=>a.id.localeCompare(b.id))}
 return{groups:project(groups,'diario_horario_id'),hours:project(hours,'grupo_id')}
}
export function dailyGroupIntent(value:Record<string,any>):DailyGroupIntent{
 if(value?.action!=='link_daily_group'||!value.expected)throw new Error('Atualize a estrutura antes de vincular o horário.')
 const hour=operationUuid(value.daily_hour_id),group=operationUuid(value.group_id),champ=value.expected.hours?.find((r:any)=>r.id===hour)?.campeonato_id
 const expected=dailyGroupSnapshot(champ,value.expected.groups,value.expected.hours)
 if(!expected.groups.some(r=>r.id===group))throw new Error('Grupo fora da estrutura apresentada.')
 return{action:'link_daily_group',daily_hour_id:hour,group_id:group,expected:JSON.parse(operationJson(expected))}
}
export function assertDailyGroupResponse(value:any,actor:string,champ:string,intent:DailyGroupIntent,key:string){
 const fail=()=>{throw new Error('Não foi possível confirmar o vínculo. Confira a estrutura e repita a tentativa original.')}
 if(value?.ok!==true||value.operation_confirmed!==true||value.actor_id!==actor||value.campeonato_id!==champ||value.request_id!==key||value.daily_group_action!=='link'||value.daily_hour_id!==intent.daily_hour_id||value.group_id!==intent.group_id)fail()
 const snapshot=dailyGroupSnapshot(champ,value.snapshot?.groups,value.snapshot?.hours),groups=new Map(snapshot.groups.map(g=>[g.id,g])),hours=new Map(snapshot.hours.map(h=>[h.id,h]))
 if(groups.get(intent.group_id)?.diario_horario_id!==intent.daily_hour_id||hours.get(intent.daily_hour_id)?.grupo_id!==intent.group_id)fail()
 for(const g of groups.values())if(g.diario_horario_id&&hours.get(g.diario_horario_id)?.grupo_id!==g.id)fail()
 for(const h of hours.values())if(h.grupo_id&&groups.get(h.grupo_id)?.diario_horario_id!==h.id)fail()
}
