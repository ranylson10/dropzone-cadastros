import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,champ=id(1),edition=id(2),franchise=id(3)
let tables,calls,cap,failTable,failOffset,ignoreFilter,canView,authenticated,permissionCalls,authMode,authActive,authPeak
const at=(row,key)=>key.split('.').reduce((value,part)=>value?.[part],row)
const client=createClient('https://advanced-structure-fixture.supabase.co','fixture',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
 const url=new URL(input),params=url.searchParams
 assert.equal(url.hostname,'advanced-structure-fixture.supabase.co');assert.equal(options.method||'GET','GET','Structure reader must not write')
 if(url.pathname.includes('/auth/v1/admin/users/')){
  const actor=url.pathname.split('/').at(-1);calls.push({table:'auth',actor});authActive++;authPeak=Math.max(authPeak,authActive)
  try{
   await new Promise(resolve=>setTimeout(resolve,2))
   if(authMode==='throw')throw Error('PRIVATE Auth network failure')
   if(authMode==='error')return Response.json({message:'PRIVATE Auth failure'},{status:500})
   const user_metadata=authMode==='email'?{}:authMode==='name'?{name:'Nome'}:authMode==='username'?{user_name:'Apelido'}:{full_name:'Responsável '+actor.slice(-4)}
   return Response.json({id:actor,user_metadata,email:'fixture@example.invalid'})
  }finally{authActive--}
 }
 const table=url.pathname.split('/').at(-1),offset=Number(params.get('offset')||0),limit=Number(params.get('limit')||1000)
 calls.push({table,offset,limit,params:Object.fromEntries(params)})
 if(table===failTable&&offset>=failOffset)return Response.json({code:'XX000',message:'PRIVATE DATABASE DETAIL'},{status:500})
 let rows=(tables[table]||[]).filter(row=>[...params].every(([key,value])=>{
  if(ignoreFilter?.table===table&&ignoreFilter.column===key)return true
  if(value.startsWith('eq.'))return String(at(row,key))===value.slice(3)
  if(value.startsWith('neq.'))return at(row,key)!=null&&String(at(row,key))!==value.slice(4)
  if(value.startsWith('in.'))return value.slice(4,-1).split(',').includes(String(at(row,key)))
  return true
 }))
 const order=(params.get('order')||'').split(',').filter(Boolean)
 rows.sort((a,b)=>{for(const entry of order){const[key,direction]=entry.split('.'),x=at(a,key),y=at(b,key),comparison=typeof x==='number'?x-y:String(x??'').localeCompare(String(y??''));if(comparison)return direction==='desc'?-comparison:comparison}return 0})
 rows=rows.slice(offset,offset+Math.min(cap,limit))
 const single=new Headers(options.headers).get('accept')?.includes('vnd.pgrst.object')
 return Response.json(single?(rows[0]||null):rows)
}}})
const loader=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:client},'@backend/auth/server-auth':{getBearerUser:async()=>{if(!authenticated)throw Error('Sessao invalida.');return{id:id(999)}}},
 '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>{permissionCalls++;return{canView,canManage:true,role:canView?'owner':'none'}},permissionPublicPayload:permission=>permission}})
