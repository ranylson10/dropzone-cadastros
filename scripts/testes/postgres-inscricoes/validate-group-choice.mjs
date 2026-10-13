import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sql} from './docker-lab.mjs'
import {id,quote,service,championship} from './fixtures.mjs'
const database=process.argv[2],directory=process.argv[3]
if(!/^dropzone_validation_[a-z0-9_]+$/.test(database||'')||!/^relatorios-testes\/[a-z0-9-]+$/.test(directory||''))throw new Error('Explicit fixture DB and evidence directory required')
process.env.DROPZONE_FIXTURE_DB=database
let next=500000,key=800000;const results=[]
const json=async query=>JSON.parse(await sql(query))
const test=async(name,body)=>{try{results.push({name,passed:true,...await body()});console.log('PASS '+name)}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message)}}
async function fixture({assigned=false,open=true,change=true}={}){next+=100;const f=await championship(next)
  f.part=id(next+30)
  await sql(`insert into public.campeonato_grupo_escolha_configuracoes(campeonato_id,fase_id,aberta,permite_troca) values('${f.camp}','${f.phase}',${open},${change});
    insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id) values('${f.part}','${f.camp}','${id(100)}','${id(200)}',${assigned?quote(f.slots[0]):'null'});`)
  return f
}
const state=f=>json(`select jsonb_build_object('parts',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_equipes t where campeonato_id='${f.camp}'),
  'slots',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_slots t where campeonato_id='${f.camp}'),
  'history',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_grupo_escolha_historico t where campeonato_id='${f.camp}'),
  'notifications',(select jsonb_agg(to_jsonb(t) order by id) from public.notificacoes t where payload->>'campeonato_id'='${f.camp}'),
  'receipts',(select jsonb_agg(to_jsonb(t) order by actor_id,request_id) from public.movimentacao_recibos t where resultado->>'campeonato_id'='${f.camp}'),
  'fixtureBroadcasts',(select jsonb_agg(to_jsonb(t) order by payload::text,event,topic) from realtime.fixture_events t));`)
const choose=(f,{action='assign',scope='team',actor=1,request=id(++key),source=null,target=f.slots[1],group=f.group,history=null,prefix='',hold=0}={})=>sql(`${service}${prefix}begin;select pg_backend_pid();select public.fn_escolher_grupo_atomico(
  '${id(actor)}','${request}','${f.camp}',${quote(scope)},${quote(action)},'${f.part}',${source?quote(source):'null'},
  ${action==='assign'?quote(group):'null'},${action==='assign'?quote(target):'null'},${history?quote(history):'null'},null);${hold?`select pg_sleep(${hold});`:''}commit;`).then(out=>{const lines=out.split('\n');return {pid:Number(lines[0]),data:JSON.parse(lines[1])}})
async function refuse(f,options,pattern){const before=await state(f);let failure;try{await choose(f,options)}catch(error){failure=error.message}assert.ok(failure,'Expected rejection');if(pattern)assert.match(failure,pattern);assert.deepEqual(await state(f),before);return {unchanged:true,failure}}
const history=async f=>(await state(f)).history.filter(t=>t.grupo_novo_id===null).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))[0].id

