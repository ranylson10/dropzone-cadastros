import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {sql} from './docker-lab.mjs'
import {id,quote,service,championship} from './fixtures.mjs'
import {ligaQuotaCases} from '../liga-quota-cases.mjs'
const database=process.argv[2],directory=process.argv[3]
if(!/^dropzone_validation_[a-z0-9_]+$/.test(database||'')||!/^relatorios-testes\/[a-z0-9-]+$/.test(directory||''))throw Error('Explicit synthetic database/evidence directory required')
process.env.DROPZONE_FIXTURE_DB=database;fs.mkdirSync(directory,{recursive:true})
// Requires fresh-validation --participation, followed by validate-participation (installs Liga schema).
let next=3230000,key=3330000
const results=[],json=async text=>JSON.parse(await sql(text))
const test=async(name,fn)=>{try{results.push({name,passed:true,...await fn()});console.log('PASS '+name)}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message)}}
const fixture=async entries=>{next+=100;const f=await championship(next);await sql(`update public.campeonatos set tipo='liga' where id='${f.camp}';
 update public.campeonato_configuracoes set liga_divisoes=${quote(JSON.stringify([{nome:'Group',entradas:entries}]))}::jsonb where campeonato_id='${f.camp}';`);return f}
const state=f=>json(`select jsonb_build_object(
 'parts',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_equipes t where campeonato_id='${f.camp}'),
 'slots',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_slots t where campeonato_id='${f.camp}'),
 'lines',(select jsonb_agg(to_jsonb(t) order by id) from public.equipe_lines t where equipe_id in('${id(100)}','${id(101)}')),
 'config',(select to_jsonb(t) from public.campeonato_configuracoes t where campeonato_id='${f.camp}'),
 'agenda',(select jsonb_agg(to_jsonb(t) order by id) from public.agenda_compromissos t where campeonato_id='${f.camp}'),
 'links',(select jsonb_agg(to_jsonb(t) order by id) from public.campeonato_links t where campeonato_id='${f.camp}'),
 'tokens',(select jsonb_agg(to_jsonb(t) order by id) from public.tokens t where campeonato_id='${f.camp}'),
 'audits',(select jsonb_agg(to_jsonb(t) order by request_id) from public.participacao_operacoes t where campeonato_id='${f.camp}'),
 'receipts',(select jsonb_agg(to_jsonb(t) order by request_id) from public.participacao_recibos t where resultado->>'campeonato_id'='${f.camp}'));`)
const call=(f,action,args,request=id(++key),hold=0)=>sql(`${service}begin;select pg_backend_pid();select public.fn_gravar_participacao_atomica('${id(1)}','${request}','${f.camp}',${quote(action)},${quote(JSON.stringify(args))}::jsonb);${hold?'select pg_sleep('+hold+');':''}commit;`,{timeout:20000})
 .then(out=>({pid:Number(out.split('\n')[0]),data:JSON.parse(out.split('\n')[1])}))
