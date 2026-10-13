import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {sql,runFile} from './docker-lab.mjs'
import {id,quote,service,championship} from './fixtures.mjs'
import {fixtureLoader} from '../ts-fixture-loader.mjs'
import {match} from '../lib/postgrest-fixture.mjs'
const database=process.argv[2]
if(!/^dropzone_validation_[a-z0-9_]+$/.test(database||''))throw new Error('Explicit synthetic fixture database required.')
process.env.DROPZONE_FIXTURE_DB=database
const directory=process.argv[3]||'relatorios-testes/movimento-rpc-2026-10-11'
if(!/^relatorios-testes\/[a-z0-9-]+$/.test(directory))throw new Error('Invalid evidence directory')
let next=110000,key=170000
const results=[]
const json=async text=>JSON.parse(await sql(text))
const test=async(name,body)=>{try{results.push({name,passed:true,...await body()});console.log('PASS '+name)}catch(e){results.push({name,passed:false,error:e.message});console.log('FAIL '+name+': '+e.message)}}
const fixture=async()=>{next+=100;return championship(next)}
const insert=async(f,team=100,slot=0)=>{
  const part=id(f.n+30+team-100)
  await sql(`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id)
    values('${part}','${f.camp}','${id(team)}','${id(team+100)}','${f.slots[slot]}');`)
  return part
}
const state=async f=>json(`select jsonb_build_object(
  'parts',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_equipes t where campeonato_id='${f.camp}'),
  'slots',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_slots t where campeonato_id='${f.camp}'),
  'history',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_grupo_escolha_historico t where campeonato_id='${f.camp}'),
  'links',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_links t where campeonato_id='${f.camp}'),
  'tokens',(select jsonb_agg(to_jsonb(t) order by id) from public.tokens t where campeonato_id='${f.camp}'),
  'receipts',(select jsonb_agg(to_jsonb(t) order by actor_id,request_id) from public.movimentacao_recibos t where resultado->>'campeonato_id'='${f.camp}'));`)
const rejected=async(promise,pattern)=>{let failure;try{await promise}catch(e){failure=e.message}assert.ok(failure,'Expected refusal');if(pattern)assert.match(failure,pattern);return failure}
const transfer=(f,part,{actor=1,request=id(++key),mode='move',source=f.slots[0],target=f.slots[1],targetPart=null,prefix='',hold=0}={})=>
  sql(`${service}${prefix}begin;select pg_backend_pid();select public.fn_transferir_slots_atomico('${id(actor)}','${request}','${f.camp}',${quote(mode)},
    '${source}','${target}','${part}',${targetPart?quote(targetPart):'null'});${hold?`select pg_sleep(${hold});`:''}commit;`).then(out=>{const lines=out.split('\n');return {pid:Number(lines[0]),data:JSON.parse(lines[1])}})
const refuse=async(f,part,options,pattern)=>{const before=await state(f),failure=await rejected(transfer(f,part,options),pattern);assert.deepEqual(await state(f),before);return {failure,unchanged:true}}
const resetAccess=async()=>sql(`delete from public.produtora_membros;delete from public.manager_produtora;delete from public.campeonato_vendedores;
  delete from public.tokens where tipo='manager_invite';delete from public.sistema_restricoes_conta;
  update public.managers set status='ativo';update public.produtoras set auth_user_id='${id(1)}',status='ativo' where id='${id(50)}';`)
await sql(`insert into public.managers(id,auth_user_id,username,nome) values
  ('${id(350)}','${id(12)}','audit-transfer-staff','Synthetic Transfer Staff');`)
const workspace=(actor=12,manage=true)=>sql(`insert into public.produtora_membros(id,produtora_id,auth_user_id,cargo,pode_ver,pode_operar)
  values('${id(400)}','${id(50)}','${id(actor)}','operacao',true,${manage});`)
const staff=(manage=true,manager=300,producer=50,link=410)=>sql(`insert into public.manager_produtora(id,manager_id,produtora_id,pode_ver,pode_gerenciar_campeonato)
  values('${id(link)}','${id(manager)}','${id(producer)}',true,${manage});`)
const seller=(f,perms={adicionar_equipes:true},manager=300,row=420)=>sql(`insert into public.campeonato_vendedores(id,campeonato_id,manager_id,token,status,permissoes)
  values('${id(row)}','${f.camp}','${id(manager)}','synthetic-seller-${row}','ativo',${quote(JSON.stringify(perms))}::jsonb);`)