await test('Team first choice creates one canonical placement, team history, notification and receipt',async()=>{
  const f=await fixture(),result=await choose(f),after=await state(f)
  assert.equal(result.data.target_slot_id,f.slots[1]);assert.equal(after.parts[0].slot_id,f.slots[1]);assert.equal(after.history[0].origem,'equipe')
  assert.equal(after.notifications.length,1);assert.equal(after.notifications[0].tipo,'escolha_grupo_confirmada');assert.equal(after.receipts.length,1)
})
await test('Same-phase team move releases source before occupying target under native unique index',async()=>{
  const f=await fixture({assigned:true});await choose(f,{source:f.slots[0]});const after=await state(f)
  assert.equal(after.slots.find(t=>t.id===f.slots[0]).status,'livre');assert.equal(after.parts[0].slot_id,f.slots[1]);assert.equal(after.notifications[0].tipo,'escolha_grupo_editada')
})
await test('Team cancellation and restore use exact cancellation history and preserve enrollment',async()=>{
  const f=await fixture({assigned:true});await choose(f,{action:'cancel',source:f.slots[0]});const h=await history(f)
  await choose(f,{action:'restore',history:h});const after=await state(f)
  assert.equal(after.parts[0].status,'ativo');assert.equal(after.parts[0].slot_id,f.slots[0]);assert.equal(after.history.length,2);assert.equal(after.notifications.length,2)
})
for(const action of ['assign','cancel','restore'])await test('Lost result replay after '+action+' precedes current location/window validation',async()=>{
  const f=await fixture({assigned:action!=='assign'});let h=null,source=action==='cancel'?f.slots[0]:null
  if(action==='restore'){await choose(f,{action:'cancel',source:f.slots[0]});h=await history(f)}
  const request=id(++key),options={action,source,history:h,request};const first=await choose(f,options),before=await state(f)
  await sql(`update public.campeonato_grupo_escolha_configuracoes set aberta=false where campeonato_id='${f.camp}';`)
  const replay=await choose(f,options);assert.equal(replay.data.repetida,true);assert.deepEqual(replay.data,{...first.data,repetida:true});assert.deepEqual(await state(f),before)
})
await test('Same key refuses altered immutable intent without notifications/history',async()=>{
  const f=await fixture(),request=id(++key);await choose(f,{request});return refuse(f,{request,target:f.slots[2]},/outra escolha/)
})
for(const actor of [2,11,12])await test('Team ownership excludes foreign owner/staff/visitor '+actor,async()=>refuse(await fixture(),{actor},/não pertence/))
for(const [name,change] of [['closed','aberta=false'],['future','abre_em=clock_timestamp()+interval \'1 day\''],['expired','fecha_em=clock_timestamp()-interval \'1 day\''],['inverted',"abre_em=clock_timestamp()+interval '1 day',fecha_em=clock_timestamp()-interval '1 day'"]])await test('Team choice rejects '+name+' window',async()=>{
  const f=await fixture();await sql(`update public.campeonato_grupo_escolha_configuracoes set ${change} where campeonato_id='${f.camp}';`);return refuse(f,{},/não está aberta/)
})
await test('First choice allowed with change false; later move and cancellation refused',async()=>{
  const f=await fixture({change:false});await choose(f);await refuse(f,{source:f.slots[1],target:f.slots[2]},/alteração/);return refuse(f,{action:'cancel',source:f.slots[1]},/alteração/)
})
await test('Restore refuses change false',async()=>{
  const f=await fixture({assigned:true});await choose(f,{action:'cancel',source:f.slots[0]});const h=await history(f)
  await sql(`update public.campeonato_grupo_escolha_configuracoes set permite_troca=false where campeonato_id='${f.camp}';`);return refuse(f,{action:'restore',history:h},/alteração/)
})
for(const type of ['group','slot'])await test('Team assignment rejects '+type+' block',async()=>{
  const f=await fixture();await sql(`insert into public.campeonato_grupo_escolha_bloqueios(campeonato_id,fase_id,${type==='group'?'grupo_id':'slot_id'}) values('${f.camp}','${f.phase}','${type==='group'?f.group:f.slots[1]}');`)
  return refuse(f,{},/bloqueado/)
})
await test('Restore cannot bypass a new block on the previous slot',async()=>{
  const f=await fixture({assigned:true});await choose(f,{action:'cancel',source:f.slots[0]});const h=await history(f)
  await sql(`insert into public.campeonato_grupo_escolha_bloqueios(campeonato_id,fase_id,slot_id) values('${f.camp}','${f.phase}','${f.slots[0]}');`)
  return refuse(f,{action:'restore',history:h},/bloqueado/)
})
await test('New cancel history invalidates an older restoration intent',async()=>{
  const f=await fixture({assigned:true});await choose(f,{action:'cancel',source:f.slots[0]});const old=await history(f)
  await choose(f,{action:'restore',history:old});await choose(f,{source:f.slots[0],target:f.slots[2]});await choose(f,{action:'cancel',source:f.slots[2]})
  return refuse(f,{action:'restore',history:old},/histórico mudou/)
})
await test('Stale source slot refuses a later move without touching replacement',async()=>refuse(await fixture({assigned:true}),{},/participação mudou/))
await test('Foreign group/slot rejected',async()=>{const f=await fixture(),other=await fixture();return refuse(f,{group:other.group,target:other.slots[1]},/fora do campeonato/)})
await test('Reserved target rejected and preserved',async()=>{const f=await fixture();await sql(`update public.campeonato_slots set status='reservado' where id='${f.slots[1]}';`);return refuse(f,{},/ocupado ou reservado/)})
await test('Admin manually assigns, cancels and restores despite closed self-service window',async()=>{
  const f=await fixture({open:false});await choose(f,{scope:'admin'});await choose(f,{scope:'admin',action:'cancel',source:f.slots[1]});await choose(f,{scope:'admin',action:'restore',history:await history(f)})
  const after=await state(f);assert.equal(after.parts[0].slot_id,f.slots[1]);assert.ok(after.history.every(t=>t.origem==='administrador'));assert.equal(after.notifications.length,3)
})
await test('Admin readonly actor refused by existing permission helper',async()=>refuse(await fixture(),{scope:'admin',actor:12},/Sem permissão/))
await test('Revoked team ownership refuses even receipt replay',async()=>{
  const f=await fixture(),request=id(++key);await choose(f,{request});await sql(`update public.equipes set auth_user_id='${id(12)}',dono_auth_user_id='${id(12)}' where id='${id(100)}';`)
  const evidence=await refuse(f,{request},/não pertence/);await sql(`update public.equipes set auth_user_id='${id(1)}',dono_auth_user_id='${id(1)}' where id='${id(100)}';`);return evidence
})
for(const table of ['campeonato_grupo_escolha_historico','notificacoes','movimentacao_recibos'])await test('Failure in '+table+' rolls back entire placement/history/notification/receipt',async()=>{
  const f=await fixture();await sql(`create function public.choice_fail() returns trigger language plpgsql as $$begin raise exception 'Injected fixture';end;$$;
    create trigger choice_fail before insert on public.${table} for each row execute function public.choice_fail();`)
  try{return await refuse(f,{},/Injected fixture/)}finally{await sql(`drop trigger choice_fail on public.${table};drop function public.choice_fail();`)}
})
await test('Window expires during notification trigger and rolls back all rows',async()=>{
  const f=await fixture();await sql(`create function public.choice_close() returns trigger language plpgsql as $$begin update public.campeonato_grupo_escolha_configuracoes set fecha_em=clock_timestamp()-interval '1 millisecond' where campeonato_id='${f.camp}';return new;end;$$;
    create trigger choice_close before insert on public.notificacoes for each row execute function public.choice_close();`)
  try{return await refuse(f,{},/não está aberta/)}finally{await sql('drop trigger choice_close on public.notificacoes;drop function public.choice_close();')}
})
await test('Choice closure committed while waiting for team lock is re-read',async()=>{
  const f=await fixture();const closing=sql(`begin;select id from public.equipes where id='${id(100)}' for update;update public.campeonato_grupo_escolha_configuracoes set aberta=false where campeonato_id='${f.camp}';select pg_sleep(0.5);commit;`)
  await new Promise(resolve=>setTimeout(resolve,150));const selecting=refuse(f,{},/não está aberta/);await closing;return selecting
})
await test('Six sessions one key commit once and replay five times with a real request lock wait',async()=>{
  const f=await fixture(),request=id(++key),first=choose(f,{request,hold:0.6});await new Promise(resolve=>setTimeout(resolve,150))
  const rest=Array.from({length:5},()=>choose(f,{request}));await new Promise(resolve=>setTimeout(resolve,150))
  const locked=await json(`select to_jsonb(coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0),false)) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid();`)
  const values=await Promise.all([first,...rest]);assert.equal(new Set(values.map(v=>v.pid)).size,6);assert.equal(values.filter(v=>v.data.repetida).length,5);assert.equal(locked,true)
  const after=await state(f);assert.equal(after.history.length,1);assert.equal(after.notifications.length,1);assert.equal(after.receipts.length,1)
  return {sessions:6,commits:1,replays:5,lockWaitObserved:true}
})
await test('Two team owners competing for one slot produce one placement without orphan notification',async()=>{
  const f=await fixture(),other={...f,part:id(f.n+31)};await sql(`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id) values('${other.part}','${f.camp}','${id(101)}','${id(201)}');`)
  const outcomes=await Promise.allSettled([choose(f,{hold:0.2}),choose(other,{actor:2})]);assert.equal(outcomes.filter(t=>t.status==='fulfilled').length,1)
  const after=await state(f);assert.equal(after.history.length,1);assert.equal(after.notifications.length,1);assert.equal(after.receipts.length,1)
})
await test('Unprivileged database roles cannot execute group-choice wrapper',async()=>{
  const f=await fixture();for(const role of ['anon','authenticated'])await assert.rejects(sql(`set role ${role};select public.fn_escolher_grupo_atomico('${id(1)}','${id(++key)}','${f.camp}','team','assign','${f.part}',null,'${f.group}','${f.slots[1]}',null,null);`),/permission denied/)
})
await test('Primitive team capability refuses a foreign team even without wrapper',async()=>{
  const f=await fixture();const part=(await state(f)).parts[0]
  const plan=JSON.stringify([{id:part.id,expected_updated_at:part.updated_at,expected_slot_id:part.slot_id,expected_grupo_id:part.grupo_id,
    expected_slot_numero:part.slot_numero,expected_equipe_id:part.equipe_id,expected_line_id:part.line_id,target_slot_id:f.slots[1]}])
  await assert.rejects(sql(`${service}select public.fn_aplicar_plano_slots_atomico('${id(2)}','${id(++key)}','${f.camp}','assign',${quote(plan)}::jsonb,null,'team',null);`),/não pertence/)
})
const summary={generatedAt:new Date().toISOString(),database,native:true,productionReads:0,productionWrites:0,productionDdl:0,passed:results.filter(t=>t.passed).length,failed:results.filter(t=>!t.passed).length,results}
fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/native-group-choice.json',JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify({passed:summary.passed,failed:summary.failed}));if(summary.failed)process.exitCode=1
