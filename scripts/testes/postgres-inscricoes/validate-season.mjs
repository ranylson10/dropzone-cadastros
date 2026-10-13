import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {sql,directory} from './docker-lab.mjs'
import {id,quote,service,seed,championship} from './fixtures.mjs'
if(directory!=='relatorios-testes/season-transacao-2026-10-12'||!/^dropzone_validation_season_[a-z0-9_]+$/.test(process.env.DROPZONE_FIXTURE_DB||''))throw Error('Explicit synthetic season database/evidence required')
let next=Number(process.argv[2]||8500000),key=next+1000000
if(!Number.isSafeInteger(next)||next<8500000||next>9900000000)throw Error('Safe synthetic fixture namespace required')
const results=[],json=async text=>JSON.parse(await sql(text)),test=async(name,body)=>{try{results.push({name,passed:true,...await body()});console.log('PASS '+name)}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message)}}
const division=(type='mantida',quantity='2')=>({id:'d1',nome:'Divisão Á',codigo:'A',equipes:'4',entradas:[{id:'entry',tipo:type,quantidade:quantity,origem_agrupamento_id:type==='mantida'?'':'d1'}]})
async function fixture(){
 next+=1000;const prior=await championship(next,4),current=await championship(next+100,4),f={n:next,prior,current,franchise:id(next+200),sourceEdition:id(next+201),targetEdition:id(next+202),game:id(next+203),parts:[0,1,2].map(n=>id(next+300+n))}
 const plan=quote(JSON.stringify([division()])),sourcePlan=quote(JSON.stringify([{...division(),entradas:[]}]))
 await sql(`set request.jwt.claim.role='service_role';
  update public.campeonatos set tipo='liga' where id in('${prior.camp}','${current.camp}');
  update public.campeonato_grupos set nome='Divisão Á' where id in('${prior.group}','${current.group}');
  update public.campeonato_configuracoes set liga_divisoes=${sourcePlan}::jsonb,liga_usa_divisoes=true where campeonato_id='${prior.camp}';
  update public.campeonato_configuracoes set liga_divisoes=${plan}::jsonb,liga_usa_divisoes=true where campeonato_id='${current.camp}';
  insert into public.campeonato_franquias(id,nome,criado_por) values('${f.franchise}','Synthetic franchise','${id(1)}');
  insert into public.campeonato_edicoes(id,franquia_id,campeonato_id,numero_edicao,temporada) values('${f.sourceEdition}','${f.franchise}','${prior.camp}',1,'Previous'),('${f.targetEdition}','${f.franchise}','${current.camp}',2,'Current');
  ${f.parts.map((part,n)=>`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id,grupo_id,status,criado_por,origem_entrada)
   values('${part}','${prior.camp}','${id(100+n)}','${id(200+n)}','${prior.slots[n]}','${prior.group}','ativo','${id(1)}','manual');`).join('\n')}
  insert into public.campeonato_jogos(id,campeonato_id,fase_id,nome,numero_partidas) values('${f.game}','${prior.camp}','${prior.phase}','Synthetic game',1);`)
 const match=await sql(`select id from public.campeonato_partidas where jogo_id='${f.game}' and numero_partida=1;`)
 await sql(f.parts.map((part,n)=>`insert into public.campeonato_resultados_equipes(campeonato_id,fase_id,grupo_id,jogo_id,partida_id,campeonato_equipe_id,equipe_id,line_id,posicao,abates)
  values('${prior.camp}','${prior.phase}','${prior.group}','${f.game}','${match}','${part}','${id(100+n)}','${id(200+n)}',${n+1},${3-n});`).join('\n'))
 return f
}
async function call(f,action,expected=null,{request=action==='preview'?null:id(++key),actor=1,hold=0,prefix=''}={}){
 const raw=await sql(`${service}begin;${prefix}select jsonb_build_object('pid',pg_backend_pid(),'data',public.fn_operar_liga_season_atomica('${id(actor)}',${request?quote(request):'null'},'${f.current.camp}',${quote(action)},${expected?quote(JSON.stringify(expected))+'::jsonb':'null'}));${hold?`select pg_sleep(${hold});`:''}commit;`)
 return JSON.parse(raw.split('\n')[0])
}
const preview=async f=>(await call(f,'preview')).data.preview,apply=(f,p,options)=>call(f,'apply',p.fence,options)
const state=f=>json(`select jsonb_build_object('participants',(select jsonb_agg(to_jsonb(x) order by id) from public.campeonato_equipes x where campeonato_id in('${f.current.camp}','${f.prior.camp}')),
 'slots',(select jsonb_agg(to_jsonb(x) order by id) from public.campeonato_slots x where campeonato_id in('${f.current.camp}','${f.prior.camp}')),
 'results',(select jsonb_agg(to_jsonb(x) order by id) from public.campeonato_resultados_equipes x where campeonato_id='${f.prior.camp}'),
 'receipts',(select jsonb_agg(to_jsonb(x) order by actor_id,request_id) from public.liga_season_recibos x),
 'children',(select jsonb_agg(to_jsonb(x) order by actor_id,request_id) from public.participacao_recibos x),
 'audit',(select jsonb_agg(to_jsonb(x) order by actor_id,request_id) from public.participacao_operacoes x),
 'realtime',(select jsonb_agg(to_jsonb(x)) from realtime.fixture_events x));`)