const args=async(f,action,team=100)=>{
 if(action==='add')return {equipe_id:id(team),line_id:null,nome_line:'Quota fixture '+f.n+' '+team,slot_id:f.slots[team-100],origem_entrada:'vaga_paga'}
 const part=await json(`insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,status,origem_entrada,criado_por,nome_exibicao)
 values('${f.camp}','${id(team)}','${id(team+100)}','pendente','inscricao','${id(1)}','Fixture Line') returning to_jsonb(campeonato_equipes);`)
 return {participacao_id:part.id,slot_id:f.slots[team-100],origem_entrada:'vaga_paga',expected:{equipe_id:part.equipe_id,line_id:part.line_id,slot_id:null,status:part.status,updated_at:part.updated_at}}
}
const refuse=async(f,action,body,pattern=/Configuração da Liga indisponível/)=>{
 const before=await state(f);let failure
 try{await call(f,action,body)}catch(error){failure=error.message}
 assert.ok(failure,'Expected refusal');assert.match(failure,pattern);assert.deepEqual(await state(f),before);return {unchanged:true,failure}
}
for(const item of ligaQuotaCases)for(const action of ['add','approve'])await test(action+': '+item.name,async()=>{
 const f=await fixture(item.entries),body=await args(f,action)
 if(!item.valid)return refuse(f,action,body)
 const out=await call(f,action,body);assert.equal(out.data.participacao.status,'ativo');assert.equal(out.data.participacao.origem_entrada,'liga_vaga_paga')
 const after=await state(f);assert.equal(after.audits.length,1);assert.equal(after.receipts.length,1);assert.equal(after.slots[0].equipe_id,id(100));return {quota:item.quota}
})
for(const action of ['add','approve'])for(const shape of ['duplicate','missing','empty','nonarray'])await test(action+': '+shape+' division refuses before commit',async()=>{
 const f=await fixture([{tipo:'vaga_paga',quantidade:'1'}]),body=await args(f,action)
 const divisions=shape==='duplicate'?[{nome:'Group',entradas:[{tipo:'vaga_paga',quantidade:'1'}]},{nome:' group ',entradas:[{tipo:'vaga_paga',quantidade:'1'}]}]
  :shape==='missing'?[{nome:'Other',entradas:[{tipo:'vaga_paga',quantidade:'1'}]}]:[{nome:'Group',entradas:shape==='empty'?[]:{}}]
 await sql(`update public.campeonato_configuracoes set liga_divisoes=${quote(JSON.stringify(divisions))}::jsonb where campeonato_id='${f.camp}';`)
 return refuse(f,action,body)
})
for(const action of ['add','approve'])await test(action+': zero quota refuses without side effects',async()=>{const f=await fixture([{tipo:'vaga_paga',quantidade:'0'}]);return refuse(f,action,await args(f,action),/Cota da origem/)})
for(const action of ['add','approve'])await test(action+': two sessions cannot consume the last quota twice',async()=>{
 const f=await fixture([{tipo:'vaga_paga',quantidade:'1'}]),a=await args(f,action),b=await args(f,action,101)
 const outcomes=await Promise.allSettled([call(f,action,a,id(++key),0.3),call(f,action,b,id(++key),0.3)])
 const accepted=outcomes.filter(o=>o.status==='fulfilled'),refused=outcomes.filter(o=>o.status==='rejected')
 assert.equal(accepted.length,1);assert.equal(refused.length,1);assert.match(refused[0].reason.message,/Cota da origem/)
 const after=await state(f);assert.equal(after.parts.filter(p=>p.status==='ativo').length,1);assert.equal(after.audits.length,1);assert.equal(after.receipts.length,1)
 return {accepted:1,refused:1,pid:accepted[0].value.pid}
})
await test('Changed plan does not change an already committed replay result',async()=>{
 const f=await fixture([{tipo:'vaga_paga',quantidade:'1'}]),body=await args(f,'add'),request=id(++key),out=await call(f,'add',body,request)
 await sql(`update public.campeonato_configuracoes set liga_divisoes='[{"nome":"Group","entradas":[{"tipo":"vaga_paga","quantidade":"1.5"}]}]'::jsonb where campeonato_id='${f.camp}';`)
 const before=await state(f),replay=await call(f,'add',body,request);assert.deepEqual(replay.data,{...out.data,repetida:true});assert.deepEqual(await state(f),before)
})
const output={database,scope:'Synthetic PostgreSQL17.6 only; no production connection or real Auth/PostgREST/network/device proof.',candidateSha256:createHash('sha256').update(fs.readFileSync('docs/sql/20261011_participation_write_candidate.sql')).digest('hex'),passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results}
fs.writeFileSync(directory+'/native-liga-quotas.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({passed:output.passed,failed:output.failed}));if(output.failed)process.exitCode=1
