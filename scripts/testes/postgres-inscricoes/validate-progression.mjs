import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { sql, directory } from './docker-lab.mjs'
import { id,quote,service,seed,championship } from './fixtures.mjs'
import { fixtureLoader } from '../ts-fixture-loader.mjs'
if(directory!=='relatorios-testes/progressao-transacao-2026-10-12'||!/^dropzone_validation_progression_[a-z0-9_]+$/.test(process.env.DROPZONE_FIXTURE_DB||''))throw Error('Explicit synthetic progression DB/evidence required')
const result=[],json=async text=>JSON.parse(await sql(text)),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
let next=Number(process.argv[2]||5100000),key=next+1000000
if(!Number.isSafeInteger(next)||next<1000000)throw Error('Explicit fixture namespace must be a safe positive integer')
const test=async(name,body)=>{try{result.push({name,passed:true,...await body()});console.log('PASS '+name)}catch(error){result.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message)}}
async function fixture({count=3,capacity=3,end=2,type='promocao'}={}){
 next+=1000;const f=await championship(next,Math.max(4,count)),extra={franchise:id(next+100),edition:id(next+101),source:id(next+102),destination:id(next+103),rule:id(next+104),game:id(next+105),match:id(next+106)}
 Object.assign(f,extra,{parts:Array.from({length:count},(_,n)=>id(next+300+n)),sources:Array.from({length:count},(_,n)=>id(next+200+n)),results:Array.from({length:count},(_,n)=>id(next+400+n))})
 await sql(`set request.jwt.claim.role='service_role';
  insert into public.campeonato_franquias(id,nome,criado_por) values('${f.franchise}','Fixture franchise','${id(1)}');
  insert into public.campeonato_edicoes(id,franquia_id,campeonato_id,numero_edicao) values('${f.edition}','${f.franchise}','${f.camp}',1);
  insert into public.campeonato_etapas(id,edicao_id,nome,ordem,capacidade_total) values('${f.source}','${f.edition}','Source',1,null),('${f.destination}','${f.edition}','Destination',2,${capacity===null?'null':capacity});
  update public.campeonato_fases set etapa_id='${f.source}' where id='${f.phase}';
  insert into public.campeonato_progressao_regras(id,etapa_origem_id,etapa_destino_id,tipo,posicao_inicio,posicao_fim) values('${f.rule}','${f.source}','${f.destination}',${quote(type)},1,${end});
  ${f.parts.map((part,n)=>`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id,grupo_id,status,nome_exibicao,criado_por,origem_entrada)
    values('${part}','${f.camp}','${id(100+n)}','${id(200+n)}','${f.slots[n]}','${f.group}','ativo','Team ${n+1}','${id(1)}','manual');
    insert into public.campeonato_etapa_equipes(id,campeonato_id,etapa_id,campeonato_equipe_id,tipo_origem,status,posicao_origem,observacao)
      values('${f.sources[n]}','${f.camp}','${f.source}','${part}','manual','ativa',${50+n},'Source before');`).join('\n')}
  insert into public.campeonato_jogos(id,campeonato_id,fase_id,nome,numero_partidas) values('${f.game}','${f.camp}','${f.phase}','Fixture game',1);`)
 f.match=await sql(`select id from public.campeonato_partidas where jogo_id='${f.game}' and numero_partida=1;`)
 if(!/^[\da-f-]{36}$/.test(f.match))throw Error('Expected the match created by the published game trigger')
 await sql(`set request.jwt.claim.role='service_role';
  ${f.parts.map((part,n)=>`insert into public.campeonato_resultados_equipes(id,campeonato_id,fase_id,grupo_id,jogo_id,partida_id,campeonato_equipe_id,equipe_id,line_id,posicao,abates)
    values('${f.results[n]}','${f.camp}','${f.phase}','${f.group}','${f.game}','${f.match}','${part}','${id(100+n)}','${id(200+n)}',${n+1},${count-n});`).join('\n')}`)
 return f
}
async function call(f,action,args,{actor=1,request=action==='preview'?null:id(++key),hold=0,prefix=''}={}){
 const out=await sql(`${service}begin;${prefix}
  select jsonb_build_object('pid',pg_backend_pid(),'data',public.fn_operar_progressao_atomica('${id(actor)}',${request?quote(request):'null'},'${f.camp}',${quote(action)},${quote(JSON.stringify(args))}::jsonb));
  ${hold?`select pg_sleep(${hold});`:''}commit;`,{timeout:20000})
 return JSON.parse(out.split('\n')[0])
}
const preview=async f=>(await call(f,'preview',{rule_id:f.rule})).data.preview
const apply=async(f,plan,options={})=>call(f,'apply',{rule_id:f.rule,replace_conflicts:options.replace||false,expected:plan.fence},options)
const reverse=async(f,execution,options={})=>call(f,'reverse',{execution_id:execution,reason:'Fixture reversal'},options)
const state=f=>json(`select jsonb_build_object(
 'results',(select jsonb_agg(to_jsonb(x) order by id) from public.campeonato_resultados_equipes x where campeonato_id='${f.camp}'),
 'links',(select jsonb_agg(to_jsonb(x) order by id) from public.campeonato_etapa_equipes x where campeonato_id='${f.camp}'),
 'executions',(select jsonb_agg(to_jsonb(x) order by id) from public.campeonato_progressao_execucoes x where campeonato_id='${f.camp}'),
 'items',(select jsonb_agg(to_jsonb(x) order by x.id) from public.campeonato_progressao_execucao_itens x join public.campeonato_progressao_execucoes e on e.id=x.execucao_id where e.campeonato_id='${f.camp}'),
 'audits',(select jsonb_agg(to_jsonb(x) order by execucao_id) from public.progressao_auditoria x where campeonato_id='${f.camp}'),
 'images',(select jsonb_agg(to_jsonb(x) order by x.execucao_id,x.campeonato_equipe_id,x.papel) from public.progressao_vinculos x join public.progressao_auditoria a using(execucao_id) where a.campeonato_id='${f.camp}'),
 'receipts',(select jsonb_agg(to_jsonb(x) order by actor_id,request_id) from public.progressao_recibos x));`)