async function unchanged(f,body){const before=await state(f);await assert.rejects(body);assert.deepEqual(await state(f),before);return{fullRollback:true}}
if(Number(await sql('select count(*) from auth.users;'))===0)await seed()
await test('preview is authoritative/scoped and writes no business or receipt rows',async()=>{const f=await fixture(),before=await state(f),p=await preview(f);assert.equal(p.pending.length,2);assert.deepEqual(p.pending.map(x=>x.equipe_id),[id(100),id(101)]);assert.deepEqual(await state(f),before);return{source:f.prior.camp,target:f.current.camp}})
if(!results[0].passed){fs.writeFileSync(directory+'/native-first-error.json',JSON.stringify(results,null,2));throw Error('Initial fixture/preview must pass')}
await test('all selected participants/mirrors/audits/receipts commit together',async()=>{const f=await fixture(),p=await preview(f),r=(await apply(f,p)).data;assert.equal(r.aplicadas,2);const s=await state(f),parts=s.participants.filter(row=>row.campeonato_id===f.current.camp);assert.equal(parts.length,2);assert.ok(parts.every(row=>row.status==='ativo'&&row.origem_entrada==='liga_mantida'));assert.equal(s.slots.filter(row=>row.campeonato_id===f.current.camp&&row.status==='ocupado').length,2)})
await test('original master UUID replays after target is occupied',async()=>{const f=await fixture(),p=await preview(f),request=id(++key);await apply(f,p,{request});const before=await state(f),again=(await apply(f,p,{request})).data;assert.equal(again.repetida,true);assert.deepEqual(await state(f),before)})
await test('changed intent with same master UUID refuses without effects',async()=>{const f=await fixture(),p=await preview(f),request=id(++key);await apply(f,p,{request});return unchanged(f,()=>apply(f,{...p,fence:{...p.fence,extra:true}},{request}))})
for(const mutation of ['ranking','plan','group','slot','pending','edition'])await test('stale '+mutation+' snapshot refuses before additions',async()=>{const f=await fixture(),p=await preview(f)
 const statements={ranking:`update public.campeonato_resultados_equipes set abates=99 where campeonato_equipe_id='${f.parts[2]}';`,plan:`update public.campeonato_configuracoes set liga_divisoes=jsonb_set(liga_divisoes,'{0,entradas,0,quantidade}','"1"') where campeonato_id='${f.current.camp}';`,group:`update public.campeonato_grupos set nome='Renamed' where id='${f.current.group}';`,slot:`insert into public.campeonato_grupo_escolha_bloqueios(campeonato_id,fase_id,grupo_id,slot_id,ativo,criado_por) values('${f.current.camp}','${f.current.phase}',null,'${f.current.slots[0]}',true,'${id(1)}');`,pending:`insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,status,origem_entrada,criado_por) values('${f.current.camp}','${id(102)}','${id(202)}','pendente','inscricao','${id(3)}');`,edition:`update public.campeonato_edicoes set titulo_publico='New title' where id='${f.sourceEdition}';`}
 await sql(statements[mutation]);return unchanged(f,()=>apply(f,p))
})
await test('blocked and occupied-status slots with empty pointers are never selected',async()=>{const f=await fixture();await sql(`insert into public.campeonato_grupo_escolha_bloqueios(campeonato_id,fase_id,grupo_id,slot_id,ativo,criado_por) values('${f.current.camp}','${f.current.phase}',null,'${f.current.slots[0]}',true,'${id(1)}');update public.campeonato_slots set status='ocupado' where id='${f.current.slots[1]}';`);const p=await preview(f);assert.deepEqual(p.pending.map(x=>x.slot_id),f.current.slots.slice(2));assert.equal((await apply(f,p)).data.aplicadas,2)})
await test('any reserved physical slot refuses automatic season fill',async()=>{const f=await fixture();await sql(`update public.campeonato_slots set status='reservado' where id='${f.current.slots[3]}';`);return unchanged(f,()=>preview(f))})
await test('duplicate target group names refuse instead of picking first',async()=>{const f=await fixture();await sql(`insert into public.campeonato_fases(id,campeonato_id,nome) values('${id(f.n+450)}','${f.current.camp}','Second fixture');insert into public.campeonato_grupos(campeonato_id,fase_id,nome,slots) values('${f.current.camp}','${id(f.n+450)}','DIVISÃO Á',1);`);return unchanged(f,()=>preview(f))})
await test('previous championship permission is required before private preview',async()=>{const f=await fixture();await sql(`insert into public.produtoras(id,auth_user_id,username,nome) values('${id(f.n+400)}','${id(2)}','foreign-${f.n}','Foreign fixture') on conflict(auth_user_id) do nothing;update public.campeonatos set criado_por='${id(2)}',produtora_id=(select id from public.produtoras where auth_user_id='${id(2)}') where id='${f.prior.camp}';`);return unchanged(f,()=>preview(f))})
for(const role of ['anon','authenticated'])await test(role+' cannot execute RPC/read or write season receipts',async()=>{const f=await fixture();await assert.rejects(()=>sql(`set role ${role};select public.fn_operar_liga_season_atomica('${id(1)}',null,'${f.current.camp}','preview');`));await assert.rejects(()=>sql(`set role ${role};select * from public.liga_season_recibos;`))})
await test('service cannot call internal plan or mutate receipt directly',async()=>{await assert.rejects(()=>sql(`${service}select public.dz_season_plan('${id(1)}','${id(2)}');`));await assert.rejects(()=>sql(`${service}delete from public.liga_season_recibos;`))})
for(const table of ['campeonato_equipes','campeonato_slots','participacao_operacoes','participacao_recibos','liga_season_recibos'])await test('late '+table+' failure rolls back complete batch including first addition',async()=>{const f=await fixture(),p=await preview(f)
 const event=table==='campeonato_slots'?'update':'insert',predicate=table==='campeonato_equipes'?`NEW.campeonato_id='${f.current.camp}' and NEW.line_id='${id(201)}'`:table==='campeonato_slots'?`NEW.campeonato_id='${f.current.camp}' and NEW.line_id='${id(201)}'`:table==='liga_season_recibos'?'true':`NEW.resultado->'participacao'->>'line_id'='${id(201)}'`
 const condition=table==='participacao_operacoes'?`NEW.campeonato_id='${f.current.camp}' and NEW.posterior->>'line_id'='${id(201)}'`:predicate
 await sql(`create function public.fixture_season_fail() returns trigger language plpgsql as $$begin if ${condition} then raise exception 'Synthetic late failure';end if;return NEW;end;$$;create trigger fixture_season_fail after ${event} on public.${table} for each row execute function public.fixture_season_fail();`)
 try{return await unchanged(f,()=>apply(f,p))}finally{await sql(`drop trigger fixture_season_fail on public.${table};drop function public.fixture_season_fail();`)}
})
await test('six concurrent sessions / same UUID: one whole batch and five replays',async()=>{const f=await fixture(),p=await preview(f),request=id(++key),runs=await Promise.all(Array.from({length:6},()=>apply(f,p,{request,hold:0.1})));assert.equal(runs.filter(x=>x.data.repetida).length,5);assert.equal(new Set(runs.map(x=>x.pid)).size,6);assert.equal((await state(f)).participants.filter(x=>x.campeonato_id===f.current.camp).length,2)})
await test('two different UUIDs from same preview: one batch / one refusal',async()=>{const f=await fixture(),p=await preview(f),runs=await Promise.allSettled([apply(f,p,{hold:0.2}),apply(f,p)]);assert.equal(runs.filter(x=>x.status==='fulfilled').length,1);assert.equal((await state(f)).participants.filter(x=>x.campeonato_id===f.current.camp).length,2)})

