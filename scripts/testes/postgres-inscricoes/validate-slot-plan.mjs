import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sql,runFile,directory} from './docker-lab.mjs'
import {id,quote,service,seed,championship} from './fixtures.mjs'

// Explicit synthetic databases only; this script never accepts a URL or token.
const database=process.argv[2]||'dropzone_validation_movements'
if(!/^dropzone_validation_[a-z0-9_]+$/.test(database))throw new Error('Invalid fixture database.')
const output=process.argv[3]||'relatorios-testes/movimentacoes-2026-10-11'
if(!/^relatorios-testes\/[a-z0-9-]+$/.test(output))throw new Error('Invalid evidence directory.')
fs.mkdirSync(output,{recursive:true})
const results=[],reproductions=[]
const json=async text=>JSON.parse(await sql(text))
const rejected=async(promise,pattern)=>{
  let message;try{await promise}catch(error){message=error.message}
  assert.ok(message,'Expected refusal');if(pattern)assert.match(message,pattern);return message
}
const insert=async(f,team=100,slot=0)=>{
  const part=id(f.n+30+team-100)
  await sql(`set request.jwt.claim.role='service_role';insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id)
    values('${part}','${f.camp}','${id(team)}','${id(team+100)}','${f.slots[slot]}');`)
  return part
}
const state=async f=>json(`select jsonb_build_object(
  'parts',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_equipes t where campeonato_id='${f.camp}'),
  'slots',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_slots t where campeonato_id='${f.camp}'),
  'history',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_grupo_escolha_historico t where campeonato_id='${f.camp}'),
  'links',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_links t where campeonato_id='${f.camp}'),
  'tokens',(select jsonb_agg(to_jsonb(t) order by id) from public.tokens t where campeonato_id='${f.camp}'),
  'agenda',(select jsonb_agg(to_jsonb(t) order by id) from public.agenda_compromissos t where campeonato_id='${f.camp}'),
  'receipts',(select jsonb_agg(to_jsonb(t) order by actor_id,request_id) from public.movimentacao_recibos t where resultado->>'campeonato_id'='${f.camp}'));`)

const reconstruction=fs.readFileSync(directory+'/schema-reconstruction.sql','utf8').replace(/^create role .*;\r?\n/gm,'')
// Baseline catalog, before installing ANY candidate: reproduce the HTTP write sequences.
const baseline=database+'_baseline'
await sql(`create database ${baseline};`,{database:'dropzone_audit'})
process.env.DROPZONE_FIXTURE_DB=baseline
await sql(reconstruction,{timeout:60000})
await seed()
const anotherPhase=async f=>{
  const phase=id(f.n+52),group=id(f.n+50)
  await sql(`insert into public.campeonato_fases(id,campeonato_id,nome) values('${phase}','${f.camp}','Second phase');
    insert into public.campeonato_grupos(id,campeonato_id,fase_id,nome,slots) values('${group}','${f.camp}','${phase}','Second',1);
    update public.campeonato_slots set fase_id='${phase}',grupo_id='${group}' where id='${f.slots[1]}';`)
}
let f=await championship(71000);let part=await insert(f)
await sql(`update public.campeonato_equipes set slot_id=null where id='${part}';`)
let observed=await json(`select jsonb_build_object('slot_id',slot_id,'grupo_id',grupo_id,'slot_numero',slot_numero) from public.campeonato_equipes where id='${part}';`)
assert.equal(observed.slot_id,f.slots[0])
reproductions.push({name:'Published BEFORE trigger rehydrates slot_id when group/number remain',observed})

f=await championship(71100);part=await insert(f);const other=await insert(f,101,1)
await sql(`update public.campeonato_slots set equipe_id=null,line_id=null,status='livre' where id in('${f.slots[0]}','${f.slots[1]}');`)
await sql(`update public.campeonato_equipes set slot_id=null where id='${part}';`)
const swapFailure=await rejected(sql(`update public.campeonato_equipes set slot_id='${f.slots[0]}',grupo_id='${f.group}',slot_numero=1 where id='${other}';`),/unique|duplicate/i)
observed=await json(`select jsonb_build_object('targetLine',(select line_id from public.campeonato_slots where id='${f.slots[1]}'),
  'targetPartSlot',(select slot_id from public.campeonato_equipes where id='${other}'));`)
