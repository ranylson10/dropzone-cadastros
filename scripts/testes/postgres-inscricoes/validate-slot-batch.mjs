import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sql} from './docker-lab.mjs'
import {id,quote,service,championship} from './fixtures.mjs'
const database=process.argv[2],directory=process.argv[3]
if(!/^dropzone_validation_[a-z0-9_]+$/.test(database||'')||!/^relatorios-testes\/[a-z0-9-]+$/.test(directory||''))throw new Error('Explicit synthetic database and new evidence directory required.')
process.env.DROPZONE_FIXTURE_DB=database
fs.mkdirSync(directory,{recursive:true})
let next=710000,key=780000
const results=[],json=async text=>JSON.parse(await sql(text))
const test=async(name,body)=>{try{results.push({name,passed:true,...await body()});console.log('PASS '+name)}catch(e){results.push({name,passed:false,error:e.message});console.log('FAIL '+name+': '+e.message)}}
const fixture=async(count=4)=>{
  next+=100;const f=await championship(next),other=id(next+50),slots=Array.from({length:4},(_,i)=>id(next+60+i))
  await sql(`update public.campeonato_configuracoes set numero_vagas=8 where campeonato_id='${f.camp}';
    insert into public.campeonato_grupos(id,campeonato_id,nome,fase_id,slots) values('${other}','${f.camp}','Second','${f.phase}',4);
    ${slots.map((s,i)=>`insert into public.campeonato_slots(id,campeonato_id,grupo_id,fase_id,slot_numero,slot_letra,status)
      values('${s}','${f.camp}','${other}','${f.phase}',${i+1},'B${i+1}','livre');`).join('\n')}
    ${Array.from({length:count},(_,i)=>`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id)
      values('${id(next+30+i)}','${f.camp}','${id(100+i)}','${id(200+i)}','${f.slots[i]}');`).join('\n')}`)
  return {...f,groups:[f.group,other],allSlots:[...f.slots,...slots],secondSlots:slots}
}
const expected=async f=>json(`select jsonb_agg(jsonb_build_object('id',id,'slot_id',slot_id,'updated_at',updated_at,'equipe_id',equipe_id,'line_id',line_id) order by id)
  from public.campeonato_equipes where campeonato_id='${f.camp}' and status='ativo';`)
const state=async f=>json(`select jsonb_build_object(
  'parts',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_equipes t where campeonato_id='${f.camp}'),
  'slots',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_slots t where campeonato_id='${f.camp}'),
  'history',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_grupo_escolha_historico t where campeonato_id='${f.camp}'),
  'agenda',(select jsonb_agg(to_jsonb(t) order by id) from public.agenda_compromissos t where campeonato_id='${f.camp}'),
  'links',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_links t where campeonato_id='${f.camp}'),
  'tokens',(select jsonb_agg(to_jsonb(t) order by id) from public.tokens t where campeonato_id='${f.camp}'),
  'receipts',(select jsonb_agg(to_jsonb(t) order by actor_id,request_id) from public.movimentacao_recibos t where resultado->>'campeonato_id'='${f.camp}'));`)
