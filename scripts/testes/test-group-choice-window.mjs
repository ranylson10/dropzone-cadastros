import assert from 'node:assert/strict'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const {groupChoiceWindowIsOpen}=fixtureLoader()('backend/src/campeonatos/group-choice-window.ts')
const now=Date.parse('2026-10-11T12:00:00Z'),before='2026-10-11T11:00:00Z',after='2026-10-11T13:00:00Z'
let cases=0
for(const [config,expected] of [
  [null,false],[{aberta:false},false],[{aberta:'true'},false],[{aberta:true},true],
  [{aberta:true,abre_em:null,fecha_em:''},true],[{aberta:true,abre_em:before,fecha_em:after},true],
  [{aberta:true,abre_em:after},false],[{aberta:true,fecha_em:before},false],
  [{aberta:true,abre_em:after,fecha_em:before},false],
  [{aberta:true,abre_em:new Date(now).toISOString(),fecha_em:new Date(now).toISOString()},true],
  [{aberta:true,abre_em:'invalid'},false],[{aberta:true,fecha_em:'invalid'},false],
  [{aberta:true,abre_em:[]},false],[{aberta:true,fecha_em:123},false],
]){assert.equal(groupChoiceWindowIsOpen(config,now),expected);cases++}
assert.equal(groupChoiceWindowIsOpen({aberta:true},Number.NaN),false);cases++

let config,mutations=0,fault=null,failAuth=false,assigned=true
const part={id:'part',equipe_id:'team',line_id:'line',grupo_id:'group',slot_id:'slot',slot_numero:1}
const database={from(table){
  const query={
    select(){return query},eq(){return query},or(){return query},in(){return query},is(){return query},not(){return query},order(){return query},limit(){return query},
    update(){mutations++;return query},insert(){mutations++;return query},
    maybeSingle(){return Promise.resolve({data:table==='campeonato_grupos'?{id:'group',fase_id:'phase'}
      :table==='campeonato_grupo_escolha_configuracoes'?config:table==='campeonato_grupo_escolha_historico'?{fase_id:'phase',grupo_anterior_id:'group',slot_anterior_id:'slot'}:null,error:fault})},
    then(resolve,reject){return Promise.resolve({data:table==='equipes'?[{id:'team'}]:table==='campeonato_equipes'?[{...part,...(assigned?{}:{grupo_id:null,slot_id:null,slot_numero:null})}]
      :table==='campeonato_grupo_escolha_configuracoes'?[config]:[],error:fault}).then(resolve,reject)},
  };return query
}}
const routes=fixtureLoader({
  '@backend/shared/supabase-admin':{supabaseAdmin:database},
  '@backend/auth/server-auth':{getBearerUser:async()=>{if(failAuth)throw new Error('Sessao invalida');return {id:'owner'}}},
  'next/server':{NextResponse:{json:(data,options)=>new Response(JSON.stringify(data),options)}},
})('web/app/api/campeonatos/[id]/escolha-grupo/route.ts')
const context={params:Promise.resolve({id:'champ'})}
const request=()=>new Request('https://fixture.invalid/api',{method:'POST',body:JSON.stringify({campeonato_equipe_id:'part',grupo_id:'group',slot_id:'slot'})})
for(const method of ['POST','PATCH','DELETE','PUT'])for(const bad of [{aberta:true,abre_em:'bad'},{aberta:true,fecha_em:'bad'},{aberta:true,abre_em:after,fecha_em:before}]){
  config=bad;assigned=method!=='PUT';mutations=0
  const response=await routes[method](request(),context)
  assert.equal(response.status,400);assert.match((await response.json()).error,/não está aberta/)
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(mutations,0);cases++
}
config={aberta:true,fecha_em:'bad'};fault=null;assigned=true
const read=await routes.GET(request(),context);assert.equal(read.status,200);assert.deepEqual((await read.json()).configs,[]);assert.equal(read.headers.get('cache-control'),'no-store');cases++
for(const method of ['GET','POST','DELETE','PUT']){
  fault=Object.assign(new Error('PRIVATE SQL'),{code:'42501',details:'PRIVATE row'});mutations=0
  const response=await routes[method](request(),context);assert.equal(response.status,400)
  assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE'));assert.equal(mutations,0);cases++
}
fault=null;failAuth=true
for(const method of ['POST','PATCH','DELETE','PUT']){
  const response=await routes[method]({json:()=>{throw new Error('Read body before auth')}},context)
  assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');cases++
}
console.log(`Group choice window passed: ${cases} policy/HTTP fixtures; invalid dates fail closed, auth precedes body, no-store, database diagnostics sanitized; zero real writes.`)
