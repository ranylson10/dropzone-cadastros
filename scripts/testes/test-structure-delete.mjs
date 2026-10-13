import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
let tables={},calls=[],changeParent=false,failTable=null,auth=true,manage=true
const direct=['campeonato_diario_horarios','campeonato_etapa_equipes','campeonato_grupo_escolha_configuracoes','campeonato_grupo_escolha_bloqueios']
const indirect={campeonato_divisoes:'edicao_id',campeonato_etapas:'edicao_id',campeonato_etapa_fontes:'etapa_destino_id',campeonato_progressao_regras:'etapa_origem_id',campeonato_etapa_premiacoes:'etapa_id'}
const admin=createClient('https://structure-fixture.supabase.co','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1);calls.push({table,method:options.method||'GET',query:[...url.searchParams]})
  if(table===failTable)return Response.json({code:'XX000',message:'fixture failure'},{status:400})
  if(options.method==='DELETE'&&changeParent){tables[table][0][indirect[table]]=id(999)}
  const rows=(tables[table]||[]).filter(row=>[...url.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(row[key])===value.slice(3)))
  if(options.method==='DELETE')tables[table]=(tables[table]||[]).filter(row=>!rows.includes(row))
  return Response.json(new Headers(options.headers).get('accept')?.includes('vnd.pgrst.object')?(rows[0]||null):rows)
}}})
const load=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},'@backend/auth/server-auth':{getBearerUser:async()=>{if(!auth)throw new Error('Sessao invalida.');return{id:id(1)}}},
  '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>({canView:true,canManage:manage,role:'owner'})},'@backend/campeonatos/estatisticas/estatisticas.service':{}})
