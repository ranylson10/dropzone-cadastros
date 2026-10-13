import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
import {match} from './lib/postgrest-fixture.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
let tables={},lateFailure=false;const requests=[]
const client=createClient('https://permissions-fixture.supabase.co','fixture',{auth:{persistSession:false},global:{fetch:async(input)=>{
  const url=new URL(input),name=url.pathname.split('/').at(-1),params=url.searchParams;requests.push({name,in:params.get('manager_id'),offset:params.get('offset')})
  let rows=tables[name]||[]
  for(const [field,filter]of params)if(!['select','order','offset','limit'].includes(field))rows=rows.filter(r=>match(r,field+'.'+filter))
  rows=[...rows].sort((a,b)=>String(a.id).localeCompare(String(b.id)))
  const offset=Number(params.get('offset')||0)
  if(lateFailure&&name==='managers'&&offset>0)return Response.json({code:'XX000',message:'fixture late failure'},{status:500})
  if(params.has('limit'))rows=rows.slice(offset,offset+Math.min(7,Number(params.get('limit'))))
  return Response.json(rows)
}}})
const api=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:client}})('backend/src/campeonatos/campeonato-permissions.ts')
let cases=0
for(const bad of ['false','true',1,[],{},null]){
  const value=api.normalizeSellerPermissions({adicionar_equipes:bad,remover_equipes:bad,organizar_grupos:bad,gerenciar_jogos:bad,pontuar_tabela:bad})
  assert.equal(value.adicionar_equipes,false);assert.equal(value.remover_equipes,false);assert.equal(value.organizar_grupos,false);assert.equal(value.gerenciar_jogos,false);assert.equal(value.pontuar_tabela,false);cases++
}
assert.equal(api.normalizeSellerPermissions({remover_equipes:false,remover_proprias_equipes:true}).remover_equipes,false);cases++
assert.equal(api.normalizeSellerPermissions({remover_proprias_equipes:true}).remover_equipes,false);cases++
assert.equal(api.normalizeSellerPermissions({remover_proprias_equipes:true}).remover_proprias_equipes,true);cases++
assert.equal(api.normalizeSellerPermissions({remover_equipes:false,remover_proprias_equipes:true}).remover_proprias_equipes,true);cases++
assert.equal(api.normalizeSellerPermissions({remover_proprias_equipes:'true'}).remover_proprias_equipes,false);cases++
assert.equal(api.normalizeSellerPermissions({adicionar_equipes:true}).adicionar_equipes,true);cases++
assert.equal(api.normalizeSellerPermissions({}).adicionar_equipes,false);cases++
const reset=()=>{
  lateFailure=false;requests.length=0;tables={campeonatos:[{id:id(10),produtora_id:id(20),criado_por:id(1),deleted_at:null}],
    produtoras:[{id:id(20),auth_user_id:id(1),status:'ativo'}],managers:[{id:id(30),auth_user_id:id(2),status:'ativo'}]}
}
reset();assert.equal((await api.getCampeonatoPermission(id(1),id(10))).role,'owner');cases++
reset();tables.produtora_membros=[{id:id(40),produtora_id:id(20),auth_user_id:id(2),status:'ativo',pode_ver:true,pode_operar:false}]
tables.manager_produtora=[{id:id(50),manager_id:id(30),produtora_id:id(20),status:'ativo',pode_ver:true,pode_gerenciar_campeonato:true}]
assert.equal((await api.getCampeonatoPermission(id(2),id(10))).canManage,false);cases++
reset();tables.campeonato_vendedores=[{id:id(70),manager_id:id(30),campeonato_id:id(10),status:'ativo',permissoes:{adicionar_equipes:true}}]
tables.manager_produtora=[{id:id(50),manager_id:id(30),produtora_id:id(20),status:'ativo',pode_ver:true,pode_gerenciar_campeonato:false}]
assert.equal((await api.getCampeonatoPermission(id(2),id(10))).canManage,false);cases++
reset();tables.campeonato_vendedores=[{id:id(71),manager_id:id(30),campeonato_id:id(10),status:'ativo',permissoes:{adicionar_equipes:true}},
  {id:id(70),manager_id:id(30),campeonato_id:id(10),status:'ativo',permissoes:{adicionar_equipes:'false'}}]
assert.equal((await api.getCampeonatoPermission(id(2),id(10))).canManage,false);cases++
reset();tables.managers=Array.from({length:301},(_,n)=>({id:id(100+n),auth_user_id:id(2),status:'ativo'}))
tables.manager_produtora=[{id:id(500),manager_id:id(400),produtora_id:id(20),status:'ativo',pode_ver:true,pode_gerenciar_campeonato:true}]
assert.equal((await api.getCampeonatoPermission(id(2),id(10))).canManage,true)
assert.ok(requests.filter(r=>r.name==='managers').length>40)
for(const item of requests.filter(r=>r.in))assert.ok(item.in.slice(3).split(',').length<=150)
cases++
lateFailure=true;await assert.rejects(()=>api.getCampeonatoPermission(id(2),id(10)),e=>e.message==='fixture late failure');cases++
reset();tables.tokens=[{id:id(80),tipo:'manager_invite',manager_id:id(30),campeonato_id:id(10),status:'ativo',manager_permissoes:{adicionar_equipes:true}}]
assert.equal((await api.getCampeonatoPermission(id(2),id(10))).canManage,true);cases++
console.log(`Slot permissions passed: ${cases} fixtures; strict booleans, existing tier precedence, deterministic first ID, 301 profiles/cap7/IN150 and late failures.`)
