import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sql,directory,runFile} from './docker-lab.mjs'
import {id,quote,service,championship} from './fixtures.mjs'
const base=Number(process.argv[2]||2000)
let next=base,request=base+50000
const results=[]
const test=async(name,body)=>{try{const evidence=await body();results.push({name,passed:true,...evidence});console.log('PASS '+name)}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message)}}
const fixture=async(slots=4,limit=slots)=>{next+=100;return championship(next,slots,limit)}
const json=async(text)=>JSON.parse(await sql(text))
const accept=(f,{kind='group',actor=1,team=100,line=200,name=null,slot=f.slots[0],key=id(++request),index=null,ref=null,prefix='',delay=0}={})=>{
  const text=`${service}${prefix}begin;select pg_backend_pid();select public.fn_inscrever_por_convite_atomico('${id(actor)}','${key}',${quote(kind)},${quote(kind==='team'?f.teamToken:f.groupToken)},'${id(team)}',${line==null?'null':quote(id(line))},${name==null?'null':quote(name)},${slot==null?'null':quote(slot)},${index==null?'null':index},${ref==null?'null':quote(ref)});${delay?`select pg_sleep(${delay});`:''}commit;`
  return sql(text).then(output=>{const lines=output.split('\n').filter(Boolean);return {pid:Number(lines[0]),result:JSON.parse(lines[1])}})
}
const rejected=async(promise,pattern)=>{let error;try{await promise}catch(cause){error=cause.message}assert.ok(error,'Expected failure');if(pattern)assert.match(error,pattern);return error}
const state=async(f,key)=>json(`select jsonb_build_object(
  'lines',(select jsonb_agg(to_jsonb(t) order by id) from public.equipe_lines t),
  'parts',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_equipes t where campeonato_id='${f.camp}'),
  'slots',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_slots t where campeonato_id='${f.camp}'),
  'tokens',(select jsonb_agg(to_jsonb(t) order by id) from public.tokens t where campeonato_id='${f.camp}'),
  'links',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_links t where campeonato_id='${f.camp}'),
  'receipts',(select jsonb_agg(to_jsonb(t) order by actor_id,request_id) from public.inscricao_recibos t where request_id='${key}'));`)
const mirror=id(900),camp=id(1000),slotA=id(1010),slotB=id(1011)
const partInsert=`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id) values('${mirror}','${camp}','${id(100)}','${id(200)}','${slotA}');`
await sql(`create or replace function public.audit_fixture_failure() returns trigger language plpgsql as $$
 begin
   if tg_table_name='campeonato_equipes' and current_setting('audit_fixture.delay',true)='yes' then perform pg_sleep(0.3);end if;
   if tg_table_name='campeonato_equipes' and current_setting('audit_fixture.delay',true)='expiry' then perform pg_sleep(1.1);end if;
   if current_setting('audit_fixture.fail',true)=tg_table_name and
     (tg_table_name<>'campeonato_links' or coalesce((to_jsonb(new)->'metadata'->>'usos')::numeric,0)>coalesce((to_jsonb(old)->'metadata'->>'usos')::numeric,0)) then
     raise exception 'Injected audit fixture failure at %',tg_table_name;
   end if;
   return new;
 end;$$;
 drop trigger if exists zzz_audit_fixture_fail on public.equipe_lines;
 create trigger zzz_audit_fixture_fail after insert on public.equipe_lines for each row execute function public.audit_fixture_failure();
 drop trigger if exists zzz_audit_fixture_fail on public.campeonato_equipes;
 create trigger zzz_audit_fixture_fail after insert on public.campeonato_equipes for each row execute function public.audit_fixture_failure();
 drop trigger if exists zzz_audit_fixture_fail on public.tokens;
 create trigger zzz_audit_fixture_fail after update on public.tokens for each row execute function public.audit_fixture_failure();
 drop trigger if exists zzz_audit_fixture_fail on public.campeonato_links;
 create trigger zzz_audit_fixture_fail after update on public.campeonato_links for each row execute function public.audit_fixture_failure();
 drop trigger if exists zzz_audit_fixture_fail on public.inscricao_recibos;
 create trigger zzz_audit_fixture_fail after insert on public.inscricao_recibos for each row execute function public.audit_fixture_failure();`)

