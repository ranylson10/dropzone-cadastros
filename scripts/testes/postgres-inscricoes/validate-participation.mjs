import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {sql,runFile} from './docker-lab.mjs'
import {id,quote,service,championship} from './fixtures.mjs'
const database=process.argv[2],directory=process.argv[3]
if(!/^dropzone_validation_[a-z0-9_]+$/.test(database||'')||!/^relatorios-testes\/[a-z0-9-]+$/.test(directory||''))throw Error('Explicit synthetic DB and new evidence directory required')
process.env.DROPZONE_FIXTURE_DB=database;fs.mkdirSync(directory,{recursive:true})
let next=1030000,key=1130000
const results=[],json=async text=>JSON.parse(await sql(text)),test=async(name,body)=>{try{results.push({name,passed:true,...await body()});console.log('PASS '+name)}catch(e){results.push({name,passed:false,error:e.message});console.log('FAIL '+name+': '+e.message)}}
const fixture=async()=>{next+=100;return championship(next)}
const addArgs=(f,team=100,slot=0,name=null)=>({equipe_id:id(team),line_id:name?null:id(team+100),slot_id:f.slots[slot],nome_line:name,origem_entrada:null})
const requestArgs=(team=100)=>({equipe_id:id(team),line_id:id(team+100)})
const snapshot=part=>({equipe_id:part.equipe_id,line_id:part.line_id,slot_id:part.slot_id,status:part.status,updated_at:part.updated_at})
const editArgs=(part,extra={})=>({participacao_id:part.id,expected:snapshot(part),...extra})
const call=(f,action,args,{actor=1,request=id(++key),hold=0,prefix=''}={})=>sql(`${service}begin;${prefix}select pg_backend_pid();
  select public.fn_gravar_participacao_atomica('${id(actor)}','${request}','${f.camp}',${quote(action)},${quote(JSON.stringify(args))}::jsonb);
  ${hold?`select pg_sleep(${hold});`:''}commit;`,{timeout:20000}).then(out=>{const rows=out.split('\n');return {pid:Number(rows[0]),data:JSON.parse(rows[1])}})
const state=f=>json(`select jsonb_build_object(
 'parts',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_equipes t where campeonato_id='${f.camp}'),
 'slots',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_slots t where campeonato_id='${f.camp}'),
 'lines',(select jsonb_agg(to_jsonb(t) order by id) from public.equipe_lines t where equipe_id in('${id(100)}','${id(101)}','${id(102)}')),
 'config',(select to_jsonb(t) from public.campeonato_configuracoes t where campeonato_id='${f.camp}'),
 'agenda',(select jsonb_agg(to_jsonb(t) order by id) from public.agenda_compromissos t where campeonato_id='${f.camp}'),
 'links',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_links t where campeonato_id='${f.camp}'),
 'tokens',(select jsonb_agg(to_jsonb(t) order by id) from public.tokens t where campeonato_id='${f.camp}'),
 'audits',(select jsonb_agg(to_jsonb(t) order by actor_id,request_id) from public.participacao_operacoes t where campeonato_id='${f.camp}'),
 'receipts',(select jsonb_agg(to_jsonb(t) order by actor_id,request_id) from public.participacao_recibos t where resultado->>'campeonato_id'='${f.camp}'));`)
const reject=async(promise,pattern)=>{let failure;try{await promise}catch(e){failure=e.message}assert.ok(failure,'Expected refusal');if(pattern)assert.match(failure,pattern);return failure}
const refuse=async(f,action,args,options,pattern)=>{const before=await state(f),failure=await reject(call(f,action,args,options),pattern);assert.deepEqual(await state(f),before);return {failure,unchanged:true}}
const insert=async(f,status='pendente',slot=null,creator=1)=>json(`insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,status,slot_id,origem_entrada,criado_por,nome_exibicao)
 values('${f.camp}','${id(100)}','${id(200)}',${quote(status)},${slot?quote(slot):'null'},'inscricao','${id(creator)}','Fixture Line 1') returning to_jsonb(campeonato_equipes);`)
const seller=async(f,perms={adicionar_equipes:true,remover_proprias_equipes:true},limit=0)=>sql(`insert into public.campeonato_vendedores(id,campeonato_id,manager_id,token,status,limite_vagas,permissoes)
 values('${id(f.n+75)}','${f.camp}','${id(300)}','fixture-seller-${f.n}','ativo',${limit},${quote(JSON.stringify(perms))}::jsonb);`)