const api=load('backend/src/campeonatos/structure-delete.ts'),scope=load('backend/src/campeonatos/structure-scope.ts'),route=load('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
function reset(table,foreign=false){calls=[];changeParent=false;failTable=null;auth=true;manage=true;tables={
  campeonato_edicoes:[{id:id(30),campeonato_id:foreign?id(999):id(20)}],campeonato_etapas:[{id:id(40),edicao_id:id(30)}],
  [table]:[{id:id(50),...(direct.includes(table)?{campeonato_id:foreign?id(999):id(20)}:{[indirect[table]]:indirect[table]==='edicao_id'?id(30):id(40)})}]}}
let cases=0
reset('campeonato_divisoes',true)
await admin.from('campeonato_divisoes').delete().eq('id',id(50))
assert.equal(tables.campeonato_divisoes.length,0);cases++ // Reproduces old unscoped chain with synthetic data only.
for(const table of [...direct,...Object.keys(indirect)]){
  reset(table);await api.deleteScopedStructureRow(id(20),table,id(50));assert.equal(tables[table].length,0);cases++
  reset(table,true);await assert.rejects(()=>api.deleteScopedStructureRow(id(20),table,id(50)),/neste campeonato/);assert.equal(tables[table].length,1)
  if(!direct.includes(table))assert.equal(calls.filter(v=>v.method==='DELETE').length,0);cases++
}
for(const table of Object.keys(indirect)){
  reset(table);changeParent=true;await assert.rejects(()=>api.deleteScopedStructureRow(id(20),table,id(50)),/alterado/);assert.equal(tables[table].length,1);cases++
}
reset('campeonato_etapa_fontes');failTable='campeonato_edicoes';await assert.rejects(()=>api.deleteScopedStructureRow(id(20),'campeonato_etapa_fontes',id(50)));assert.equal(calls.filter(v=>v.method==='DELETE').length,0);cases++
for(const [table,row] of [['notificacoes',id(50)],['campeonato_divisoes','bad']]){reset('campeonato_divisoes');await assert.rejects(()=>api.deleteScopedStructureRow(id(20),table,row),/inválida/);assert.equal(calls.length,0);cases++}
const request=()=>route.DELETE(new Request('https://fixture.invalid/api',{method:'DELETE',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({action:'delete',table:'campeonato_divisoes',row_id:id(50)})}),{params:Promise.resolve({id:id(20)})})
reset('campeonato_divisoes',true);assert.equal((await request()).status,400);assert.equal(calls.filter(v=>v.method==='DELETE').length,0);cases++
reset('campeonato_divisoes');manage=false;assert.equal((await request()).status,403);assert.equal(calls.length,0);cases++
reset('campeonato_divisoes');auth=false;assert.equal((await request()).status,401);assert.equal(calls.length,0);cases++
const bodies=[{action:'create_division',edition_id:id(30)},
  {action:'create_stage',edition_id:id(30),division_id:id(41)},
  {action:'create_source',stage_id:id(40),source_stage_id:id(42),source_division_id:id(41)},
  {action:'create_progression',stage_id:id(40),destination_stage_id:id(42),destination_division_id:id(41)},
  {action:'create_prize',stage_id:id(40)},
  {action:'set_group_choice_block',phase_id:id(43),group_id:id(44)},
  {action:'set_group_choice_block',phase_id:id(43),slot_id:id(45)},
  {action:'link_daily_group',daily_hour_id:id(46),group_id:id(44)}]
function parents(foreign=false){calls=[];failTable=null;tables={campeonato_edicoes:[{id:id(30),campeonato_id:foreign?id(999):id(20),franquia_id:id(47)}],
  campeonato_etapas:[{id:id(40),edicao_id:id(30)},{id:id(42),edicao_id:id(30)}],campeonato_divisoes:[{id:id(41),edicao_id:id(30)}],
  campeonato_fases:[{id:id(43),campeonato_id:foreign?id(999):id(20)}],campeonato_grupos:[{id:id(44),campeonato_id:foreign?id(999):id(20),fase_id:id(43)}],
  campeonato_slots:[{id:id(45),campeonato_id:foreign?id(999):id(20),fase_id:id(43)}],campeonato_diario_horarios:[{id:id(46),campeonato_id:foreign?id(999):id(20)}],
  campeonato_franquias:[{id:id(47),criado_por:id(1)},{id:id(48),criado_por:id(999)}]}}
for(const body of bodies){parents();await scope.assertStructureActionScope(id(1),id(20),body);cases++
  parents(true);await assert.rejects(()=>scope.assertStructureActionScope(id(1),id(20),body),/fora deste campeonato/);assert.ok(calls.every(v=>v.method==='GET'));cases++}
for(const field of ['source_stage_id','source_division_id','destination_stage_id','destination_division_id']){
  parents();const body={...bodies[field.startsWith('source')?2:3],[field]:id(999)};await assert.rejects(()=>scope.assertStructureActionScope(id(1),id(20),body),/fora deste campeonato/);cases++
}
parents();tables.campeonato_grupos[0].fase_id=id(999);await assert.rejects(()=>scope.assertStructureActionScope(id(1),id(20),bodies[5]),/fase/);cases++
parents();await scope.assertStructureActionScope(id(12),id(20),{action:'save_edition',franchise_id:id(47)});cases++
parents();await assert.rejects(()=>scope.assertStructureActionScope(id(1),id(20),{action:'save_edition',franchise_id:id(48)}),/não autorizada/);cases++
parents();tables.campeonato_edicoes=[];await scope.assertStructureActionScope(id(1),id(20),{action:'save_edition',franchise_id:id(47)});cases++
parents(true);auth=true;manage=true
const foreignCreate=await route.POST(new Request('https://fixture.invalid/api',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},
  body:JSON.stringify({action:' create_division ',edition_id:id(30),name:'Foreign fixture'})}),{params:Promise.resolve({id:id(20)})})
assert.equal(foreignCreate.status,400);assert.ok(calls.every(v=>v.method==='GET'));cases++
console.log(`Structure scope passed: ${cases} fixtures; nine deletion scopes, parent fencing, creation/relation/franchise boundaries and authorization before writes.`)