const read=loader('backend/src/campeonatos/advanced-structure-read.ts').loadAdvancedStructure,route=loader('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
const limited=loader('backend/src/shared/paginated-query.ts').readLimitedRows
const scoped=(start,extra={})=>Array.from({length:3},(_,n)=>({id:id(start+n),campeonato_id:champ,created_at:'2026-10-12T00:00:00Z',...extra}))
function reset(){cap=1;calls=[];failTable=null;failOffset=Infinity;ignoreFilter=null;canView=true;authenticated=true;permissionCalls=0;authMode='full';authActive=0;authPeak=0
 tables={
  campeonato_edicoes:[{id:edition,campeonato_id:champ,franquia_id:franchise}],campeonato_franquias:[{id:franchise,nome:'Franquia'}],
  campeonato_divisoes:scoped(200,{edicao_id:edition,ordem:1}),campeonato_etapas:scoped(100,{edicao_id:edition,ordem:1}),
  campeonato_diario_horarios:scoped(300,{horario:'20:00'}),campeonato_equipes:scoped(400,{status:'ativo'}),campeonato_fases:scoped(500,{ordem:1}),campeonato_grupos:scoped(600,{nome:'Mesmo nome'}),campeonato_slots:scoped(700,{slot_numero:1}),
  campeonato_grupo_escolha_configuracoes:scoped(900),campeonato_grupo_escolha_bloqueios:scoped(1000,{ativo:true}),
  campeonato_grupo_escolha_historico:Array.from({length:10},(_,n)=>({id:id(1100+n),campeonato_id:champ,created_at:'2026-10-12T00:00:00Z',alterado_por:id(1200+n)})),
  campeonato_etapa_fontes:scoped(1300).map((row,n)=>({...row,etapa_destino_id:id(100+n)})),campeonato_progressao_regras:scoped(1400).map((row,n)=>({...row,etapa_origem_id:id(100+n)})),
  campeonato_etapa_premiacoes:scoped(1500,{posicao:1}).map((row,n)=>({...row,etapa_id:id(100+n)})),campeonato_etapa_equipes:scoped(1600,{status:'ativa'}).map((row,n)=>({...row,etapa_id:id(100+n)})),
  campeonato_progressao_execucoes:Array.from({length:4},(_,n)=>({id:id(800+n),campeonato_id:champ,created_at:'2026-10-12T00:00:00Z'})),
  campeonato_progressao_execucao_itens:scoped(1700,{posicao_origem:1}).map((row,n)=>({...row,execucao_id:id(800+n)})),
 }
}
const collections={divisions:['campeonato_divisoes','edicao_id',edition],stages:['campeonato_etapas','edicao_id',edition],dailyHours:['campeonato_diario_horarios','campeonato_id',champ],teams:['campeonato_equipes','campeonato_id',champ],phases:['campeonato_fases','campeonato_id',champ],groups:['campeonato_grupos','campeonato_id',champ],slots:['campeonato_slots','campeonato_id',champ],groupChoiceConfigs:['campeonato_grupo_escolha_configuracoes','campeonato_id',champ],groupChoiceBlocks:['campeonato_grupo_escolha_bloqueios','campeonato_id',champ],groupChoiceHistory:['campeonato_grupo_escolha_historico','campeonato_id',champ],sources:['campeonato_etapa_fontes','etapa_destino_id',id(100)],progressions:['campeonato_progressao_regras','etapa_origem_id',id(100)],prizes:['campeonato_etapa_premiacoes','etapa_id',id(100)],stageTeams:['campeonato_etapa_equipes','etapa_id',id(100)],progressionExecutions:['campeonato_progressao_execucoes','campeonato_id',champ],progressionExecutionItems:['campeonato_progressao_execucao_itens','execucao_id',id(800)]}
const run=()=>read(champ),invoke=(headers={Authorization:'Bearer fixture'},championship=champ)=>route.GET(new Request('https://fixture.invalid/api',{headers}),{params:Promise.resolve({id:championship})})
let cases=0,historical=0
const old='scripts/testes/fixtures/advanced-structure-loader-before.ts'
if(fs.existsSync(old)){
 const output=ts.transpileModule('export '+fs.readFileSync(old,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}}
 new Function('exports','supabaseAdmin',output)(module.exports,client)
 reset();let result=await module.exports.loadStructure(champ);assert.equal(result.groups.length,1);assert.equal(result.slots.length,1);assert.equal(result.groupChoiceHistory.length,1);assert.equal(result.progressionExecutions.length,1);historical++
 reset();cap=1000;await module.exports.loadStructure(champ);assert.equal(authPeak,10);historical++
 reset();authMode='email';result=await module.exports.loadStructure(champ);assert.equal(result.groupChoiceHistory[0].alterado_por_nome,'fixture@example.invalid');historical++
}
reset();let result=await run()
for(const [key,[table,column]]of Object.entries(collections)){
 assert.equal(result[key].length,tables[table].length,key);const requests=calls.filter(call=>call.table===table)
 assert.ok(requests.every(call=>call.params.order.split(',').some(entry=>entry.startsWith('id.'))),key+' stable ID order')
 assert.ok(requests.every(call=>call.params[column]?.startsWith(column==='edicao_id'||column==='campeonato_id'?'eq.':'in.')),key+' scoped query')
 cases++
}
assert.ok(calls.filter(call=>call.table!=='auth'&&!['campeonato_edicoes','campeonato_franquias'].includes(call.table)).some(call=>call.offset===3&&call.limit===500));cases++
assert.equal(result.groupChoiceHistory[0].alterado_por_nome,'Responsável 1200');assert.ok(authPeak<=8);cases++
reset();tables.campeonato_edicoes=[];result=await run();assert.equal(result.edition,null);assert.equal(result.dailyHours.length,3);assert.equal(result.teams.length,3);assert.ok(!calls.some(call=>call.table==='campeonato_etapas'));cases++
assert.equal(result.groups.length,3);assert.ok(calls.filter(call=>call.table==='campeonato_grupos').every(call=>call.params.campeonato_id==='eq.'+champ));cases++
reset();tables.campeonato_edicoes=[];failTable='campeonato_grupos';failOffset=1;await assert.rejects(run);cases++
reset();tables.campeonato_edicoes=[];tables.campeonato_grupos[0].campeonato_id=id(9999);ignoreFilter={table:'campeonato_grupos',column:'campeonato_id'};await assert.rejects(run,/incompatível/);cases++
reset();tables.campeonato_edicoes[0].franquia_id=null;result=await run();assert.equal(result.franchise,null);assert.ok(!calls.some(call=>call.table==='campeonato_franquias'));cases++
reset();tables.campeonato_etapas=[];result=await run();assert.equal(result.progressionExecutionItems.length,0);assert.ok(!calls.some(call=>call.table==='campeonato_etapa_fontes'));cases++
reset();tables.campeonato_equipes.push({...tables.campeonato_equipes[0],id:id(9900),status:'removido'});tables.campeonato_etapa_equipes.push({...tables.campeonato_etapa_equipes[0],id:id(9901),status:'retirada'});tables.campeonato_grupo_escolha_bloqueios.push({...tables.campeonato_grupo_escolha_bloqueios[0],id:id(9902),ativo:false})
result=await run();assert.equal(result.teams.length,3);assert.equal(result.stageTeams.length,3);assert.equal(result.groupChoiceBlocks.length,3);cases++
for(const [key,[table,column]]of Object.entries(collections)){
 reset();tables[table].push({...tables[table][0],id:id(9900),[column]:id(9999)});result=await run();assert.ok(!result[key].some(row=>row.id===id(9900)),key+' foreign excluded');cases++
 reset();tables[table][0][column]=id(9999);ignoreFilter={table,column};await assert.rejects(run);cases++
 reset();tables[table].push({...tables[table][0]});await assert.rejects(run);cases++
}
for(const table of ['campeonato_edicoes','campeonato_franquias',...Object.values(collections).map(([table])=>table)]){
 reset();failTable=table;failOffset=['campeonato_edicoes','campeonato_franquias'].includes(table)?0:1;await assert.rejects(run);cases++
}
reset();tables.campeonato_edicoes[0].campeonato_id=id(9999);ignoreFilter={table:'campeonato_edicoes',column:'campeonato_id'};await assert.rejects(run);cases++
reset();tables.campeonato_franquias[0].id=id(9999);ignoreFilter={table:'campeonato_franquias',column:'id'};await assert.rejects(run);cases++
reset();cap=7;tables.campeonato_grupo_escolha_historico=Array.from({length:501},(_,n)=>({id:id(2000+n),campeonato_id:champ,created_at:'2026-10-12T00:00:00Z',alterado_por:null}))
tables.campeonato_progressao_execucoes=Array.from({length:31},(_,n)=>({id:id(3000+n),campeonato_id:champ,created_at:'2026-10-12T00:00:00Z'}))
tables.campeonato_progressao_execucao_itens=Array.from({length:701},(_,n)=>({id:id(4000+n),execucao_id:id(3000),posicao_origem:1})).concat({id:id(4999),execucao_id:id(3030),posicao_origem:1})
result=await run();assert.equal(result.groupChoiceHistory.length,500);assert.equal(result.progressionExecutions.length,30);assert.equal(result.progressionExecutionItems.length,701);assert.ok(!result.progressionExecutions.some(row=>row.id===id(3030)));cases++
assert.equal(calls.filter(call=>call.table==='campeonato_grupo_escolha_historico').at(-1).offset,497);assert.equal(calls.filter(call=>call.table==='campeonato_grupo_escolha_historico').at(-1).limit,3);cases++
reset();cap=17;tables.campeonato_etapas=Array.from({length:301},(_,n)=>({id:id(10000+n),edicao_id:edition,ordem:1}))
for(const [table,column,base,key]of [['campeonato_etapa_fontes','etapa_destino_id',20000,'created_at'],['campeonato_progressao_regras','etapa_origem_id',21000,'created_at'],['campeonato_etapa_premiacoes','etapa_id',22000,'posicao'],['campeonato_etapa_equipes','etapa_id',23000,'created_at']]){
 tables[table]=Array.from({length:301},(_,n)=>({id:id(base+n),[column]:id(10000+n),campeonato_id:champ,status:'ativa',[key]:key==='posicao'?301-n:new Date(Date.UTC(2026,0,1)+(300-n)*1000).toISOString()}))
}
result=await run()
for(const [key,[table,column]]of Object.entries(collections).filter(([key])=>['sources','progressions','prizes','stageTeams'].includes(key))){
 assert.equal(result[key].length,301);assert.equal(Math.max(...calls.filter(call=>call.table===table).map(call=>call.params[column].slice(4,-1).split(',').length)),150)
 assert.equal(result[key][0].id,tables[table].at(-1).id);cases++
}
reset();tables.campeonato_grupo_escolha_historico.push({...tables.campeonato_grupo_escolha_historico[0],id:id(9998)},{...tables.campeonato_grupo_escolha_historico[0],id:id(9997),alterado_por:'invalid'},{...tables.campeonato_grupo_escolha_historico[0],id:id(9996),alterado_por:null})
result=await run();assert.equal(calls.filter(call=>call.table==='auth').length,10);assert.ok(authPeak<=8);assert.equal(result.groupChoiceHistory.find(row=>row.id===id(9996)).alterado_por_nome,'Sistema');cases++
for(const [mode,label]of [['name','Nome'],['username','Apelido'],['email','Usuário 00000000'],['error','Usuário 00000000'],['throw','Usuário 00000000']]){
 reset();authMode=mode;const original=console.error,diagnostics=[]
 if(mode==='throw')console.error=(...args)=>diagnostics.push(args)
 try{result=await run()}finally{console.error=original}
 assert.equal(result.groupChoiceHistory[0].alterado_por_nome,label);cases++
 if(mode==='throw'){assert.equal(diagnostics.length,10);assert.ok(diagnostics.every(args=>args[0]?.message==='PRIVATE Auth network failure'));cases++}
}
for(const value of [0,-1,1.5,Infinity,50001,'3',null]){let queried=false;await assert.rejects(()=>limited({range(){queried=true}},value));assert.equal(queried,false);cases++}
await assert.rejects(()=>limited({range:async()=>({data:[1,2],error:null})},1));cases++
reset();let response=await invoke();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).slots.length,3);cases++
reset();authMode='email';response=await invoke();assert.equal(response.status,200);assert.ok(!JSON.stringify(await response.json()).includes('fixture@example.invalid'));cases++
for(const headers of [{},{Authorization:'Basic fixture'},{Authorization:'Bearer '}]){reset();response=await invoke(headers);assert.equal(response.status,401);assert.equal(calls.length,0);assert.equal(permissionCalls,0);assert.equal(response.headers.get('cache-control'),'no-store');cases++}
reset();authenticated=false;response=await invoke();assert.equal(response.status,401);assert.equal(calls.length,0);cases++
reset();canView=false;response=await invoke();assert.equal(response.status,403);assert.equal(calls.length,0);cases++
reset();response=await invoke({Authorization:'Bearer fixture'},'invalid');assert.equal(response.status,400);assert.equal(calls.length,0);cases++
for(const table of ['campeonato_slots','campeonato_grupo_escolha_historico','campeonato_progressao_execucao_itens']){
 reset();failTable=table;failOffset=1;response=await invoke();assert.equal(response.status,400);assert.equal(response.headers.get('cache-control'),'no-store');const body=await response.json();assert.ok(!JSON.stringify(body).includes('PRIVATE'));assert.equal(body.slots,undefined);cases++
}
console.log(`Advanced structure read passed: ${cases} permanent checks + ${historical} historical reproductions. Actual loader/GET and SDK HTTP fixtures: capped pages, stable order, scoped parents/championship, IN150/global child order, bounded500/30 history/full execution items, late failure/no partial payload, Auth max8/dedup/fallback, authorization and no-store. Not a transactional snapshot or remote PostgREST/browser test.`)