const legacy=(f,perms={adicionar_equipes:true})=>sql(`insert into public.tokens(id,tipo,campeonato_id,manager_id,token,manager_permissoes)
  values('${id(430)}','manager_invite','${f.camp}','${id(300)}','synthetic-manager-grant',${quote(JSON.stringify(perms))}::jsonb);`)

// Actual backend permission service, with a cap-1 Data API fixture over native rows.
let tables={};const requests=[]
const client=createClient('https://native-permission-fixture.supabase.co','fixture',{auth:{persistSession:false},global:{fetch:async(input)=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1),params=url.searchParams;requests.push(table)
  let rows=tables[table]||[]
  for(const [field,filter]of params)if(!['select','order','offset','limit'].includes(field))rows=rows.filter(r=>match(r,field+'.'+filter))
  rows=[...rows].sort((a,b)=>String(a.id).localeCompare(String(b.id)))
  if(params.has('limit')){const offset=Number(params.get('offset')||0);rows=rows.slice(offset,offset+1)}
  return Response.json(rows)
}}})
const backendPermission=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:client}})('backend/src/campeonatos/campeonato-permissions.ts')
const backendFor=async(f,actor)=>{
  const names=['campeonatos','produtoras','produtora_membros','managers','manager_produtora','campeonato_vendedores','tokens']
  const pairs=await Promise.all(names.map(async name=>[name,await json(`select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.${name} t;`)]))
  tables=Object.fromEntries(pairs);return backendPermission.getCampeonatoPermission(id(actor),f.camp)
}
const matrices=[
  {name:'creator',actor:1,allowed:true,setup:async()=>{}},
  {name:'producer owner',actor:12,allowed:true,setup:async()=>sql(`update public.produtoras set auth_user_id='${id(12)}' where id='${id(50)}';`)},
  {name:'workspace operation',actor:12,allowed:true,setup:async()=>workspace()},
  {name:'workspace read-only overrides seller',actor:12,allowed:false,setup:async f=>{await workspace(12,false);await seller(f,{adicionar_equipes:true},350)}},
  {name:'manager management',actor:11,allowed:true,setup:async()=>staff()},
  {name:'manager read-only overrides seller',actor:11,allowed:false,setup:async f=>{await staff(false);await seller(f)}},
  {name:'seller explicit opt-in',actor:11,allowed:true,setup:async f=>seller(f)},
  {name:'seller string false',actor:11,allowed:false,setup:async f=>seller(f,{adicionar_equipes:'false'})},
  {name:'seller string true',actor:11,allowed:false,setup:async f=>seller(f,{adicionar_equipes:'true'})},
  {name:'seller missing write flag',actor:11,allowed:false,setup:async f=>seller(f,{organizar_grupos:true})},
  {name:'seller tier denies legacy allowed grant',actor:11,allowed:false,setup:async f=>{await seller(f,{adicionar_equipes:false});await legacy(f)}},
  {name:'legacy explicit opt-in',actor:11,allowed:true,setup:async f=>legacy(f)},
  {name:'legacy string false',actor:11,allowed:false,setup:async f=>legacy(f,{adicionar_equipes:'false'})},
  {name:'inactive manager',actor:11,allowed:false,setup:async f=>{await seller(f);await sql(`update public.managers set status='inativo' where id='${id(300)}';`)}},
  {name:'unrelated team staff',actor:11,allowed:false,setup:async()=>{}},
]
for(const item of matrices)await test('Permission parity and transfer: '+item.name,async()=>{
  await resetAccess();const f=await fixture(),p=await insert(f);await item.setup(f)
  const backend=await backendFor(f,item.actor);assert.equal(backend.canManage,item.allowed)
  if(item.allowed){const result=await transfer(f,p,{actor:item.actor});assert.equal(result.data.participacoes[0].slot_id,f.slots[1]);return {backendRole:backend.role,allowed:true}}
  return {...await refuse(f,p,{actor:item.actor},/Sem permissão/),backendRole:backend.role,allowed:false}
})
await resetAccess()
await test('Native uniqueness prevents two active manager profiles or duplicate seller grants',async()=>{
  const f=await fixture(),p=await insert(f)
  await rejected(sql(`insert into public.managers(id,auth_user_id,username,nome) values('${id(351)}','${id(11)}','audit-duplicate','Synthetic Duplicate');`),/managers_auth_user_unique/)
  await seller(f,{adicionar_equipes:true},300,421)
  await rejected(seller(f,{adicionar_equipes:false},300,420),/campeonato_vendedores_campeonato_manager_unique/)
  assert.equal((await backendFor(f,11)).canManage,true)
  await transfer(f,p,{actor:11});await resetAccess();return {schemaConstraintsPreserved:true}
})
await test('Move then discarded result replays before reading the now empty source',async()=>{
  const f=await fixture(),p=await insert(f),request=id(++key),first=await transfer(f,p,{request}),before=await state(f)
  const replay=await transfer(f,p,{request});assert.equal(replay.data.repetida,true);assert.deepEqual(replay.data,{...first.data,repetida:true})
  assert.deepEqual(await state(f),before);return {commit:1,replays:1,emptySourceStillReplayed:true}
})
await test('Swap replay survives both participant positions changing',async()=>{
  const f=await fixture(),p=await insert(f),q=await insert(f,101,1),request=id(++key)
  await transfer(f,p,{request,mode:'swap',targetPart:q});const before=await state(f)
  const replay=await transfer(f,p,{request,mode:'swap',targetPart:q});assert.equal(replay.data.repetida,true)
  assert.deepEqual(await state(f),before);assert.equal(before.history.length,2);return {commit:1,history:2}
})
await test('Different intent with the same actor/key is refused without mutation',async()=>{
  const f=await fixture(),p=await insert(f),request=id(++key);await transfer(f,p,{request})
  return refuse(f,p,{request,target:f.slots[2]},/outro movimento/)
})
await test('Stale UI source participant never moves a replacement occupant',async()=>{
  const f=await fixture(),p=await insert(f)
  await sql(`update public.campeonato_equipes set status='removido',slot_id=null,grupo_id=null,slot_numero=null where id='${p}';`)
  await insert(f,101,0);return refuse(f,p,{},/ocupante mudou/)
})
await test('Stale UI swap target participant is refused',async()=>{
  const f=await fixture(),p=await insert(f),q=await insert(f,101,1)
  await sql(`update public.campeonato_equipes set status='removido',slot_id=null,grupo_id=null,slot_numero=null where id='${q}';`)
  await insert(f,102,1);return refuse(f,p,{mode:'swap',targetPart:q},/ocupante mudou/)
})
for(const status of ['ocupado','reservado'])await test('Move refuses '+status+' destination without clearing it',async()=>{
  const f=await fixture(),p=await insert(f)
  if(status==='ocupado')await insert(f,101,1)
  else await sql(`update public.campeonato_slots set status='reservado' where id='${f.slots[1]}';`)
  return refuse(f,p,{},/Destino ocupado/)
})
await test('Cross-championship slot is refused',async()=>{
  const f=await fixture(),other=await fixture(),p=await insert(f);return refuse(f,p,{target:other.slots[1]},/fora do campeonato/)
})
await test('Revoked grant blocks even receipt replay',async()=>{
  await staff();const f=await fixture(),p=await insert(f),request=id(++key)
  await transfer(f,p,{request,actor:11});await sql(`update public.manager_produtora set pode_gerenciar_campeonato=false;`)
  const evidence=await refuse(f,p,{request,actor:11},/Sem permissão/);await resetAccess();return evidence
})
await test('Account restriction blocks creator',async()=>{
  const f=await fixture(),p=await insert(f)
  await sql(`insert into public.sistema_restricoes_conta(auth_user_id,tipo,motivo,aplicado_por) values('${id(1)}','suspensao','Synthetic','${id(2)}');`)
  const evidence=await refuse(f,p,{},/Conta indisponível/);await resetAccess();return evidence
})
await test('Private receipts reject client access and direct service writes despite permissive defaults',async()=>{
  for(const role of ['anon','authenticated']){
    await rejected(sql(`set role ${role};select * from public.movimentacao_recibos;`),/permission denied/)
    await rejected(sql(`set role ${role};select public.dz_assert_slot_permission('${id(1)}','${id(1000)}','manage');`),/permission denied/)
    await rejected(sql(`set role ${role};select public.fn_transferir_slots_atomico('${id(1)}','${id(++key)}','${id(1000)}','move','${id(1010)}','${id(1011)}','${id(1)}',null);`),/permission denied/)
  }
  await rejected(sql(`${service}insert into public.movimentacao_recibos(actor_id,request_id,fingerprint,resultado) values('${id(1)}','${id(++key)}','bad','{}');`),/permission denied/)
  await rejected(sql(`${service}update public.movimentacao_recibos set fingerprint='bad';`),/permission denied/)
  await rejected(sql(`${service}delete from public.movimentacao_recibos;`),/permission denied/)
  return {permissiveDefaultsExplicitlyRevoked:true}
})
await sql(`create function public.audit_transfer_fail() returns trigger language plpgsql as $$begin
  if current_setting('audit_transfer.fail',true)=tg_table_name then raise exception 'Injected transfer failure';end if;return new;end;$$;
  create trigger zzz_audit_transfer_history after insert on public.campeonato_grupo_escolha_historico for each row execute function public.audit_transfer_fail();
  create trigger zzz_audit_transfer_receipt after insert or update on public.movimentacao_recibos for each row execute function public.audit_transfer_fail();`)