await test('incomplete source quota refuses the whole batch at the server',async()=>{const f=await fixture();await sql("update public.campeonato_configuracoes set liga_divisoes=jsonb_set(liga_divisoes,'{0,entradas,0,quantidade}','\"4\"') where campeonato_id='"+f.current.camp+"';");const p=await preview(f);assert.equal(p.pending.length,3);return unchanged(f,()=>apply(f,p))})
await test('receipt replay still requires previous championship management',async()=>{const f=await fixture(),p=await preview(f),request=id(++key);await apply(f,p,{request});await sql("update public.campeonatos set criado_por='"+id(2)+"',produtora_id=(select id from public.produtoras where auth_user_id='"+id(2)+"') where id='"+f.prior.camp+"';");return unchanged(f,()=>apply(f,p,{request}))})
await test('precreated deterministic child receipt is refused instead of reused',async()=>{const f=await fixture(),p=await preview(f),request=id(++key);await sql("insert into public.participacao_recibos(actor_id,request_id,fingerprint,resultado) values('"+id(1)+"',md5('season:"+id(1)+":"+request+":"+id(200)+"')::uuid,'fixture','{}');");return unchanged(f,()=>apply(f,p,{request}))})
for(const target of ['participant','source-result','block'])await test('post-receipt '+target+' mutation rolls back every child',async()=>{const f=await fixture(),p=await preview(f)
 const mutation=target==='participant'?"update public.campeonato_equipes set nome_line='Synthetic late change' where campeonato_id='"+f.current.camp+"';":target==='source-result'?"update public.campeonato_resultados_equipes set abates=77 where campeonato_equipe_id='"+f.parts[0]+"';":"insert into public.campeonato_grupo_escolha_bloqueios(campeonato_id,fase_id,slot_id,ativo) values('"+f.current.camp+"','"+f.current.phase+"','"+f.current.slots[0]+"',true);"
 await sql("create function public.fixture_season_post() returns trigger language plpgsql as $post$begin "+mutation+"return NEW;end;$post$;create trigger fixture_season_post after insert on public.liga_season_recibos for each row execute function public.fixture_season_post();")
 try{return await unchanged(f,()=>apply(f,p))}finally{await sql('drop trigger fixture_season_post on public.liga_season_recibos;drop function public.fixture_season_post();')}
})
await test('SQL strict quantities match JavaScript accepted and rejected fixtures',async()=>{for(const value of [0,1,'001',' 2 ',9007199254740991])assert.equal(Number(await sql('select public.dz_season_quantity('+quote(JSON.stringify(value))+'::jsonb);')),Number(value));for(const value of [-1,1.5,'NaN','Infinity','1e2',true,null,[],{},'','9007199254740992'])await assert.rejects(()=>sql('select public.dz_season_quantity('+quote(JSON.stringify(value))+'::jsonb);'))})
for(const kind of ['result','slot','block','edition'])await test('ordinary '+kind+' writer is observed waiting for preview transaction',async()=>{const f=await fixture(),tag='fixture-season-'+f.n
 const holder=call(f,'preview',null,{hold:3,prefix:"set application_name='"+tag+"-holder';"})
 const wait=async(predicate)=>{for(let n=0;n<20;n++){const rows=await json("select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'wait',wait_event,'type',wait_event_type)),'[]') from pg_stat_activity where application_name='"+tag+"-"+predicate.name+"';");if(rows.some(predicate.test))return rows;await new Promise(resolve=>setTimeout(resolve,50))}throw Error('Writer/holder wait was not observed')}
 await wait({name:'holder',test:row=>row.wait==='PgSleep'})
 const update=kind==='result'?"update public.campeonato_resultados_equipes set abates=abates+1 where campeonato_equipe_id='"+f.parts[0]+"';":kind==='slot'?"update public.campeonato_slots set slot_letra='W' where id='"+f.current.slots[3]+"';":kind==='block'?"insert into public.campeonato_grupo_escolha_bloqueios(campeonato_id,fase_id,slot_id,ativo) values('"+f.current.camp+"','"+f.current.phase+"','"+f.current.slots[3]+"',true);":"update public.campeonato_edicoes set titulo_publico='Writer title' where id='"+f.targetEdition+"';"
 const writer=sql("set application_name='"+tag+"-writer';"+update)
 try{const observed=await wait({name:'writer',test:row=>row.type==='Lock'&&row.wait==='advisory'});await Promise.all([holder,writer]);return{observed}}catch(error){await Promise.allSettled([holder,writer]);throw error}
})

const file='docs/sql/20261012_league_season_candidate.sql',summary={generatedAt:new Date().toISOString(),passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results,candidate:{file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')},scope:'Native local PG17.6 with current saved public catalog/exact views and verified historical functions; synthetic Auth/Realtime/infra, not production data or Supabase staging.'}
fs.writeFileSync(directory+'/native-season.json',JSON.stringify(summary,null,2)+'\n');console.log(`Native season: ${summary.passed} passed / ${summary.failed} failed.`);if(summary.failed)process.exitCode=1