async function unchanged(f,body){const before=await state(f);await assert.rejects(body);assert.deepEqual(await state(f),before);return{beforeAfterIdentical:true,stateSha256:hash(before)}}
async function failTrigger(table,event,body){
 await sql(`create function public.fixture_fail_progression() returns trigger language plpgsql as $$begin raise exception 'fixture induced failure';end;$$;
  create trigger fixture_fail_progression after ${event} on public.${table} for each row execute function public.fixture_fail_progression();`)
 try{return await body()}finally{await sql(`drop trigger fixture_fail_progression on public.${table};drop function public.fixture_fail_progression();`)}
}
if(Number(await sql('select count(*) from auth.users;'))===0)await seed()
await test('preview is authoritative, scoped and has no business/receipt writes',async()=>{const f=await fixture(),before=await state(f),p=await preview(f);assert.equal(p.candidates.length,2);assert.deepEqual(p.candidates.map(row=>row.campeonato_equipe_id),f.parts.slice(0,2));assert.equal(p.summary.capacity,3);assert.equal(p.fence.source_links.length,2);assert.deepEqual(await state(f),before);return{selected:2}})
if(!result[0].passed){fs.writeFileSync(directory+'/native-first-error.json',JSON.stringify({generatedAt:new Date().toISOString(),results:result},null,2)+'\n');throw Error('Initial fixture/preview must pass before running the remaining native cases')}
await test('apply commits complete images/items/execution and no recursive public fences',async()=>{const f=await fixture(),p=await preview(f),r=(await apply(f,p)).data;assert.equal(r.applied,2);const after=await state(f);assert.equal(after.executions.length,1);assert.equal(after.items.length,2);assert.equal(after.images.length,4);assert.equal(after.audits.length,1);assert.ok(after.links.filter(row=>row.etapa_id===f.destination).every(row=>row.progressao_execucao_id===r.execution_id));assert.equal(after.executions[0].previa_snapshot.fence,undefined);assert.equal(after.executions[0].resultado_snapshot.fence,undefined);assert.ok(!('previa_snapshot' in r.preview.activeExecution));return{complete:true}})
await test('reversal restores full business fields including prior source position and stamps',async()=>{const f=await fixture(),before=await state(f),r=(await apply(f,await preview(f))).data,undo=(await reverse(f,r.execution_id)).data;assert.equal(undo.reversed,2);const after=await state(f);for(const old of before.links){const row=after.links.find(x=>x.id===old.id);for(const field of ['tipo_origem','etapa_origem_id','posicao_origem','status','observacao','regra_progressao_id','progressao_execucao_id'])assert.deepEqual(row[field],old[field]);if(f.parts.slice(0,2).includes(old.campeonato_equipe_id))assert.ok(row.progressao_revisao>old.progressao_revisao);else assert.deepEqual(row,old)}assert.ok(after.links.filter(row=>row.etapa_id===f.destination).every(row=>row.status==='retirada'));assert.equal(after.executions[0].status,'revertida');return{restoredPositions:true}})
await test('apply replay returns the original execution without more writes',async()=>{const f=await fixture(),p=await preview(f),request=id(++key),first=await apply(f,p,{request}),before=await state(f),second=await apply(f,p,{request});assert.equal(second.data.execution_id,first.data.execution_id);assert.equal(second.data.repetida,true);assert.deepEqual(await state(f),before)})
await test('reverse replay returns the original result after links have been restored',async()=>{const f=await fixture(),r=(await apply(f,await preview(f))).data,request=id(++key);await reverse(f,r.execution_id,{request});const before=await state(f),again=await reverse(f,r.execution_id,{request});assert.equal(again.data.repetida,true);assert.deepEqual(await state(f),before)})
await test('same key and changed intent refuses without effects',async()=>{const f=await fixture(),p=await preview(f),request=id(++key);await apply(f,p,{request});return unchanged(f,()=>apply(f,p,{request,replace:true}))})
for(const field of ['result','rule','stage','source','inactive','destination-retired'])await test('stale preview '+field+' refuses before commit',async()=>{const f=await fixture(),p=await preview(f)
 if(field==='result')await sql(`update public.campeonato_resultados_equipes set abates=100 where id='${f.results[2]}';`)
 if(field==='rule')await sql(`update public.campeonato_progressao_regras set quantidade=1 where id='${f.rule}';`)
 if(field==='stage')await sql(`update public.campeonato_etapas set nome='New name' where id='${f.destination}';`)
 if(field==='source')await sql(`update public.campeonato_etapa_equipes set observacao='New source' where id='${f.sources[0]}';`)
 if(field==='inactive')await sql(`update public.campeonato_equipes set status='removido' where id='${f.parts[0]}';`)
 if(field==='destination-retired')await sql(`insert into public.campeonato_etapa_equipes(campeonato_id,etapa_id,campeonato_equipe_id,status,tipo_origem) values('${f.camp}','${f.destination}','${f.parts[0]}','retirada','manual');`)
 return unchanged(f,()=>apply(f,p))
})
await test('capacity overflow refuses atomically',async()=>{const f=await fixture({capacity:1}),p=await preview(f);assert.equal(p.summary.canApply,false);return unchanged(f,()=>apply(f,p))})
await test('NULL capacity is unbounded',async()=>{const f=await fixture({capacity:null}),p=await preview(f);assert.equal(p.summary.capacity,null);assert.equal((await apply(f,p)).data.applied,2)})
await test('current positive capacity constraint rejects zero fixture without weakening schema',async()=>{const f=await fixture();await assert.rejects(()=>sql(`update public.campeonato_etapas set capacidade_total=0 where id='${f.destination}';`));assert.equal((await preview(f)).summary.capacity,3)})
await test('conflict replacement is explicit and reversal restores previous destination fields',async()=>{const f=await fixture(),oldRule=id(f.n+500);await sql(`insert into public.campeonato_progressao_regras(id,etapa_origem_id,etapa_destino_id,tipo,posicao_inicio,posicao_fim) values('${oldRule}','${f.source}','${f.destination}','avanco',1,1);
 insert into public.campeonato_etapa_equipes(campeonato_id,etapa_id,campeonato_equipe_id,tipo_origem,status,observacao,regra_progressao_id,posicao_origem) values('${f.camp}','${f.destination}','${f.parts[0]}','manual','ativa','Prior destination','${oldRule}',99);`)
 const before=await state(f),p=await preview(f);assert.equal(p.summary.conflictCount,1);await unchanged(f,()=>apply(f,p));const applied=(await apply(f,p,{replace:true})).data;await reverse(f,applied.execution_id)
 const row=(await state(f)).links.find(row=>row.etapa_id===f.destination&&row.campeonato_equipe_id===f.parts[0]),old=before.links.find(row=>row.etapa_id===f.destination)
 for(const [field,value]of Object.entries(old))if(!['progressao_revisao','updated_at'].includes(field))assert.deepEqual(row[field],value)
 assert.equal(row.observacao,'Prior destination');assert.equal(row.posicao_origem,99);assert.equal(row.regra_progressao_id,oldRule);assert.equal(row.status,'ativa')
})
for(const target of ['destination','source','ABA','execution','items','absent-source'])await test('reversal preserves later '+target+' modification',async()=>{const f=await fixture();if(target==='absent-source')await sql(`delete from public.campeonato_etapa_equipes where id='${f.sources[0]}';`);const r=(await apply(f,await preview(f))).data
 if(target==='destination')await sql(`update public.campeonato_etapa_equipes set observacao='Later writer' where etapa_id='${f.destination}' and campeonato_equipe_id='${f.parts[0]}';`)
 if(target==='source')await sql(`update public.campeonato_etapa_equipes set posicao_origem=77 where id='${f.sources[0]}';`)
 if(target==='ABA')await sql(`update public.campeonato_etapa_equipes set observacao='Transient' where id='${f.sources[0]}';update public.campeonato_etapa_equipes set observacao='Source before' where id='${f.sources[0]}';`)
 if(target==='execution')await sql(`update public.campeonato_progressao_execucoes set motivo_reversao='Later note' where id='${r.execution_id}';`)
 if(target==='items')await sql(`update public.campeonato_progressao_execucao_itens set resultado='substituida' where execucao_id='${r.execution_id}';`)
 if(target==='absent-source')await sql(`insert into public.campeonato_etapa_equipes(campeonato_id,etapa_id,campeonato_equipe_id,tipo_origem,status) values('${f.camp}','${f.source}','${f.parts[0]}','manual','ativa');`)
 return unchanged(f,()=>reverse(f,r.execution_id))
})
await test('historical execution without private images refuses safe reversal',async()=>{const f=await fixture(),exec=id(f.n+600);await sql(`insert into public.campeonato_progressao_execucoes(id,campeonato_id,regra_id,status,aplicada_por) values('${exec}','${f.camp}','${f.rule}','aplicada','${id(1)}');`);return unchanged(f,()=>reverse(f,exec))})
for(const table of ['campeonato_progressao_execucoes','campeonato_etapa_equipes','campeonato_progressao_execucao_itens','progressao_vinculos','progressao_auditoria','progressao_recibos'])await test('apply rollback on '+table+' failure',async()=>{const f=await fixture(),p=await preview(f);return failTrigger(table,table==='campeonato_etapa_equipes'?'update':'insert',()=>unchanged(f,()=>apply(f,p)))})
for(const table of ['campeonato_etapa_equipes','campeonato_progressao_execucoes','progressao_vinculos','progressao_auditoria','progressao_recibos'])await test('reverse rollback on '+table+' failure',async()=>{const f=await fixture(),r=(await apply(f,await preview(f))).data;return failTrigger(table,table==='progressao_recibos'?'insert':'update',()=>unchanged(f,()=>reverse(f,r.execution_id)))})
for(const role of ['anon','authenticated'])await test(role+' cannot execute RPC or mutate private receipts',async()=>{const f=await fixture();await assert.rejects(()=>sql(`set role ${role};select public.fn_operar_progressao_atomica('${id(1)}',null,'${f.camp}','preview','{}');`));await assert.rejects(()=>sql(`set role ${role};select * from public.progressao_recibos;`));await assert.rejects(()=>sql(`set role ${role};insert into public.progressao_recibos values('${id(1)}','${id(++key)}','fake','{}',now());`))})
await test('service cannot mutate private journal directly or call plan helper',async()=>{await assert.rejects(()=>sql(`${service}insert into public.progressao_recibos values('${id(1)}','${id(++key)}','fake','{}',now());`));await assert.rejects(()=>sql(`${service}select public.dz_progression_plan('${id(1)}','${id(2)}');`))})
await test('unauthorized actor and foreign rule refuse without writes',async()=>{const f=await fixture(),foreign=await fixture();await unchanged(f,()=>call(f,'preview',{rule_id:f.rule},{actor:2}));await unchanged(f,()=>call(f,'preview',{rule_id:foreign.rule}))})
await test('six sessions / same UUID: one commit and five receipt replays',async()=>{const f=await fixture(),p=await preview(f),request=id(++key),runs=await Promise.all(Array.from({length:6},()=>apply(f,p,{request,hold:0.15})));assert.equal(new Set(runs.map(row=>row.data.execution_id)).size,1);assert.equal(runs.filter(row=>row.data.repetida).length,5);assert.equal((await state(f)).executions.length,1);return{sessions:new Set(runs.map(row=>row.pid)).size,replays:5}})
await test('two UUIDs from same snapshot: one commit / one stale refusal',async()=>{const f=await fixture(),p=await preview(f),runs=await Promise.allSettled([apply(f,p,{hold:0.3}),apply(f,p)]);assert.equal(runs.filter(row=>row.status==='fulfilled').length,1);assert.equal(runs.filter(row=>row.status==='rejected').length,1);assert.equal((await state(f)).executions.length,1)})
await test('two concurrent reversals: one complete reversal / one refusal',async()=>{const f=await fixture(),r=(await apply(f,await preview(f))).data,runs=await Promise.allSettled([reverse(f,r.execution_id,{hold:0.3}),reverse(f,r.execution_id)]);assert.equal(runs.filter(row=>row.status==='fulfilled').length,1);assert.equal((await state(f)).executions[0].status,'revertida')})