assert.equal(observed.targetLine,null);assert.equal(observed.targetPartSlot,f.slots[1])
reproductions.push({name:'Legacy swap fails after autocommitted clears and leaves partial state',failure:swapFailure,observed})

f=await championship(71200);await anotherPhase(f);part=await insert(f)
await sql(`update public.campeonato_equipes set slot_id='${f.slots[1]}' where id='${part}';
  update public.campeonato_slots set equipe_id=null,line_id=null,status='livre' where id='${f.slots[0]}';`)
const replacement=await insert(f,101,0)
const rollbackFailure=await rejected(sql(`update public.campeonato_equipes set slot_id='${f.slots[0]}' where id='${part}';`),/unique|duplicate/i)
// Current route ignores returned rollback errors and then writes both mirrors blindly.
await sql(`update public.campeonato_slots set equipe_id=null,line_id=null,status='livre' where id='${f.slots[1]}';
  update public.campeonato_slots set equipe_id='${id(100)}',line_id='${id(200)}',status='ocupado' where id='${f.slots[0]}';`)
observed=await json(`select jsonb_build_object('replacementLine',(select line_id from public.campeonato_equipes where id='${replacement}'),
  'mirrorLine',(select line_id from public.campeonato_slots where id='${f.slots[0]}'),
  'originalPartSlot',(select slot_id from public.campeonato_equipes where id='${part}'),
  'originalMirrorLine',(select line_id from public.campeonato_slots where id='${f.slots[1]}'));`)
assert.equal(observed.replacementLine,id(201));assert.equal(observed.mirrorLine,id(200));assert.equal(observed.originalMirrorLine,null)
reproductions.push({name:'Legacy compensation overwrites replacement after rollback participation update fails',failure:rollbackFailure,observed})

f=await championship(71300);await anotherPhase(f);part=await insert(f)
await sql(`update public.campeonato_slots set equipe_id='${id(101)}',line_id='${id(201)}',status='ocupado' where id='${f.slots[1]}';`)
const affected=Number(await sql(`with changed as(update public.campeonato_slots set equipe_id='${id(100)}',line_id='${id(200)}',status='ocupado'
  where id='${f.slots[1]}' and equipe_id is null and line_id is null returning id) select count(*) from changed;`))
assert.equal(affected,0)
await sql(`update public.campeonato_equipes set slot_id='${f.slots[1]}' where id='${part}';`)
observed=await json(`select jsonb_build_object('claimedRows',${affected},'mirrorLine',line_id) from public.campeonato_slots where id='${f.slots[1]}';`)
assert.equal(observed.mirrorLine,id(200))
reproductions.push({name:'Unchecked zero-row claim plus published mirror overwrites foreign occupant',observed})
f=await championship(71400);part=await insert(f)
const samePhaseFailure=await rejected(sql(`update public.campeonato_slots set equipe_id='${id(100)}',line_id='${id(200)}',status='ocupado'
  where id='${f.slots[1]}';`),/campeonato_slots_fase_line_unique/)
observed=await json(`select jsonb_build_object('sourceLine',(select line_id from public.campeonato_slots where id='${f.slots[0]}'),
  'targetLine',(select line_id from public.campeonato_slots where id='${f.slots[1]}'));`)
assert.equal(observed.sourceLine,id(200));assert.equal(observed.targetLine,null)
reproductions.push({name:'Same-phase legacy reserve-first move rejected by native unique index',failure:samePhaseFailure,observed})
fs.writeFileSync(output+'/published-sequence-reproductions.json',JSON.stringify({scope:'Synthetic native SQL sequences from exported catalog, no production incident asserted.',reproductions},null,2))

await sql(`create database ${database};`,{database:'dropzone_audit'})
process.env.DROPZONE_FIXTURE_DB=database
await sql(reconstruction,{timeout:60000})
await seed()
await runFile('docs/sql/20261011_slot_mirror_guard_candidate.sql')
await runFile('docs/sql/20261011_slot_permissions_candidate.sql')
await runFile('docs/sql/20261011_slot_plan_candidate.sql')
let next=72000,key=80000
const fixture=async(n=4)=>{next+=100;return championship(next,n)}
const plan=async(f,targets)=>json(`select jsonb_agg(jsonb_build_object('id',id,'expected_updated_at',updated_at,
  'expected_slot_id',slot_id,'expected_grupo_id',grupo_id,'expected_slot_numero',slot_numero,
  'expected_equipe_id',equipe_id,'expected_line_id',line_id,'target_slot_id',
    ((${quote(JSON.stringify(targets))}::jsonb)->>id::text)::uuid) order by id)
  from public.campeonato_equipes where campeonato_id='${f.camp}';`)