const rejected=async(promise,pattern)=>{let failure;try{await promise}catch(e){failure=e.message}assert.ok(failure,'Expected refusal');if(pattern)assert.match(failure,pattern);return failure}
const batch=async(f,{actor=1,request=id(++key),mode='distribute_phase',phase=f.phase,groups=f.groups,strategy='balanced',snapshot,hold=0,prefix=''}={})=>{
  snapshot??=await expected(f)
  const out=await sql(`${service}${prefix}begin;select pg_backend_pid();select public.fn_distribuir_slots_atomico('${id(actor)}','${request}','${f.camp}',${quote(mode)},
    ${phase?quote(phase):'null'},array[${groups.map(quote).join(',')}]::uuid[],${strategy?quote(strategy):'null'},${quote(JSON.stringify(snapshot))}::jsonb);
    ${hold?`select pg_sleep(${hold});`:''}commit;`,{timeout:20000})
  const lines=out.split('\n');return {pid:Number(lines[0]),data:JSON.parse(lines[1])}
}
const refuse=async(f,options,pattern)=>{const before=await state(f),failure=await rejected(batch(f,options),pattern);assert.deepEqual(await state(f),before);return {failure,unchanged:true}}
const invariant=async(f,data)=>{
  const after=await state(f)
  assert.equal(data.participacoes.length,after.parts.length);assert.equal(after.receipts.length,1);assert.equal(after.history.length,after.parts.length)
  for(const part of after.parts){const slot=after.slots.find(s=>s.id===part.slot_id);assert.ok(slot);assert.equal(slot.status,'ocupado');assert.equal(slot.line_id,part.line_id);assert.equal(slot.equipe_id,part.equipe_id);assert.equal(slot.grupo_id,part.grupo_id)}
  return after
}
await test('Legacy broad group clearing erases an unrelated reservation (synthetic reproduction)',async()=>{
  const f=await fixture(2),slot=f.secondSlots[0]
  await sql(`update public.campeonato_slots set status='reservado' where id='${slot}';
    update public.campeonato_slots set equipe_id=null,line_id=null,status='livre' where campeonato_id='${f.camp}' and grupo_id in('${f.group}','${f.groups[1]}');`)
  const s=(await state(f)).slots.find(row=>row.id===slot);assert.equal(s.status,'livre');return {reproduced:true,productionIncident:false}
})
await test('Balanced distribution is atomic and counts match the occupied mirrors',async()=>{
  const f=await fixture(),snapshot=await expected(f),before=await state(f),out=await batch(f,{snapshot});const after=await invariant(f,out.data)
  assert.deepEqual(out.data.distribuicao.map(row=>row.equipes),[2,2]);assert.deepEqual(after.links,before.links);assert.deepEqual(after.tokens,before.tokens)
  assert.equal(out.data.action,'distribute');return {count:4,groupCounts:[2,2]}
})
await test('Random distribution preserves every participation, line and team',async()=>{
  const f=await fixture(),snapshot=await expected(f),out=await batch(f,{snapshot,strategy:'random'});const after=await invariant(f,out.data)
  assert.deepEqual(after.parts.map(row=>[row.id,row.equipe_id,row.line_id]),snapshot.map(row=>[row.id,row.equipe_id,row.line_id]));return {count:4}
})
await test('Shuffle affects only its group and guarantees a changed arrangement',async()=>{
  const f=await fixture(),snapshot=await expected(f),before=await state(f),out=await batch(f,{snapshot,mode:'shuffle_group',phase:null,groups:[f.group],strategy:null})
  const after=await invariant(f,out.data);assert.ok(after.parts.some(row=>row.slot_id!==snapshot.find(s=>s.id===row.id).slot_id))
  assert.deepEqual(after.slots.filter(s=>s.grupo_id===f.groups[1]),before.slots.filter(s=>s.grupo_id===f.groups[1]));return {scopePreserved:true}
})
await test('Reserved early and middle slots stay unchanged; usable rank remains balanced',async()=>{
  const f=await fixture(),reserved=[f.secondSlots[0],f.secondSlots[2]]
  await sql(`update public.campeonato_slots set status='reservado' where id in(${reserved.map(quote).join(',')});`)
  const before=await state(f),out=await batch(f),after=await invariant(f,out.data)
  assert.deepEqual(after.slots.filter(s=>reserved.includes(s.id)),before.slots.filter(s=>reserved.includes(s.id)))
  assert.deepEqual(out.data.distribuicao.map(row=>row.equipes),[2,2]);return {reservationsPreserved:2}
})
for(const mode of ['shuffle_group','distribute_phase'])await test(mode+' replay returns the original result after board changes',async()=>{
  const f=await fixture(),snapshot=await expected(f),request=id(++key),options={snapshot,request,mode,...(mode==='shuffle_group'?{phase:null,groups:[f.group],strategy:null}:{})}
  const first=await batch(f,options),before=await state(f),replay=await batch(f,{...options,snapshot:[...snapshot].reverse()})
  assert.deepEqual(replay.data,{...first.data,repetida:true});assert.deepEqual(await state(f),before);return {commits:1,replays:1}
})
await test('Reusing the key for another strategy is refused without mutation',async()=>{
  const f=await fixture(),snapshot=await expected(f),request=id(++key);await batch(f,{snapshot,request});return refuse(f,{snapshot,request,strategy:'random'},/outra distribuição/)
})
for(const field of ['updated_at','slot_id','equipe_id','line_id'])await test('Stale '+field+' snapshot is refused',async()=>{
  const f=await fixture(),snapshot=await expected(f);snapshot[0][field]=field==='updated_at'?'2026-01-01T00:00:00Z':id(999999);return refuse(f,{snapshot},/equipes mudaram/)
})
await test('An extra enrolled team after the snapshot is refused',async()=>{
  const f=await fixture(2),snapshot=await expected(f);await sql(`insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id)
    values('${id(f.n+34)}','${f.camp}','${id(104)}','${id(204)}','${f.slots[2]}');`);return refuse(f,{snapshot},/equipes mudaram/)
})
await test('A removed participant after the snapshot is refused',async()=>{
  const f=await fixture(),snapshot=await expected(f);await sql(`update public.campeonato_equipes set status='removido',slot_id=null,grupo_id=null,slot_numero=null where id='${snapshot[0].id}';`)
  return refuse(f,{snapshot},/equipes mudaram/)
})
await test('Corrupt free mirror is refused without clearing it',async()=>{
  const f=await fixture();await sql(`update public.campeonato_slots set line_id='${id(205)}',equipe_id='${id(105)}' where id='${f.secondSlots[0]}';`)
  return refuse(f,{},/Espelho de distribuição/)
})
await test('Slot with a foreign phase is refused',async()=>{
  const f=await fixture(),other=await fixture();await sql(`update public.campeonato_slots set fase_id='${other.phase}' where id='${f.secondSlots[0]}';`)
  return refuse(f,{},/Estrutura de distribuição/)
})
await test('Foreign group is refused before writes',async()=>{
  const f=await fixture(),other=await fixture();return refuse(f,{groups:[f.group,other.group]},/Grupos fora/)
})
await test('Foreign phase is refused before writes',async()=>{
  const f=await fixture(),other=await fixture();return refuse(f,{phase:other.phase},/Grupos fora/)
})
await test('Shuffle contract refuses an explicit phase with foreign parents',async()=>{
  const f=await fixture(),other=await fixture(0);await sql(`update public.campeonato_grupos set fase_id='${other.phase}' where id='${f.groups[1]}';
    update public.campeonato_slots set fase_id='${other.phase}' where grupo_id='${f.groups[1]}';`)
  return refuse(f,{phase:other.phase,groups:[f.groups[1]],mode:'shuffle_group',strategy:null},/inválid/)
})
await test('Shuffle validates a nonnull phase parent against the championship',async()=>{
  const f=await fixture(),other=await fixture(0);await sql(`update public.campeonato_grupos set fase_id='${other.phase}' where id='${f.group}';
    update public.campeonato_slots set fase_id='${other.phase}' where grupo_id='${f.group}';`)
  return refuse(f,{phase:null,groups:[f.group],mode:'shuffle_group',strategy:null},/Estrutura de distribuição/)
})
await test('Duplicate participation and source UUIDs are rejected',async()=>{
  const f=await fixture(),snapshot=await expected(f);return refuse(f,{snapshot:[snapshot[0],snapshot[0]]},/Acompanhamento.*inválido/)
})
for(const options of [{strategy:'invalid'},{groups:[]},{groups:null},{mode:'shuffle_group',phase:null,strategy:null},{mode:'other'},
  {snapshot:[]},{snapshot:[{}]}, {snapshot:[{},{}]}])await test('Invalid typed contract '+JSON.stringify(options),async()=>{
  const f=await fixture();if(options.groups===null)options.groups=[f.group,f.group];return refuse(f,options,/inválid/)
})
await test('An inactive line is refused by the locked core',async()=>{
  const f=await fixture();await sql(`update public.equipe_lines set status='inativo' where id='${id(200)}';`)
  const result=await refuse(f,{},/Line ou equipe/);await sql(`update public.equipe_lines set status='ativo' where id='${id(200)}';`);return result
})
await test('Unrelated actor has no manage permission',async()=>{const f=await fixture();return refuse(f,{actor:12},/Sem permissão/)} )
await test('Backend-only RPC denies authenticated and anonymous execution',async()=>{
  const f=await fixture();for(const role of ['authenticated','anon'])await rejected(sql(`set role ${role};select public.fn_distribuir_slots_atomico('${id(1)}','${id(++key)}','${f.camp}','distribute_phase','${f.phase}',array['${f.group}','${f.groups[1]}']::uuid[],'balanced','[]');`),/permission denied/)
  return {deniedRoles:2}
})
await test('Administration keeps manual override while enrollment and choice are closed',async()=>{
  const f=await fixture();await sql(`update public.campeonato_configuracoes set aceita_novas_inscricoes_equipes=false,data_limite_inscricao='2020-01-01' where campeonato_id='${f.camp}';`)
  const out=await batch(f);await invariant(f,out.data);return {existingAdminBehaviorPreserved:true}
})
for(const table of ['campeonato_grupo_escolha_historico','movimentacao_recibos'])await test(table+' failure rolls back the entire batch',async()=>{
  const f=await fixture(),fn='fixture_fail_batch_'+table
  await sql(`create function public.${fn}() returns trigger language plpgsql as $$begin raise exception 'fixture batch failure';end$$;
    create trigger zz_fixture_fail_batch before insert on public.${table} for each row execute function public.${fn}();`)
  try{return await refuse(f,{},/fixture batch failure/)}finally{await sql(`drop trigger zz_fixture_fail_batch on public.${table};drop function public.${fn}();`)}
})
await test('Six sessions using the same key commit once and replay five times',async()=>{
  const f=await fixture(),snapshot=await expected(f),request=id(++key)
  const first=batch(f,{snapshot,request,hold:2});await new Promise(r=>setTimeout(r,350))
  const rest=Array.from({length:5},()=>batch(f,{snapshot,request}));await new Promise(r=>setTimeout(r,350))
  const waiters=await json(`select count(*) from pg_stat_activity where datname=${quote(database)} and wait_event_type='Lock';`)
  const out=await Promise.all([first,...rest]);assert.equal(new Set(out.map(v=>v.pid)).size,6);assert.equal(out.filter(v=>v.data.repetida).length,5);assert.ok(waiters>0)
  await invariant(f,out[0].data);return {sessions:6,commits:1,replays:5,lockWaiters:waiters}
})
await test('Two different batches with the same snapshot cannot both commit',async()=>{
  const f=await fixture(),snapshot=await expected(f)
  const out=await Promise.allSettled([batch(f,{snapshot,hold:1}),batch(f,{snapshot,strategy:'random'})]);assert.equal(out.filter(v=>v.status==='fulfilled').length,1)
  assert.match(out.find(v=>v.status==='rejected').reason.message,/equipes mudaram/);await invariant(f,out.find(v=>v.status==='fulfilled').value.data);return {commits:1,refused:1}
})
await test('A reservation committed while batch waits is preserved',async()=>{
  const f=await fixture(),slot=f.secondSlots[0],snapshot=await expected(f)
  const reserve=sql(`begin;update public.campeonato_slots set status='reservado' where id='${slot}';select pg_sleep(1.5);commit;`)
  await new Promise(r=>setTimeout(r,250));const pending=batch(f,{snapshot});await reserve;const out=await pending
  const after=await invariant(f,out.data);assert.equal(after.slots.find(s=>s.id===slot).status,'reservado');return {reservationPreserved:true}
})
await test('Original committed result replays despite later reservations and removals',async()=>{
  const f=await fixture(),snapshot=await expected(f),request=id(++key),first=await batch(f,{snapshot,request})
  await sql(`update public.campeonato_equipes set status='removido',slot_id=null,grupo_id=null,slot_numero=null where id='${snapshot[0].id}';
    update public.campeonato_slots set status='reservado' where id='${first.data.participacoes[0].slot_id}';`)
  const before=await state(f),replay=await batch(f,{snapshot,request});assert.deepEqual(replay.data,{...first.data,repetida:true});assert.deepEqual(await state(f),before);return {replayBeforeCurrentBoard:true}
})
await test('Selected workspace permission is checked again before receipt replay',async()=>{
  const f=await fixture(),snapshot=await expected(f),request=id(++key),member=id(++key)
  await sql(`insert into public.produtora_membros(id,produtora_id,auth_user_id,cargo,pode_ver,pode_operar)
    values('${member}','${id(50)}','${id(12)}','operacao',true,true);`)
  try{await batch(f,{actor:12,snapshot,request});await sql(`update public.produtora_membros set pode_operar=false where id='${member}';`)
    return await refuse(f,{actor:12,snapshot,request},/Sem permissão/)
  }finally{await sql(`delete from public.produtora_membros where id='${member}';`)}
})
const output={database,scope:'Local PostgreSQL catalog reconstruction, fixture Auth/roles. No production connection, DDL or data. Not staging/PostgREST/real network loss/device certification.',
  passed:results.filter(v=>v.passed).length,failed:results.filter(v=>!v.passed).length,results}
fs.writeFileSync(directory+'/native-slot-batch.json',JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({passed:output.passed,failed:output.failed}));if(output.failed)process.exitCode=1