for(const shape of ['published-scoring','complete-tie','over-1000-detail-rows'])await test('native ranking matches existing JS aggregation: '+shape,async()=>{
 const f=await fixture()
 if(shape==='complete-tie')await sql(`update public.campeonato_resultados_equipes set abates=1,posicao=2 where campeonato_id='${f.camp}';`)
 if(shape==='over-1000-detail-rows')await sql(`do $$declare g uuid;m uuid;p record;begin for n in 1..334 loop
  insert into public.campeonato_jogos(campeonato_id,fase_id,nome,numero_partidas) values('${f.camp}','${f.phase}','Volume fixture',1) returning id into g;
  select id into m from public.campeonato_partidas where jogo_id=g and numero_partida=1;
  for p in select * from public.campeonato_equipes where campeonato_id='${f.camp}' loop
   insert into public.campeonato_resultados_equipes(campeonato_id,fase_id,grupo_id,jogo_id,partida_id,campeonato_equipe_id,equipe_id,line_id,posicao,abates)
    values('${f.camp}','${f.phase}','${f.group}',g,m,p.id,p.equipe_id,p.line_id,2,1);
  end loop;end loop;end;$$;`,{timeout:60000})
 const rows=await json(`select jsonb_agg(to_jsonb(x) order by resultado_id) from public.campeonato_estatisticas_equipes_detalhe x where campeonato_id='${f.camp}' and fase_id='${f.phase}';`)
 const lines=await json(`select jsonb_agg(jsonb_build_object('id',id,'public_id',public_id)) from public.equipe_lines;`)
 const query={select(){return this},in(){return this},order(){return this}},load=fixtureLoader({
  '@backend/shared/supabase-admin':{supabaseAdmin:{from:()=>query}},
  '@backend/shared/paginated-query':{readRowsByIds:async ids=>lines.filter(row=>ids.includes(row.id))},
  '@backend/campeonatos/estatisticas/statistics-query':{readStatsRows:async()=>rows},
 })
 const expected=await load('backend/src/campeonatos/estatisticas/statistics-read.service.ts').listarEstatisticasEquipes(f.camp,{faseId:f.phase})
 assert.deepEqual((await preview(f)).fence.ranking,expected)
 return{detailRows:rows.length,exactJsAggregation:true}
})
async function observe(name,condition){for(let tries=0;tries<30;tries++){if(await sql(`select exists(select 1 from pg_stat_activity where application_name=${quote(name)} and ${condition});`)==='t')return;await new Promise(resolve=>setTimeout(resolve,30))}throw Error('Expected observed native lock/activity '+name)}
for(const writer of ['result','phase-phantom','last-vacancy'])await test('ordinary '+writer+' writer waits for progression parent lock',async()=>{
 const f=await fixture({capacity:2}),p=await preview(f),owner='progression-owner-'+next,other='progression-writer-'+next
 const first=apply(f,p,{hold:2,prefix:`set local application_name=${quote(owner)};`})
 await observe(owner,"query like '%pg_sleep%'")
 const mutation=writer==='result'?`update public.campeonato_resultados_equipes set abates=99 where id='${f.results[2]}';`
  :writer==='last-vacancy'?`insert into public.campeonato_etapa_equipes(campeonato_id,etapa_id,campeonato_equipe_id,status,tipo_origem) values('${f.camp}','${f.destination}','${f.parts[2]}','ativa','manual');`
  :`insert into public.campeonato_fases select (jsonb_populate_record(null::public.campeonato_fases,to_jsonb(x)||jsonb_build_object('id',gen_random_uuid(),'ordem',99,'nome','Later phase'))).* from public.campeonato_fases x where id='${f.phase}';`
 const second=sql(`begin;set local application_name=${quote(other)};${mutation}commit;`).then(data=>({ok:true,data}),error=>({ok:false,error:error.message}))
 await observe(other,"wait_event_type='Lock'")
 assert.equal((await first).data.applied,2);const outcome=await second
 assert.equal(outcome.ok,writer!=='last-vacancy')
 if(writer==='last-vacancy')assert.equal((await state(f)).links.filter(x=>x.etapa_id===f.destination&&x.status!=='retirada').length,2)
 return{nativeLockObserved:true,laterWriterCommitted:outcome.ok}
})
for(const target of ['links','items','results'])await test('receipt trigger changes '+target+' cause full rollback by postcondition',async()=>{
 const f=await fixture(),p=await preview(f)
 const statement=target==='links'?`update public.campeonato_etapa_equipes set observacao='Injected late change' where campeonato_id='${f.camp}' and etapa_id='${f.destination}';`
  :target==='items'?`update public.campeonato_progressao_execucao_itens set resultado='substituida' where execucao_id=(NEW.resultado->>'execution_id')::uuid;`
  :`update public.campeonato_resultados_equipes set abates=77 where id='${f.results[2]}';`
 await sql(`create function public.fixture_receipt_change() returns trigger language plpgsql as $$begin ${statement}return NEW;end;$$;
  create trigger fixture_receipt_change after insert on public.progressao_recibos for each row execute function public.fixture_receipt_change();`)
 try{return await unchanged(f,()=>apply(f,p))}finally{await sql('drop trigger fixture_receipt_change on public.progressao_recibos;drop function public.fixture_receipt_change();')}
})
for(const writer of ['execution','items'])await test('ordinary '+writer+' writer waits for reversal history lock',async()=>{
 const f=await fixture(),applied=(await apply(f,await preview(f))).data,owner='reverse-owner-'+next,other='history-writer-'+next
 const first=reverse(f,applied.execution_id,{hold:2,prefix:`set local application_name=${quote(owner)};`})
 await observe(owner,"query like '%pg_sleep%'")
 const mutation=writer==='execution'?`update public.campeonato_progressao_execucoes set motivo_reversao='Later history writer' where id='${applied.execution_id}';`
  :`update public.campeonato_progressao_execucao_itens set resultado='substituida' where execucao_id='${applied.execution_id}';`
 const second=sql(`begin;set local application_name=${quote(other)};${mutation}commit;`)
 await observe(other,"wait_event_type='Lock'");assert.equal((await first).data.reversed,2);await second
 return{nativeLockObserved:true}
})
await test('changed published validator hash refuses candidate guard without replacing anything',async()=>{
 const candidate=fs.readFileSync('docs/sql/20261012_progression_candidate.sql','utf8'),guard=candidate.match(/do \$guard\$[\s\S]*?\$guard\$;/)[0]
 const before=await sql("select md5(pg_get_functiondef('public.fn_validar_campeonato_etapa_equipe_85c()'::regprocedure));")
 await assert.rejects(()=>sql(guard));assert.equal(await sql("select md5(pg_get_functiondef('public.fn_validar_campeonato_etapa_equipe_85c()'::regprocedure));"),before)
})
const summary={generatedAt:new Date().toISOString(),passed:result.filter(row=>row.passed).length,failed:result.filter(row=>!row.passed).length,results:result,candidate:{file:'docs/sql/20261012_progression_candidate.sql',sha256:createHash('sha256').update(fs.readFileSync('docs/sql/20261012_progression_candidate.sql')).digest('hex')},scope:'Native PostgreSQL17.6, fresh saved public metadata/exact views and historical function bodies verified by current MD5s. Synthetic Auth/JWT/Realtime, no production connection/data; not Supabase staging/HTTP/infra or all writers.'}
fs.writeFileSync(directory+'/native-progression.json',JSON.stringify(summary,null,2)+'\n')
console.log(`Native progression: ${summary.passed} passed/${summary.failed} failed.`)
if(summary.failed)process.exitCode=1