const apply=(f,plan,{actor=1,request=id(++key),action='move',note=null,prefix='',hold=0}={})=>sql(`${service}${prefix}begin;
  select pg_backend_pid();select public.fn_aplicar_plano_slots_atomico('${id(actor)}','${request}','${f.camp}',${quote(action)},
    ${quote(JSON.stringify(plan))}::jsonb,${note===null?'null':quote(note)});${hold?`select pg_sleep(${hold});`:''}commit;`)
  .then(out=>{const lines=out.split('\n');return {pid:Number(lines[0]),result:JSON.parse(lines[1])}})
const test=async(name,body)=>{try{const evidence=await body();results.push({name,passed:true,...evidence});console.log('PASS '+name)}
  catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message)}}
const refusal=async(f,plan,options,pattern)=>{const before=await state(f);const failure=await rejected(apply(f,plan,options),pattern);assert.deepEqual(await state(f),before);return {failure,unchanged:true}}

await test('Move updates canonical location, releases exact source and writes one history/receipt',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]})
  const out=await apply(f,s),after=await state(f)
  assert.equal(out.result.participacoes[0].slot_id,f.slots[1]);assert.equal(after.slots[0].line_id,null)
  assert.equal(after.slots[1].line_id,id(200));assert.equal(after.history.length,1);assert.equal(after.receipts.length,1)
  return {rows:1,history:1,receipts:1}
})
await test('Assign places an already active enrollment with no location, without creating a new enrollment',async()=>{
  const f=await fixture(),p=id(f.n+30)
  await sql(`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id)
    values('${p}','${f.camp}','${id(100)}','${id(200)}');`)
  await apply(f,await plan(f,{[p]:f.slots[0]}),{action:'assign'});const after=await state(f)
  assert.equal(after.parts.length,1);assert.equal(after.parts[0].slot_id,f.slots[0]);assert.equal(after.slots[0].line_id,id(200))
  return {existingEnrollmentOnly:true}
})
await test('Move refuses an enrollment without a source location',async()=>{
  const f=await fixture(),p=id(f.n+30)
  await sql(`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id)
    values('${p}','${f.camp}','${id(100)}','${id(200)}');`)
  return refusal(f,await plan(f,{[p]:f.slots[0]}),{action:'move'},/Ação incompatível/)
})
await test('Swap detaches complete tuples and preserves unrelated reserved slot',async()=>{
  const f=await fixture(),p=await insert(f),q=await insert(f,101,1)
  await sql(`update public.campeonato_slots set status='reservado' where id='${f.slots[3]}';`)
  const before=await state(f),s=await plan(f,{[p]:f.slots[1],[q]:f.slots[0]})
  await apply(f,s,{action:'swap'});const after=await state(f)
  assert.equal(after.parts[0].slot_id,f.slots[1]);assert.equal(after.parts[1].slot_id,f.slots[0])
  assert.deepEqual(after.slots[3],before.slots[3]);assert.equal(after.history.length,2)
  return {rows:2,untouchedReserved:true}
})
await test('Shuffle cyclic permutation of three rows preserves fourth occupant',async()=>{
  const f=await fixture(),p=await insert(f),q=await insert(f,101,1),r=await insert(f,102,2),other=await insert(f,103,3)
  const before=await state(f);const s=(await plan(f,{[p]:f.slots[1],[q]:f.slots[2],[r]:f.slots[0]})).filter(t=>t.id!==other)
  await apply(f,s,{action:'shuffle'});const after=await state(f)
  assert.deepEqual(after.parts[3],before.parts[3]);assert.deepEqual(after.slots[3],before.slots[3]);assert.equal(after.history.length,3)
  assert.deepEqual(after.slots.slice(0,3).map(t=>t.line_id),[id(202),id(200),id(201)])
  return {rows:3,unrelatedPreserved:true}
})
await test('Distribution across two groups keeps phase/group/number canonical',async()=>{
  const f=await fixture(),p=await insert(f),q=await insert(f,101,1),group=id(f.n+50),slot=f.slots[2]
  await sql(`
    insert into public.campeonato_grupos(id,campeonato_id,fase_id,nome,slots) values('${group}','${f.camp}','${f.phase}','Second',1);
    update public.campeonato_slots set grupo_id='${group}',slot_numero=1,slot_letra='A' where id='${slot}';`)
  await apply(f,await plan(f,{[p]:slot,[q]:f.slots[0]}),{action:'distribute'});const after=await state(f)
  assert.equal(after.parts[0].grupo_id,group);assert.equal(after.parts[0].slot_numero,1);assert.equal(after.parts[1].slot_id,f.slots[0])
  return {groups:2,rows:2}
})
await test('Move across phases derives the new group/number and preserves token/link quota',async()=>{
  const f=await fixture();await anotherPhase(f);const p=await insert(f),before=await state(f)
  await apply(f,await plan(f,{[p]:f.slots[1]}));const after=await state(f)
  assert.equal(after.parts[0].grupo_id,id(f.n+50));assert.equal(after.parts[0].slot_numero,2)
  assert.deepEqual(after.tokens,before.tokens);assert.deepEqual(after.links,before.links)
  return {phases:2,quotaUnchanged:true}
})
await test('Cancel clears complete location while keeping active enrollment; restore validates latest cancellation',async()=>{
  const f=await fixture(),p=await insert(f)
  await apply(f,await plan(f,{[p]:null}),{action:'cancel'});let after=await state(f)
  assert.equal(after.parts[0].status,'ativo');assert.equal(after.parts[0].slot_id,null);assert.equal(after.parts[0].grupo_id,null)
  assert.equal(after.parts[0].slot_numero,null);assert.equal(after.slots[0].line_id,null)
  await apply(f,await plan(f,{[p]:f.slots[0]}),{action:'restore'});after=await state(f)
  assert.equal(after.parts[0].slot_id,f.slots[0]);assert.equal(after.history.length,2);return {cancelAndRestore:true}
})
await test('Receipt replay of same key/plan survives committed response loss without duplicate history',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]}),request=id(++key)
  const first=await apply(f,s,{request});const before=await state(f);const replay=await apply(f,s,{request})
  assert.equal(replay.result.repetida,true);assert.deepEqual({...replay.result,repetida:undefined},{...first.result,repetida:undefined})
  assert.deepEqual(await state(f),before);return {commits:1,replayed:true}
})
await test('Receipt key cannot be reused with altered plan',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]}),request=id(++key)
  await apply(f,s,{request});return refusal(f,[{...s[0],target_slot_id:f.slots[2]}],{request},/outro plano/)
})
await test('Stale snapshot refuses entire operation without rollback writes',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]})
  await sql(`update public.campeonato_equipes set nome_exibicao='Changed' where id='${p}';`)
  return refusal(f,s,{},/participação mudou/)
})
await test('Other owner cannot move participation even with exact snapshot',async()=>{
  const f=await fixture(),p=await insert(f);return refusal(f,await plan(f,{[p]:f.slots[1]}),{actor:2},/proprietário/)
})
await test('Account restriction blocks owner',async()=>{
  const f=await fixture(),p=await insert(f)
  await sql(`insert into public.sistema_restricoes_conta(auth_user_id,tipo,motivo,ativo,aplicado_por) values('${id(1)}','suspensao','Synthetic',true,'${id(2)}');`)
  try{return await refusal(f,await plan(f,{[p]:f.slots[1]}),{},/Conta indisponível/)}
  finally{await sql(`delete from public.sistema_restricoes_conta where auth_user_id='${id(1)}';`)}
})
for(const scenario of ['reserved','occupied','foreign','inconsistent'])await test('Refuses '+scenario+' target/origin without touching any row',async()=>{
  const f=await fixture(),p=await insert(f);let target=f.slots[1]
  if(scenario==='reserved')await sql(`update public.campeonato_slots set status='reservado' where id='${target}';`)
  if(scenario==='occupied')await insert(f,101,1)
  if(scenario==='foreign')target=(await fixture()).slots[0]
  if(scenario==='inconsistent')await sql(`update public.campeonato_slots set line_id='${id(201)}',equipe_id='${id(101)}' where id='${f.slots[0]}';`)
  const s=(await plan(f,{[p]:target})).filter(t=>t.id===p)
  return refusal(f,s,{},/ocupado|fora da estrutura|reconciliação/)
})
for(const status of ['pendente','removido'])await test('Refuses '+status+' participation even with current snapshot',async()=>{
  const f=await fixture(),p=await insert(f)
  await sql(`update public.campeonato_equipes set status='${status}' where id='${p}';`)
  return refusal(f,await plan(f,{[p]:f.slots[1]}),{},/participação mudou/)
})
await test('Restore refuses a different available target',async()=>{
  const f=await fixture(),p=await insert(f);await apply(f,await plan(f,{[p]:null}),{action:'cancel'})
  return refusal(f,await plan(f,{[p]:f.slots[1]}),{action:'restore'},/último cancelamento/)
})
await test('Empty/duplicate/incomplete plans are refused before writes',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]})
  for(const bad of [[],[...s,...s],[{id:p}],[{...s[0],target_slot_id:null}]])await refusal(f,bad,{},/inválido|repetido|incompleto|incompatível/)
  return {refusals:4}
})
await test('Malformed UUID/date and excess 1001 plans fail closed',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]})
  for(const bad of [[{...s[0],id:'bad'}],[{...s[0],expected_updated_at:'bad'}],Array.from({length:1001},()=>s[0])])await refusal(f,bad,{},/uuid|timestamp|inválido/)
  return {refusals:3}
})
await test('Non-service role cannot execute function or read private receipts',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]})
  for(const role of ['anon','authenticated']){
    await rejected(sql(`set role ${role};select public.fn_aplicar_plano_slots_atomico('${id(1)}','${id(++key)}','${f.camp}','move',${quote(JSON.stringify(s))}::jsonb,null);`),/permission denied/)
    await rejected(sql(`set role ${role};select * from public.movimentacao_recibos;`),/permission denied/)
  }
  await rejected(sql(`set request.jwt.claim.role='authenticated';select public.fn_aplicar_plano_slots_atomico('${id(1)}','${id(++key)}','${f.camp}','move',${quote(JSON.stringify(s))}::jsonb,null);`),/exclusiva/)
  return {roles:2,securityDefinerChecksCaller:true}
})
await test('Published old mirror is incompatible: cancel refuses and rolls back all changes',async()=>{
  const f=await fixture(),p=await insert(f)
  const catalog=JSON.parse(fs.readFileSync('relatorios-testes/banco-publicado.json','utf8'))
  const old=catalog.functions.find(t=>t.function_name==='fn_sync_slot_mirror_from_participacao')
  assert.ok(old?.definition)
  await sql(old.definition)
  try{return await refusal(f,await plan(f,{[p]:null}),{action:'cancel'},/Gatilho de slots incompatível/)}
  finally{await runFile('docs/sql/20261011_slot_mirror_guard_candidate.sql')}
})
await sql(`create function public.audit_movement_fail() returns trigger language plpgsql as $$begin
  if current_setting('audit_movement.fail',true)=tg_table_name then raise exception 'Injected movement failure';end if;return new;end;$$;
  create trigger zzz_audit_movement_history after insert on public.campeonato_grupo_escolha_historico for each row execute function public.audit_movement_fail();
  create trigger zzz_audit_movement_receipt after insert on public.movimentacao_recibos for each row execute function public.audit_movement_fail();`)