const workspace=async()=>sql(`insert into public.produtora_membros(id,produtora_id,auth_user_id,cargo,pode_ver,pode_operar) values('${id(401)}','${id(50)}','${id(12)}','operacao',true,true);`)
const liga=async(f,quantity=1)=>sql(`update public.campeonatos set tipo='liga' where id='${f.camp}';update public.campeonato_configuracoes
 set liga_divisoes='[{"nome":"Group","entradas":[{"tipo":"vaga_paga","quantidade":${quantity}}]}]'::jsonb where campeonato_id='${f.camp}';`)
const invariant=async f=>{const after=await state(f);for(const p of after.parts||[]){if(p.status==='ativo'&&p.slot_id){const slot=after.slots.find(s=>s.id===p.slot_id);assert.equal(slot.status,'ocupado');assert.equal(slot.line_id,p.line_id);assert.equal(slot.equipe_id,p.equipe_id)}
  else if(p.status!=='ativo')assert.equal(p.slot_id,null)}return after}
await test('Direct add synchronizes mirror and one audit/receipt without changing invitation/payment metadata',async()=>{
  const f=await fixture(),before=await state(f),out=await call(f,'add',addArgs(f)),after=await invariant(f)
  assert.equal(out.data.participacao.status,'ativo');assert.equal(after.audits.length,1);assert.equal(after.receipts.length,1);assert.deepEqual(after.links,before.links);assert.deepEqual(after.tokens,before.tokens)
})
await test('New line and enrollment commit together',async()=>{const f=await fixture(),out=await call(f,'add',addArgs(f,100,0,'Native new '+f.n));assert.equal(out.data.line.criada_agora,true);await invariant(f)})
await test('Inactive named line is reactivated; explicit inactive UUID is refused',async()=>{
  const f=await fixture();await sql(`update public.equipe_lines set status='inativo' where id='${id(200)}';`)
  try{await refuse(f,'add',addArgs(f),{},/Line inválida/);const out=await call(f,'add',addArgs(f,100,0,'Fixture Line 1'));assert.equal(out.data.line.criada_agora,false);assert.equal(out.data.participacao.line_id,id(200))}finally{await sql(`update public.equipe_lines set status='ativo' where id='${id(200)}';`)}
})
await test('Reserved target refuses a new line without orphaning it',async()=>{const f=await fixture();await sql(`update public.campeonato_slots set status='reservado' where id='${f.slots[0]}';`);return refuse(f,'add',addArgs(f,100,0,'Orphan should not exist'),{},/Slot ocupado ou reservado/)})
await test('Foreign target is refused',async()=>{const f=await fixture(),other=await fixture();return refuse(f,'add',{...addArgs(f),slot_id:other.slots[0]},{},/Slot fora/)})
await test('Catalog missing Liga configuration refuses enrollment without bypassing quotas',async()=>{
  const f=await fixture();await sql(`update public.campeonatos set tipo='liga' where id='${f.camp}';`)
  return refuse(f,'add',{...addArgs(f),origem_entrada:'vaga_paga'},{},/Configuração da Liga indisponível/)
})
// Guarded candidate applied ONLY in the disposable lab: complete local plan fields and origin enum.
// This is a schema change under test, not removal of constraints to accommodate invalid fixtures.
await runFile('docs/sql/20261011_liga_schema_candidate.sql')
console.log('LOCAL CANDIDATE ONLY: Liga plan fields and the six exact UI origins installed; not applied to Supabase.')
await test('Team request creates pending participation without occupying a slot',async()=>{const f=await fixture(),out=await call(f,'request',requestArgs()),after=await invariant(f);assert.equal(out.data.participacao.status,'pendente');assert.ok(after.slots.every(s=>s.status==='livre'))})
await test('Different request keys reuse the same pending participation',async()=>{const f=await fixture(),first=await call(f,'request',requestArgs()),second=await call(f,'request',requestArgs());assert.equal(first.data.participacao.id,second.data.participacao.id);const after=await state(f);assert.equal(after.parts.length,1);assert.equal(after.receipts.length,2)})
for(const actor of [2,11])await test('Request actor '+actor+' cannot impersonate the team owner',async()=>{const f=await fixture();return refuse(f,'request',requestArgs(),{actor},/não pertence/)})
for(const condition of ['closed','deadline','unapproved','banned'])await test('Request respects '+condition+' championship policy',async()=>{
  const f=await fixture();await sql(condition==='closed'?`update public.campeonato_configuracoes set aceita_novas_inscricoes_equipes=false where campeonato_id='${f.camp}';`
    :condition==='deadline'?`update public.campeonato_configuracoes set data_limite_inscricao='2020-01-01' where campeonato_id='${f.camp}';`
    :`update public.campeonatos set ${condition==='unapproved'?"aprovacao_status='pendente'":"status='banido'"} where id='${f.camp}';`)
  return refuse(f,'request',requestArgs(),{},/fechado ou indisponível/)
})
await test('Admin direct add and approve preserve manual override when enrollment is closed',async()=>{
  const f=await fixture(),p=await insert(f);await sql(`update public.campeonato_configuracoes set aceita_novas_inscricoes_equipes=false,data_limite_inscricao='2020-01-01' where campeonato_id='${f.camp}';`)
  await call(f,'approve',editArgs(p,{slot_id:f.slots[0]}));await call(f,'add',addArgs(f,101,1));await invariant(f)
})
for(const action of ['approve','reject','remove'])await test(action+' compares the exact expected version and refuses a stale snapshot',async()=>{
  const f=await fixture(),p=await insert(f,action==='remove'?'ativo':'pendente',action==='remove'?f.slots[0]:null)
  const args=editArgs(p,{slot_id:f.slots[1],motivo:'Reason'});args.expected.updated_at='2020-01-01T00:00:00Z';return refuse(f,action,args,{},/participação mudou/)
})
await test('Reject and resubmit preserve the request identity and clear review fields',async()=>{
  const f=await fixture(),first=await call(f,'request',requestArgs()),rejected=await call(f,'reject',editArgs(first.data.participacao,{motivo:'Review native'}))
  assert.equal(rejected.data.participacao.motivo_rejeicao,'Review native');const resubmitted=await call(f,'request',requestArgs());assert.equal(resubmitted.data.participacao.id,first.data.participacao.id)
  assert.equal(resubmitted.data.participacao.status,'pendente');assert.equal(resubmitted.data.participacao.motivo_rejeicao,null);assert.equal((await state(f)).parts.length,1)
})
await test('Rejected request may still be manually approved with its fresh snapshot',async()=>{const f=await fixture(),p=await insert(f,'rejeitado');const out=await call(f,'approve',editArgs(p,{slot_id:f.slots[0]}));assert.equal(out.data.participacao.status,'ativo');await invariant(f)})
await test('Active line plus legacy pending row is refused instead of returning a misleading pending success',async()=>{
  const f=await fixture();await insert(f,'pendente');await insert(f,'ativo',f.slots[0]);return refuse(f,'request',requestArgs(),{},/já está inscrita/)
})
await test('Remove clears the complete tuple and its owned mirror; repeat key replays after removal',async()=>{
  const f=await fixture(),p=await insert(f,'ativo',f.slots[0]),args=editArgs(p),request=id(++key),first=await call(f,'remove',args,{request}),before=await state(f),replay=await call(f,'remove',args,{request})
  assert.equal(first.data.participacao.status,'removido');assert.equal(before.slots[0].status,'livre');assert.deepEqual(replay.data,{...first.data,repetida:true});assert.deepEqual(await state(f),before)
})
await test('Removed enrollment can rejoin with a different participation ID and preserved history',async()=>{
  const f=await fixture(),first=await call(f,'add',addArgs(f));await call(f,'remove',editArgs(first.data.participacao));const second=await call(f,'add',addArgs(f))
  assert.notEqual(first.data.participacao.id,second.data.participacao.id);assert.equal((await state(f)).parts.length,2);await invariant(f)
})
await test('Admin can remove an inactive team and a locationless active enrollment',async()=>{
  const f=await fixture(),p=await insert(f,'ativo');await sql(`update public.equipes set status='inativo' where id='${id(100)}';`)
  try{await call(f,'remove',editArgs(p));await invariant(f)}finally{await sql(`update public.equipes set status='ativo' where id='${id(100)}';`)}
})
await test('Own-only seller removal refuses another actor provenance',async()=>{const f=await fixture(),p=await insert(f,'ativo',f.slots[0]);await seller(f);return refuse(f,'remove',editArgs(p),{actor:11},/só pode remover/)})
await test('Own-only seller can remove its own direct enrollment',async()=>{const f=await fixture();await seller(f);const added=await call(f,'add',addArgs(f),{actor:11});await call(f,'remove',editArgs(added.data.participacao),{actor:11});await invariant(f)})
await test('Full seller removal explicitly allows another actor enrollment',async()=>{const f=await fixture(),p=await insert(f,'ativo',f.slots[0]);await seller(f,{remover_equipes:true});await call(f,'remove',editArgs(p),{actor:11});await invariant(f)})
for(const value of ['true','false',1,[],{}])await test('Seller removal JSON '+JSON.stringify(value)+' is not a boolean grant',async()=>{const f=await fixture(),p=await insert(f,'ativo',f.slots[0],11);await seller(f,{remover_equipes:value,remover_proprias_equipes:value});return refuse(f,'remove',editArgs(p),{actor:11},/Sem permissão/)})
await test('Workspace permission enables removal; readonly workspace still takes precedence over seller',async()=>{
  const f=await fixture(),p=await insert(f,'ativo',f.slots[0]);await workspace()
  await sql(`insert into public.managers(id,auth_user_id,username,nome) values('${id(350)}','${id(12)}','fixture-participation-workspace','Fixture Workspace');
    insert into public.campeonato_vendedores(id,campeonato_id,manager_id,token,status,permissoes) values('${id(f.n+76)}','${f.camp}','${id(350)}','fixture-workspace-seller','ativo','{"adicionar_equipes":true}');`)
  try{await call(f,'remove',editArgs(p),{actor:12});await sql(`update public.produtora_membros set pode_operar=false where id='${id(401)}';`);await refuse(f,'add',addArgs(f),{actor:12},/Sem permissão/)}finally{await sql(`delete from public.produtora_membros where id='${id(401)}';`)}
})
await test('Six direct-add sessions with the same key commit once and replay five times',async()=>{
  const f=await fixture(),args=addArgs(f),request=id(++key),first=call(f,'add',args,{request,hold:2});await new Promise(r=>setTimeout(r,300))
  const rest=Array.from({length:5},()=>call(f,'add',args,{request}));await new Promise(r=>setTimeout(r,300))
  const waiters=await json(`select count(*) from pg_stat_activity where datname=${quote(database)} and wait_event_type='Lock';`),out=await Promise.all([first,...rest])
  assert.equal(new Set(out.map(r=>r.pid)).size,6);assert.equal(out.filter(r=>r.data.repetida).length,5);assert.ok(waiters>0);const after=await invariant(f);assert.equal(after.audits.length,1);return {sessions:6,commits:1,replays:5,lockWaiters:waiters}
})
await test('Two teams competing for one slot produce one enrollment and no orphan audit',async()=>{
  const f=await fixture(),out=await Promise.allSettled([call(f,'add',addArgs(f),{hold:1}),call(f,'add',addArgs(f,101))]);assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.match(out.find(r=>r.status==='rejected').reason.message,/Slot ocupado/);const after=await invariant(f);assert.equal(after.audits.length,1)
})
await test('Direct seller quota serializes different teams and groups without shared-row upgrade deadlock',async()=>{
  const f=await fixture();await seller(f,undefined,1)
  const secondGroup=id(f.n+50),secondSlot=id(f.n+60)
  await sql(`update public.campeonato_configuracoes set numero_vagas=5 where campeonato_id='${f.camp}';
    insert into public.campeonato_grupos(id,campeonato_id,nome,fase_id,slots) values('${secondGroup}','${f.camp}','Quota group','${f.phase}',1);
    insert into public.campeonato_slots(id,campeonato_id,grupo_id,fase_id,slot_numero,slot_letra,status) values('${secondSlot}','${f.camp}','${secondGroup}','${f.phase}',1,'B1','livre');`)
  const out=await Promise.allSettled([call(f,'add',addArgs(f),{actor:11,hold:1}),call(f,'add',{...addArgs(f,101),slot_id:secondSlot},{actor:11})])
  assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.match(out.find(r=>r.status==='rejected').reason.message,/Limite de vagas/);await invariant(f)
})
await test('Concurrent approve/reject with one snapshot cannot both commit',async()=>{
  const f=await fixture(),p=await insert(f),out=await Promise.allSettled([call(f,'approve',editArgs(p,{slot_id:f.slots[0]}),{hold:1}),call(f,'reject',editArgs(p,{motivo:'Concurrent'}))])
  assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.match(out.find(r=>r.status==='rejected').reason.message,/participação mudou/);await invariant(f)
})
await test('Liga origin quota and duplicate team are enforced under locks; failed new line rolls back',async()=>{
  const f=await fixture();await liga(f);await call(f,'add',{...addArgs(f),origem_entrada:'vaga_paga'})
  await refuse(f,'add',{...addArgs(f,101,1),origem_entrada:'vaga_paga'},{},/Cota da origem/)
  await liga(f,4);return refuse(f,'add',{...addArgs(f,100,1,'Native Liga rollback'),origem_entrada:'vaga_paga'},{},/já ocupa uma vaga/)
})
await test('Liga seller quota counts liga origins rather than allowing repeated additions',async()=>{
  const f=await fixture();await liga(f,4);await seller(f,undefined,1);await call(f,'add',{...addArgs(f),origem_entrada:'vaga_paga'},{actor:11})
  return refuse(f,'add',{...addArgs(f,101,1),origem_entrada:'vaga_paga'},{actor:11},/Limite de vagas/)
})
await test('Approval in Liga requires an explicit planned origin',async()=>{const f=await fixture(),p=await insert(f);await liga(f);await refuse(f,'approve',editArgs(p,{slot_id:f.slots[0]}),{},/Origem da Liga/);await call(f,'approve',editArgs(p,{slot_id:f.slots[0],origem_entrada:'vaga_paga'}));await invariant(f)})
for(const action of ['request','add','approve','reject','remove'])for(const table of ['participacao_operacoes','participacao_recibos'])await test(action+' rolls back participation/line/mirror/agenda if '+table+' fails',async()=>{
  const f=await fixture();let args=action==='request'?requestArgs():addArgs(f,100,0,'Rollback '+f.n)
  if(['approve','reject','remove'].includes(action)){const p=await insert(f,action==='remove'?'ativo':'pendente',action==='remove'?f.slots[0]:null);args=editArgs(p,{slot_id:f.slots[1],motivo:'Rollback'})}
  await sql(`create function public.fixture_fail_participation() returns trigger language plpgsql as $$begin raise exception 'fixture participation failure';end$$;
    create trigger zz_fixture_participation before insert on public.${table} for each row execute function public.fixture_fail_participation();`)
  try{return await refuse(f,action,args,{},/fixture participation failure/)}finally{await sql(`drop trigger zz_fixture_participation on public.${table};drop function public.fixture_fail_participation();`)}
})
await test('Request deadline crossing the receipt trigger rolls back everything',async()=>{
  const f=await fixture();await sql(`create function public.fixture_delay_participation() returns trigger language plpgsql as $$begin perform pg_sleep(0.6);return new;end$$;
    create trigger zz_fixture_participation before insert on public.participacao_recibos for each row execute function public.fixture_delay_participation();`)
  try{return await refuse(f,'request',requestArgs(),{prefix:`update public.campeonato_configuracoes set data_limite_inscricao=clock_timestamp()+interval '0.3 seconds' where campeonato_id='${f.camp}';`},/fechado ou indisponível/)}finally{await sql(`drop trigger zz_fixture_participation on public.participacao_recibos;drop function public.fixture_delay_participation();`)}
})
await test('An audit trigger closing enrollment in the same transaction is caught and rolled back',async()=>{
  const f=await fixture();await sql(`create function public.fixture_close_participation() returns trigger language plpgsql as $$begin update public.campeonato_configuracoes set aceita_novas_inscricoes_equipes=false where campeonato_id=new.campeonato_id;return new;end$$;
    create trigger zz_fixture_participation before insert on public.participacao_operacoes for each row execute function public.fixture_close_participation();`)
  try{return await refuse(f,'request',requestArgs(),{},/fechado ou indisponível/)}finally{await sql(`drop trigger zz_fixture_participation on public.participacao_operacoes;drop function public.fixture_close_participation();`)}
})
await test('An audit trigger unpublishing the championship prevents a pending request commit',async()=>{
  const f=await fixture();await sql(`create function public.fixture_unpublish_participation() returns trigger language plpgsql as $$begin update public.campeonatos set aprovacao_status='pendente' where id=new.campeonato_id;return new;end$$;
    create trigger zz_fixture_participation before insert on public.participacao_operacoes for each row execute function public.fixture_unpublish_participation();`)
  try{await refuse(f,'request',requestArgs(),{},/fechado ou indisponível/);assert.equal(await sql(`select aprovacao_status from public.campeonatos where id='${f.camp}';`),'aprovado')}finally{await sql(`drop trigger zz_fixture_participation on public.participacao_operacoes;drop function public.fixture_unpublish_participation();`)}
})
await test('An audit trigger changing the committed participant is refused instead of returning an old snapshot',async()=>{
  const f=await fixture();await sql(`create function public.fixture_change_participation() returns trigger language plpgsql as $$begin update public.campeonato_equipes set nome_exibicao='Changed by fixture' where id=new.participacao_id;return new;end$$;
    create trigger zz_fixture_participation before insert on public.participacao_operacoes for each row execute function public.fixture_change_participation();`)
  try{return await refuse(f,'add',addArgs(f),{},/mudou durante a confirmação/)}finally{await sql(`drop trigger zz_fixture_participation on public.participacao_operacoes;drop function public.fixture_change_participation();`)}
})
await test('Workspace revocation prevents replay of a committed result',async()=>{
  const f=await fixture(),args=addArgs(f),request=id(++key);await workspace()
  try{await call(f,'add',args,{actor:12,request});await sql(`update public.produtora_membros set pode_operar=false where id='${id(401)}';`);return await refuse(f,'add',args,{actor:12,request},/Sem permissão/)}finally{await sql(`delete from public.produtora_membros where id='${id(401)}';`)}
})
await test('Team ownership revocation prevents replay of a pending request',async()=>{
  const f=await fixture(),args=requestArgs(),request=id(++key);await call(f,'request',args,{request})
  await sql(`update public.equipes set auth_user_id='${id(12)}',dono_auth_user_id='${id(12)}' where id='${id(100)}';`)
  try{return await refuse(f,'request',args,{request},/não pertence/)}finally{await sql(`update public.equipes set auth_user_id='${id(1)}',dono_auth_user_id='${id(1)}' where id='${id(100)}';`)}
})
await test('Anonymous/authenticated cannot execute wrappers or access audits; service cannot write receipt/audit directly',async()=>{
  const privileges=await json(`select jsonb_build_object('anon_exec',has_function_privilege('anon','public.fn_gravar_participacao_atomica(uuid,uuid,uuid,text,jsonb)','EXECUTE'),
    'auth_exec',has_function_privilege('authenticated','public.fn_gravar_participacao_atomica(uuid,uuid,uuid,text,jsonb)','EXECUTE'),
    'anon_select',has_table_privilege('anon','public.participacao_operacoes','SELECT'),
    'auth_select',has_table_privilege('authenticated','public.participacao_recibos','SELECT'),
    'service_write',has_table_privilege('service_role','public.participacao_recibos','INSERT,UPDATE,DELETE'),
    'service_audit_write',has_table_privilege('service_role','public.participacao_operacoes','INSERT,UPDATE,DELETE'));`)
  assert.ok(Object.values(privileges).every(v=>v===false));return {privileges}
})
await test('Liga schema guard refuses an unknown constraint definition without modifying data or schema',async()=>{
  // The candidate has already been applied. Reapplying must reject this unreviewed new state.
  const before=await json(`select jsonb_build_object('definition',pg_get_constraintdef(oid),'validated',convalidated) from pg_constraint where conrelid='public.campeonato_equipes'::regclass and conname='campeonato_equipes_origem_entrada_check';`)
  await reject(runFile('docs/sql/20261011_liga_schema_candidate.sql'),/Constraint de origem diferente/)
  const after=await json(`select jsonb_build_object('definition',pg_get_constraintdef(oid),'validated',convalidated) from pg_constraint where conrelid='public.campeonato_equipes'::regclass and conname='campeonato_equipes_origem_entrada_check';`)
  assert.deepEqual(after,before);return {guardedRefusal:true}
})
await test('Liga schema keeps invalid origins and nonarray configuration prohibited',async()=>{
  const f=await fixture();await reject(sql(`insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,status,origem_entrada)
    values('${f.camp}','${id(100)}','${id(200)}','pendente','unexpected_origin');`),/origem_entrada_check/)
  await reject(sql(`update public.campeonato_configuracoes set liga_divisoes='{}' where campeonato_id='${f.camp}';`),/liga_divisoes_array/)
})
const output={database,scope:'Local catalog reconstruction and synthetic Auth/roles; no production connection/DDL/data. Not staging/PostgREST/real network loss/device certification.',
  candidateSha256:createHash('sha256').update(fs.readFileSync('docs/sql/20261011_participation_write_candidate.sql')).digest('hex'),
  compiledFunctions:await json(`select jsonb_agg(jsonb_build_object('name',proname,'definition_md5',md5(pg_get_functiondef(oid)))) from pg_proc where proname in('dz_participation_access','fn_gravar_participacao_atomica');`),
  passed:results.filter(v=>v.passed).length,failed:results.filter(v=>!v.passed).length,results}
fs.writeFileSync(directory+'/native-participation.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({passed:output.passed,failed:output.failed}));if(output.failed)process.exitCode=1