await test('Mirror: native line transfer preserves participation and updates owner',async()=>{
 const out=await json(`begin;set request.jwt.claim.role='service_role';${partInsert}
 do $$begin perform public.fn_transferir_line_equipe('${id(200)}','${id(100)}','${id(102)}','${id(1)}');end$$;
 select jsonb_build_object('slotTeam',(select equipe_id from public.campeonato_slots where id='${slotA}'),'partTeam',(select equipe_id from public.campeonato_equipes where id='${mirror}'),'lineTeam',(select equipe_id from public.equipe_lines where id='${id(200)}'));rollback;`)
 assert.equal(out.slotTeam,id(102));assert.equal(out.partTeam,id(102));assert.equal(out.lineTeam,id(102));return out
})
await test('Mirror: removal preserves a replacement occupant',async()=>{
 const out=await json(`begin;set request.jwt.claim.role='service_role';${partInsert}
 update public.campeonato_slots set equipe_id='${id(101)}',line_id='${id(201)}',status='ocupado' where id='${slotA}';
 update public.campeonato_equipes set status='removido',slot_id=null,slot_numero=null,grupo_id=null where id='${mirror}';
 select jsonb_build_object('team',equipe_id,'line',line_id,'status',status) from public.campeonato_slots where id='${slotA}';rollback;`)
 assert.equal(out.team,id(101));assert.equal(out.line,id(201));assert.equal(out.status,'ocupado');return out
})
await test('Mirror: movement releases only old mirror and claims new slot',async()=>{
 const out=await json(`begin;set request.jwt.claim.role='service_role';${partInsert}
 update public.campeonato_equipes set slot_id='${slotB}' where id='${mirror}';
 select jsonb_build_object('old',(select status from public.campeonato_slots where id='${slotA}'),'newLine',(select line_id from public.campeonato_slots where id='${slotB}'));rollback;`)
 assert.equal(out.old,'livre');assert.equal(out.newLine,id(200));return out
})
await test('Mirror: failed move rolls back release and participation update',async()=>{
 const out=await json(`begin;set request.jwt.claim.role='service_role';${partInsert}
 update public.campeonato_slots set equipe_id='${id(101)}',line_id='${id(201)}',status='ocupado' where id='${slotB}';
 do $$begin begin update public.campeonato_equipes set slot_id='${slotB}' where id='${mirror}';raise exception 'Expected conflict';exception when unique_violation then null;end;end$$;
 select jsonb_build_object('partSlot',(select slot_id from public.campeonato_equipes where id='${mirror}'),'oldLine',(select line_id from public.campeonato_slots where id='${slotA}'),'newLine',(select line_id from public.campeonato_slots where id='${slotB}'));rollback;`)
 assert.equal(out.partSlot,slotA);assert.equal(out.oldLine,id(200));assert.equal(out.newLine,id(201));return out
})
await test('Mirror: foreign championship and foreign team line rejected',async()=>{
 const f=await fixture();await rejected(sql(`begin;set request.jwt.claim.role='service_role';insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,slot_id)values('${f.camp}','${id(100)}','${id(200)}','${slotA}');commit;`),/Conflito no slot_id/)
 await rejected(sql(`begin;set request.jwt.claim.role='service_role';insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,slot_id)values('${f.camp}','${id(100)}','${id(201)}','${f.slots[0]}');commit;`),/não pertence/)
 assert.equal(Number(await sql(`select count(*) from public.campeonato_equipes where campeonato_id='${f.camp}';`)),0)
})
await test('Index: native removed-line reinsertion fails before candidate',async()=>{
 if(!await sql("select to_regclass('public.campeonato_equipes_campeonato_line_unique');")) await sql("create unique index campeonato_equipes_campeonato_line_unique on public.campeonato_equipes(campeonato_id,line_id) where line_id is not null;")
 const f=await fixture();await sql(`${service}insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,status)values('${f.camp}','${id(100)}','${id(200)}','removido');`)
 await rejected(accept(f),/campeonato_equipes_campeonato_line_unique/)
})
await test('Index: guarded replacement preserves active/pending protections',async()=>{
 await runFile('docs/sql/20261011_rejoin_index_candidate.sql')
 const out=await json(`select jsonb_build_object('global',to_regclass('public.campeonato_equipes_campeonato_line_unique'),'active',to_regclass('public.campeonato_equipes_line_unique'),'pending',to_regclass('public.campeonato_equipes_line_pendente_unique'),'slot',to_regclass('public.campeonato_equipes_slot_ativo_unique'));`)
 assert.equal(out.global,null);assert.ok(out.active&&out.pending&&out.slot);return out
})
await test('Atomic: removed participation can rejoin and remove/rejoin again',async()=>{
 const f=await fixture();await sql(`${service}insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,status)values('${f.camp}','${id(100)}','${id(200)}','removido');`)
 const first=await accept(f);await sql(`${service}update public.campeonato_equipes set status='removido',slot_id=null,grupo_id=null,slot_numero=null where id='${first.result.participacao.id}';`)
 const second=await accept(f,{slot:f.slots[1]});assert.notEqual(first.result.participacao.id,second.result.participacao.id)
 assert.equal(Number(await sql(`select count(*) from public.campeonato_equipes where campeonato_id='${f.camp}' and status='ativo';`)),1)
})
await test('Atomic: same request after lost response returns identical receipt',async()=>{
 const f=await fixture(),key=id(++request);const first=await accept(f,{line:null,name:'Fixture Lost Response',key});const second=await accept(f,{line:null,name:'Fixture Lost Response',key})
 assert.equal(second.result.repetida,true);assert.equal(first.result.participacao.id,second.result.participacao.id);delete second.result.repetida;assert.deepEqual(second.result,first.result)
 const s=await state(f,key);assert.equal(s.parts.length,1);assert.equal(s.receipts.length,1);assert.equal(s.links[0].metadata.usos,1);return {singleReceipt:true}
})
await test('Atomic: reused idempotency key with changed data rejected',async()=>{
 const f=await fixture(),key=id(++request);await accept(f,{key});await rejected(accept(f,{key,slot:f.slots[1]}),/Chave de repetição/)
})
await test('Atomic: private RPC and helpers denied to anon/authenticated',async()=>{
 const f=await fixture();for(const role of ['anon','authenticated']){
 await rejected(sql(`set role ${role};set request.jwt.claim.role='service_role';select public.fn_inscrever_por_convite_atomico('${id(1)}','${id(++request)}','group','${f.groupToken}','${id(100)}','${id(200)}',null,'${f.slots[0]}',null,null);`),/permission denied for function/)
 await rejected(sql(`set role ${role};select * from public.inscricao_recibos;`),/permission denied for table/)
 await rejected(sql(`set role ${role};select public.dz_inscricao_link_meta('{}',null);`),/permission denied for function/)
 } await rejected(sql(`set request.jwt.claim.role='authenticated';select public.fn_inscrever_por_convite_atomico('${id(1)}','${id(++request)}','group','${f.groupToken}','${id(100)}','${id(200)}',null,'${f.slots[0]}',null,null);`),/exclusiva do backend/)
})
await test('Atomic: readonly denied, scaler existing allowed, scaler creation denied',async()=>{
 const f=await fixture();await sql(`${service}update public.manager_equipe set pode_escalar=false where id='${id(301)}';`)
 await rejected(accept(f,{actor:11}),/Sem permissão/)
 await sql(`${service}update public.manager_equipe set pode_escalar=true where id='${id(301)}';`)
 await rejected(accept(f,{actor:11,line:null,name:'Forbidden Staff Create'}),/Sem permissão/)
 assert.equal((await accept(f,{actor:11})).result.ok,true)
})
await test('Atomic: wrong actor/team, foreign line, inactive line and slot scope rejected',async()=>{
 const f=await fixture(),key=id(++request),before=await state(f,key)
 await rejected(accept(f,{actor:2,key}),/Sem permissão/)
 await rejected(accept(f,{line:201,key}),/Line inválida/)
 await rejected(accept(f,{slot:slotA,key}),/Slot ocupado ou fora do grupo/)
 await rejected(accept(f,{line:null,name:'Nova Line',key}),/nome real/)
 assert.deepEqual(await state(f,key),before)
 await sql(`${service}update public.equipe_lines set status='inativo' where id='${id(200)}';`)
 await rejected(accept(f,{key}),/inativa/)
 await sql(`${service}update public.equipe_lines set status='ativo' where id='${id(200)}';`)
})
await test('Atomic: suspended actor and unavailable championship rejected',async()=>{
 const f=await fixture();await sql(`${service}insert into public.sistema_restricoes_conta(id,auth_user_id,tipo,motivo,aplicado_por)values('${id(next+50)}','${id(1)}','suspensao','Fixture','${id(2)}');`)
 await rejected(accept(f),/Conta impedida/)
 await sql(`${service}update public.sistema_restricoes_conta set ativo=false where id='${id(next+50)}';update public.campeonatos set aprovacao_status='pendente' where id='${f.camp}';`)
 await rejected(accept(f),/Campeonato indisponível/)
 await sql(`${service}update public.campeonatos set aprovacao_status='aprovado',status='suspenso' where id='${f.camp}';`)
 await rejected(accept(f),/Campeonato indisponível/)
})
for(const stage of ['equipe_lines','campeonato_equipes','campeonato_links','inscricao_recibos','tokens']){
 await test('Atomic: injected failure at '+stage+' rolls back all rows and closure',async()=>{
  const f=await fixture(1,1),key=id(++request),before=await state(f,key)
  await rejected(accept(f,{kind:stage==='tokens'?'team':'group',line:null,name:'Fixture Rollback '+stage,key,prefix:`set audit_fixture.fail='${stage}';`}),/Injected audit fixture failure/)
  assert.deepEqual(await state(f,key),before);return {rollbackAllRows:true}
 })
}
await test('Atomic: reactivation is reverted after later participation failure',async()=>{
 const f=await fixture(),key=id(++request);await sql(`${service}update public.equipe_lines set status='inativo' where id='${id(200)}';`);const before=await state(f,key)
 await rejected(accept(f,{line:null,name:'Fixture Line 1',key,prefix:"set audit_fixture.fail='campeonato_equipes';"}),/Injected/)
 assert.deepEqual(await state(f,key),before);await sql(`${service}update public.equipe_lines set status='ativo' where id='${id(200)}';`)
})
await test('Atomic: native parallel group limit accepts exactly two of six',async()=>{
 const f=await fixture(6,2)
 const jobs=Array.from({length:6},(_,i)=>accept(f,{actor:i+1,team:100+i,line:200+i,slot:f.slots[i],prefix:"set audit_fixture.delay='yes';"}))
 await new Promise(resolve=>setTimeout(resolve,150))
 const observed=await json(`select jsonb_agg(jsonb_build_object('pid',pid,'state',state,'waitType',wait_event_type,'wait',wait_event)) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and state='active';`)
 const outcomes=await Promise.allSettled(jobs),accepted=outcomes.filter(x=>x.status==='fulfilled'),declined=outcomes.filter(x=>x.status==='rejected')
 assert.equal(accepted.length,2);assert.equal(declined.length,4);assert.notEqual(accepted[0].value.pid,accepted[1].value.pid)
 assert.ok(observed?.length>=2,'Expected overlapping PostgreSQL sessions')
 assert.ok(observed.some(x=>x.waitType==='Lock'),'Expected native lock arbitration')
 const out=await json(`select jsonb_build_object('parts',(select count(*) from public.campeonato_equipes where campeonato_id='${f.camp}'),'usos',(select metadata->'usos' from public.campeonato_links where id='${f.link}'),'history',(select jsonb_array_length(metadata->'entradas') from public.campeonato_links where id='${f.link}'),'active',(select ativo from public.campeonato_links where id='${f.link}'));`)
 assert.deepEqual(out,{parts:2,usos:2,history:2,active:false});return {accepted:2,rejected:4,overlappingSessions:observed}
})
await test('Atomic: two accounts contesting one slot produce one complete enrollment',async()=>{
 const f=await fixture();const out=await Promise.allSettled([accept(f,{prefix:"set audit_fixture.delay='yes';"}),accept(f,{actor:2,team:101,line:201})])
 assert.equal(out.filter(x=>x.status==='fulfilled').length,1);assert.equal(out.filter(x=>x.status==='rejected').length,1)
 assert.equal(Number(await sql(`select count(*) from public.campeonato_equipes where campeonato_id='${f.camp}';`)),1)
 assert.equal(Number(await sql(`select (metadata->>'usos')::int from public.campeonato_links where id='${f.link}';`)),1)
})
await test('Atomic: two slots contesting one team token consume once',async()=>{
 const f=await fixture();const outcomes=await Promise.allSettled([accept(f,{kind:'team',prefix:"set audit_fixture.delay='yes';"}),accept(f,{kind:'team',actor:2,team:101,line:201,slot:f.slots[1]})])
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1)
 const out=await json(`select jsonb_build_object('parts',(select count(*) from public.campeonato_equipes where campeonato_id='${f.camp}'),'used',(select usado from public.tokens where id='${f.token}'),'status',(select status from public.tokens where id='${f.token}'));`)
 assert.deepEqual(out,{parts:1,used:true,status:'usado'});return {accepted:1,rejected:1}
})
await test('Atomic: concurrent same-key retries create one line/participation/receipt',async()=>{
 const f=await fixture(),key=id(++request);const outcomes=await Promise.all([accept(f,{line:null,name:'Fixture Simultaneous Retry',key,prefix:"set audit_fixture.delay='yes';"}),accept(f,{line:null,name:'Fixture Simultaneous Retry',key})])
 assert.equal(outcomes[0].result.participacao.id,outcomes[1].result.participacao.id)
 assert.equal(outcomes.filter(x=>x.result.repetida).length,1)
 assert.equal(Number(await sql(`select count(*) from public.equipe_lines where equipe_id='${id(100)}' and nome='Fixture Simultaneous Retry';`)),1)
})
await test('Atomic: concurrent equal new names with distinct keys do not duplicate line',async()=>{
 const f=await fixture();const out=await Promise.allSettled([accept(f,{line:null,name:'Fixture Equal Name',prefix:"set audit_fixture.delay='yes';"}),accept(f,{line:null,name:'  fixture equal name ',slot:f.slots[1]})])
 assert.equal(out.filter(x=>x.status==='fulfilled').length,1)
 assert.equal(Number(await sql(`select count(*) from public.equipe_lines where equipe_id='${id(100)}' and lower(trim(nome))='fixture equal name';`)),1)
})
await test('Atomic: full-group trigger closes all links and preserves unrelated metadata',async()=>{
 const f=await fixture(1,1);await sql(`${service}insert into public.campeonato_links(campeonato_id,grupo_id,token,tipo,metadata)values('${f.camp}','${f.group}','fixture-secondary-${f.n}','inscricao_equipes_grupo','{"fixture_other":true}');`)
 const out=await accept(f);assert.equal(out.result.link.encerrado,true)
 const links=await json(`select jsonb_agg(jsonb_build_object('active',ativo,'metadata',metadata) order by token) from public.campeonato_links where grupo_id='${f.group}';`)
 assert.equal(links.length,2);assert.ok(links.every(x=>x.active===false));assert.ok(links.some(x=>x.metadata.fixture_other));assert.ok(links.some(x=>x.metadata.fixture_keep))
})
await test('Atomic: token revoked while waiting on group lock is re-read and rejected',async()=>{
 const f=await fixture(),key=id(++request)
 const blocker=sql(`begin;set request.jwt.claim.role='service_role';select 1 from public.campeonato_grupos where id='${f.group}' for update;select pg_sleep(0.4);update public.tokens set status='revogado' where id='${f.token}';commit;`)
 await new Promise(resolve=>setTimeout(resolve,100));const entrant=accept(f,{kind:'team',key,line:null,name:'Fixture Revoked During Wait'})
 const outcomes=await Promise.allSettled([blocker,entrant]);assert.equal(outcomes[0].status,'fulfilled');assert.equal(outcomes[1].status,'rejected');assert.match(outcomes[1].reason.message,/Convite expirado, utilizado ou alterado/)
 assert.equal(Number(await sql(`select count(*) from public.campeonato_equipes where campeonato_id='${f.camp}';`)),0)
 assert.equal(Number(await sql(`select count(*) from public.equipe_lines where nome='Fixture Revoked During Wait';`)),0)
})
await test('Atomic: expiry after participation trigger wait reverts new line and all writes',async()=>{
 const f=await fixture(),key=id(++request);await sql(`${service}update public.tokens set expira_em=clock_timestamp()+interval '0.8 seconds' where id='${f.token}';`)
 const before=await state(f,key);await rejected(accept(f,{kind:'team',line:null,name:'Fixture Expiry',key,prefix:"set audit_fixture.delay='expiry';"}),/expirou durante/)
 assert.deepEqual(await state(f,key),before)
})
await test('Atomic: legacy description, wildcard literal token and reference normalization',async()=>{
 const f=await fixture(),literal='Fixture.*%_Token-'+f.n
 await sql(`${service}update public.campeonato_links set metadata='null'::jsonb,token=${quote(literal)},descricao=${quote('Human\n__dz_meta__:{"limite_vagas":2,"usos":0,"entradas":[],"expected_teams":["Álôé Élite","Other"],"keep_legacy":true}')} where id='${f.link}';`)
 f.groupToken=literal.toLowerCase()
 const out=await accept(f,{line:null,name:'Aloe Elite'});assert.equal(out.result.referencia,'Álôé Élite')
 const meta=await json(`select metadata from public.campeonato_links where id='${f.link}';`);assert.equal(meta.keep_legacy,true);assert.equal(meta.usos,1)
 const before=await state(f,id(++request));f.groupToken='FixtureANYTHINGToken-'+f.n;await rejected(accept(f),/Link inválido/);assert.deepEqual(await state(f,id(request)),before)
})
await test('Atomic: provisional producer may enroll until team claimed; readonly staff takes priority',async()=>{
 const f=await fixture(),team=base+70000,line=base+70001
 await sql(`${service}insert into public.equipes(id,nome,tag)values('${id(team)}','Fixture Historical','FH');insert into public.equipe_lines(id,equipe_id,nome)values('${id(line)}','${id(team)}','Fixture Historical Line');insert into public.tokens(token,tipo,equipe_id,produtora_id)values('fixture-claim-${base}','reivindicacao_equipe_historica','${id(team)}','${id(50)}');`)
 assert.equal((await accept(f,{team,line})).result.ok,true)
 await sql(`${service}update public.equipes set auth_user_id='${id(12)}',dono_auth_user_id='${id(12)}' where id='${id(team)}';`)
 const f2=await fixture();await rejected(accept(f2,{team,line}),/Sem permissão/)
 await sql(`${service}update public.equipes set auth_user_id=null,dono_auth_user_id=null where id='${id(team)}';insert into public.managers(id,auth_user_id,username,nome)values('${id(base+70002)}','${id(1)}','fixture-producer-staff-${base}','Fixture Producer Staff');insert into public.manager_equipe(manager_id,equipe_id,pode_ver)values('${id(base+70002)}','${id(team)}',true);`)
 await rejected(accept(f2,{team,line}),/Sem permissão/)
})
await test('Atomic: closed championship rejects both invitation kinds without writes',async()=>{
 for(const kind of ['team','group']){
  const f=await fixture(),key=id(++request);await sql(`${service}update public.campeonato_configuracoes set aceita_novas_inscricoes_equipes=false where campeonato_id='${f.camp}';`)
  const before=await state(f,key);await rejected(accept(f,{kind,key,line:null,name:'Fixture Closed Championship'}),/Inscrições fechadas/);assert.deepEqual(await state(f,key),before)
 }
})
await test('Atomic: championship deadline rejects both invitation kinds without writes',async()=>{
 for(const kind of ['team','group']){
  const f=await fixture(),key=id(++request);await sql(`${service}update public.campeonato_configuracoes set data_limite_inscricao=clock_timestamp()-interval '1 second' where campeonato_id='${f.camp}';`)
  const before=await state(f,key);await rejected(accept(f,{kind,key}),/prazo encerrado/);assert.deepEqual(await state(f,key),before)
 }
})
await test('Atomic: deadline passing after insertion rolls back both invitation kinds',async()=>{
 for(const kind of ['team','group']){
  const f=await fixture(1,1),key=id(++request);await sql(`${service}update public.campeonato_configuracoes set data_limite_inscricao=clock_timestamp()+interval '0.8 seconds' where campeonato_id='${f.camp}';`)
  const before=await state(f,key);await rejected(accept(f,{kind,key,line:null,name:'Fixture Deadline During Operation '+kind,prefix:"set audit_fixture.delay='expiry';"}),/Prazo de inscrição encerrou durante/);assert.deepEqual(await state(f,key),before)
 }
})
await test('Atomic: administrative closure before configuration lock is re-read',async()=>{
 const f=await fixture(),key=id(++request)
 const blocker=sql(`begin;set request.jwt.claim.role='service_role';select 1 from public.campeonato_configuracoes where campeonato_id='${f.camp}' for update;select pg_sleep(0.4);update public.campeonato_configuracoes set aceita_novas_inscricoes_equipes=false where campeonato_id='${f.camp}';commit;`)
 await new Promise(resolve=>setTimeout(resolve,100));const entrant=accept(f,{key})
 const out=await Promise.allSettled([blocker,entrant]);assert.equal(out[0].status,'fulfilled');assert.equal(out[1].status,'rejected');assert.match(out[1].reason.message,/Inscrições fechadas/)
 assert.equal(Number(await sql(`select count(*) from public.campeonato_equipes where campeonato_id='${f.camp}';`)),0)
})
await test('Atomic: 301 historical entries and large metadata are preserved',async()=>{
 const f=await fixture(302,302),history=Array.from({length:301},(_,i)=>({participacao_id:id(base+100000+i),referencia_lista:'Fixture historical '+i})),padding='fixture-'.repeat(65000)
 await sql(`${service}update public.campeonato_links set metadata=${quote(JSON.stringify({usos:301,limite_vagas:302,entradas:history,fixture_padding:padding,expected_teams:[]}))}::jsonb where id='${f.link}';`)
 const out=await accept(f);assert.equal(out.result.link.usos,302);assert.equal(out.result.link.encerrado,true)
 const meta=await json(`select jsonb_build_object('history',jsonb_array_length(metadata->'entradas'),'paddingLength',length(metadata->>'fixture_padding'),'bytes',octet_length(metadata::text)) from public.campeonato_links where id='${f.link}';`)
 assert.equal(meta.history,302);assert.equal(meta.paddingLength,padding.length);assert.ok(meta.bytes>500000);return {historyBefore:301,historyAfter:302,metadataBytes:meta.bytes,scope:'Functional large metadata case; no load/latency benchmark.'}
})
const output={generatedAt:new Date().toISOString(),native:true,productionWrites:0,productionDdl:0,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results}
fs.writeFileSync(directory+'/native-validation-'+base+'.json',JSON.stringify(output,null,2))
console.log(JSON.stringify({passed:output.passed,failed:output.failed}))
if(output.failed)process.exitCode=1