for(const table of ['campeonato_grupo_escolha_historico','movimentacao_recibos'])await test('Injected '+table+' failure rolls back parts/mirrors/history/receipts together',async()=>{
  const f=await fixture(),p=await insert(f),q=await insert(f,101,1)
  return refusal(f,await plan(f,{[p]:f.slots[1],[q]:f.slots[0]}),{action:'swap',prefix:`set audit_movement.fail=${quote(table)};`},/Injected/)
})
await test('Native agenda rebuild follows group move and rolls back on history failure',async()=>{
  const f=await fixture();await anotherPhase(f);const p=await insert(f),game=id(f.n+60)
  await sql(`insert into public.campeonato_jogos(id,campeonato_id,nome,fase_id,grupos_ids,data_jogo,horario)
    values('${game}','${f.camp}','Synthetic scheduled game','${f.phase}',array['${f.group}'::uuid],'2026-10-12','12:00');`)
  const before=await state(f);assert.ok(before.agenda.some(t=>t.destino_tipo==='equipe'&&t.destino_id===id(100)))
  await refusal(f,await plan(f,{[p]:f.slots[1]}),{prefix:"set audit_movement.fail='campeonato_grupo_escolha_historico';"},/Injected/)
  await apply(f,await plan(f,{[p]:f.slots[1]}));const after=await state(f)
  assert.ok(!after.agenda.some(t=>t.destino_tipo==='equipe'&&t.destino_id===id(100)))
  assert.ok(after.agenda.some(t=>t.destino_tipo==='usuario'&&t.destino_id===id(1)))
  return {nativeAgenda:true,rollbackPreservesOriginalRows:true}
})
await test('Two actual sessions competing for the same target: one commit, one stale refusal',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]})
  const outcomes=await Promise.allSettled([apply(f,s,{hold:0.4}),apply(f,s)])
  assert.equal(outcomes.filter(t=>t.status==='fulfilled').length,1)
  assert.match(outcomes.find(t=>t.status==='rejected').reason.message,/participação mudou/)
  const after=await state(f);assert.equal(after.history.length,1);assert.equal(after.receipts.length,1)
  return {actualSessions:2,commits:1,rejections:1}
})
await test('Six actual sessions same key/plan produce one commit and five receipt replays',async()=>{
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]}),request=id(++key)
  const pending=Array.from({length:6},()=>apply(f,s,{request,hold:0.5}))
  await new Promise(resolve=>setTimeout(resolve,200))
  const locks=await json(`select jsonb_agg(jsonb_build_object('pid',pid,'wait',wait_event_type,'event',wait_event,
    'blockedBy',pg_blocking_pids(pid))) from pg_stat_activity where datname=current_database()
    and pid<>pg_backend_pid() and state='active' and query like '%fn_aplicar_plano_slots_atomico%';`)
  const outcomes=await Promise.all(pending)
  assert.equal(new Set(outcomes.map(t=>t.pid)).size,6);assert.equal(outcomes.filter(t=>t.result.repetida).length,5)
  assert.ok(locks?.some(t=>t.wait==='Lock'&&t.blockedBy.length>0),'Expected observed native lock wait')
  const after=await state(f);assert.equal(after.history.length,1);assert.equal(after.receipts.length,1)
  return {actualSessions:6,commits:1,replays:5,pids:outcomes.map(t=>t.pid),observedLocks:locks}
})
await test('Two different participants compete for one free target: one move, one occupied refusal',async()=>{
  const f=await fixture(),p=await insert(f),q=await insert(f,101,1),all=await plan(f,{[p]:f.slots[2],[q]:f.slots[2]})
  const outcomes=await Promise.allSettled([apply(f,all.filter(t=>t.id===p),{hold:0.4}),apply(f,all.filter(t=>t.id===q))])
  assert.equal(outcomes.filter(t=>t.status==='fulfilled').length,1);assert.match(outcomes.find(t=>t.status==='rejected').reason.message,/Destino ocupado/)
  const after=await state(f);assert.equal(after.parts.filter(t=>t.slot_id===f.slots[2]).length,1);assert.equal(after.history.length,1)
  return {actualSessions:2,commits:1,rejections:1}
})
await test('Concurrent enrollment and movement to same empty target leave exactly one owner',async()=>{
  await runFile('docs/sql/20261011_atomic_enrollment_candidate.sql')
  const f=await fixture(),p=await insert(f),s=await plan(f,{[p]:f.slots[1]})
  const enrollment=sql(`${service}begin;select pg_backend_pid();select public.fn_inscrever_por_convite_atomico('${id(2)}','${id(++key)}','group',
    '${f.groupToken}','${id(101)}','${id(201)}',null,'${f.slots[1]}',null,null);commit;`)
  const outcomes=await Promise.allSettled([apply(f,s),enrollment]);assert.equal(outcomes.filter(t=>t.status==='fulfilled').length,1)
  const after=await state(f),target=after.slots[1],owners=after.parts.filter(t=>t.slot_id===f.slots[1])
  assert.equal(owners.length,1);assert.equal(target.line_id,owners[0].line_id)
  return {actualSessions:2,commits:1,rejections:1,ownerLine:target.line_id}
})
const summary={database,synthetic:true,productionReads:0,productionWrites:0,integrated:false,permissionScope:'Default owner tested; explicit manage permission is covered separately by transfer tests.',
  reproductions:reproductions.length,passed:results.filter(t=>t.passed).length,failed:results.filter(t=>!t.passed).length,results}
fs.writeFileSync(output+'/native-slot-plan.json',JSON.stringify(summary,null,2))
console.log(JSON.stringify({reproductions:summary.reproductions,passed:summary.passed,failed:summary.failed,database}))
if(summary.failed)process.exitCode=1