for(const table of ['campeonato_grupo_escolha_historico','movimentacao_recibos'])await test('Injected '+table+' error rolls back wrapper, plan and receipt',async()=>{
  const f=await fixture(),p=await insert(f);return refuse(f,p,{prefix:`set audit_transfer.fail=${quote(table)};`},/Injected transfer/)
})
await test('Six actual sessions with one intent/key: one transfer and five replays with native lock waits',async()=>{
  const f=await fixture(),p=await insert(f),request=id(++key)
  const pending=Array.from({length:6},()=>transfer(f,p,{request,hold:0.4}))
  await new Promise(resolve=>setTimeout(resolve,200))
  const locks=await json(`select jsonb_agg(jsonb_build_object('pid',pid,'wait',wait_event_type,'blockedBy',pg_blocking_pids(pid)))
    from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and state='active' and query like '%fn_transferir_slots_atomico%';`)
  const results=await Promise.all(pending);assert.equal(new Set(results.map(t=>t.pid)).size,6);assert.equal(results.filter(t=>t.data.repetida).length,5)
  assert.ok(locks.some(t=>t.wait==='Lock'&&t.blockedBy.length));const after=await state(f);assert.equal(after.history.length,1);assert.equal(after.receipts.length,1)
  return {sessions:6,commits:1,replays:5,locks}
})
await test('Two different participants competing for one target produce one transfer',async()=>{
  const f=await fixture(),p=await insert(f),q=await insert(f,101,1)
  const outcomes=await Promise.allSettled([transfer(f,p,{target:f.slots[2],hold:0.4}),transfer(f,q,{source:f.slots[1],target:f.slots[2]})])
  assert.equal(outcomes.filter(t=>t.status==='fulfilled').length,1)
  const after=await state(f);assert.equal(after.parts.filter(t=>t.slot_id===f.slots[2]).length,1);assert.equal(after.history.length,1)
  return {sessions:2,commits:1,refusals:1}
})
await test('Wrapper versus enrollment of another line on the same team does not invert team/group locks',async()=>{
  const f=await fixture(),p=await insert(f),line=id(f.n+70)
  await sql(`insert into public.equipe_lines(id,equipe_id,nome) values('${line}','${id(100)}','Concurrent line ${f.n}');`)
  const outcomes=await Promise.allSettled([transfer(f,p,{hold:0.3}),sql(`${service}select public.fn_inscrever_por_convite_atomico('${id(1)}','${id(++key)}','group',
    '${f.groupToken}','${id(100)}','${line}',null,'${f.slots[2]}',null,null);`)])
  assert.ok(outcomes.every(t=>t.status==='fulfilled'),JSON.stringify(outcomes.map(t=>t.reason?.message)))
  const after=await state(f);assert.equal(after.parts.length,2);assert.equal(after.parts.find(t=>t.id===p).slot_id,f.slots[1])
  return {sessions:2,commits:2,sameTeam:true}
})
await test('Selected staff grant revocation waits for the already authorized transfer transaction',async()=>{
  await staff();const f=await fixture(),p=await insert(f)
  const moving=transfer(f,p,{actor:11,hold:1})
  await new Promise(resolve=>setTimeout(resolve,200))
  const revoke=sql(`update public.manager_produtora set pode_gerenciar_campeonato=false where id='${id(410)}';`)
  await new Promise(resolve=>setTimeout(resolve,150))
  const waiting=await json(`select to_jsonb(coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0),false))
    from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and query like 'update public.manager_produtora%';`)
  await Promise.all([moving,revoke]);assert.equal(waiting,true)
  const evidence=await refuse(f,p,{source:f.slots[1],target:f.slots[2],actor:11},/Sem permissão/);await resetAccess()
  return {...evidence,revocationLockObserved:true}
})
const summary={generatedAt:new Date().toISOString(),database,productionReads:0,productionWrites:0,productionDdl:0,
  native:true,backendParityFixturesCap:1,passed:results.filter(t=>t.passed).length,failed:results.filter(t=>!t.passed).length,results}
fs.writeFileSync(directory+'/native-transfer.json',JSON.stringify(summary,null,2))
console.log(JSON.stringify({passed:summary.passed,failed:summary.failed}))
if(summary.failed)process.exitCode=1
