import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const champ=id(1),source=id(2),destination=id(3),ruleId=id(4),phase=id(5)
let tables,calls,ranking,cap=1,failTable,failOffset,rankCalls,auth=true,manage=true,forceForeign=false
const at=(row,key)=>key.split('.').reduce((value,part)=>value?.[part],row)
const admin=createClient('https://progression-preview-fixture.supabase.co','fixture',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1),params=url.searchParams,offset=Number(params.get('offset')||0),limit=Number(params.get('limit')||1000)
  assert.equal(url.hostname,'progression-preview-fixture.supabase.co');assert.equal(options.method||'GET','GET','Preview cannot write')
  calls.push({table,offset,limit,params:Object.fromEntries(params)})
  if(table===failTable&&offset>=failOffset)return Response.json({code:'XX000',message:'PRIVATE fixture late read failure'},{status:500})
  let rows=(tables[table]||[]).filter(row=>[...params].every(([key,value])=>{
    if(forceForeign&&table==='campeonato_etapa_equipes'&&key==='campeonato_id')return true
    if(value.startsWith('eq.'))return String(at(row,key))===value.slice(3)
    if(value.startsWith('neq.'))return at(row,key)!=null&&String(at(row,key))!==value.slice(4)
    if(value.startsWith('in.'))return value.slice(4,-1).split(',').includes(String(at(row,key)))
    return true
  }))
  const orders=(params.get('order')||'').split(',').filter(Boolean)
  rows.sort((a,b)=>{for(const entry of orders){const [key,direction]=entry.split('.'),x=at(a,key),y=at(b,key),result=typeof x==='number'?x-y:String(x??'').localeCompare(String(y??''));if(result)return direction==='desc'?-result:result}return 0})
  rows=rows.slice(offset,offset+Math.min(cap,limit))
  const object=new Headers(options.headers).get('accept')?.includes('vnd.pgrst.object')
  return Response.json(object?(rows[0]||null):rows)
}}})
const statistics={listarEstatisticasEquipes:async(championship,filters)=>{assert.equal(championship,champ);assert.equal(filters.faseId,phase);rankCalls++;return ranking}}
const loader=fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},'@backend/campeonatos/estatisticas/estatisticas.service':statistics,
  '@backend/auth/server-auth':{getBearerUser:async()=>{if(!auth)throw Error('Sessao invalida.');return{id:id(999)}}},
  '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>({canView:true,canManage:manage,role:'owner'})}})
const preview=loader('backend/src/campeonatos/progression-preview.ts').buildProgressionPreview
const route=loader('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
function reset(){cap=1;calls=[];rankCalls=0;failTable=null;failOffset=Infinity;auth=true;manage=true;forceForeign=false
  ranking=[{campeonato_equipe_id:id(100),colocacao:1,nome:'Novo participante',pontos_total:20}]
  tables={
    campeonato_progressao_regras:[{id:ruleId,etapa_origem_id:source,etapa_destino_id:destination,posicao_inicio:1,posicao_fim:1,quantidade:null,tipo:'avanco',origem:{id:source,campeonato_edicoes:{campeonato_id:champ}}}],
    campeonato_etapas:[{id:source,nome:'Origem',capacidade_total:null,campeonato_edicoes:{campeonato_id:champ}},{id:destination,nome:'Destino',capacidade_total:2,campeonato_edicoes:{campeonato_id:champ}}],
    campeonato_fases:[{id:id(6),nome:'Anterior',ordem:1,campeonato_id:champ,etapa_id:source},{id:phase,nome:'Última',ordem:2,campeonato_id:champ,etapa_id:source}],
    campeonato_etapa_equipes:[0,1].map(n=>({id:id(20+n),campeonato_id:champ,etapa_id:destination,campeonato_equipe_id:id(200+n),status:'ativa',regra_progressao_id:null})),
    campeonato_progressao_execucoes:[],campeonato_equipes:[{id:id(100),campeonato_id:champ}],
  }
}
const run=()=>preview(champ,ruleId)
const invoke=(action='preview_progression')=>route.POST(new Request('https://fixture.invalid/api',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({action,rule_id:ruleId})}),{params:Promise.resolve({id:champ})})
let cases=0
// Preserve a concrete failure of the previous function, using its actual extracted source when available.
const before='relatorios-testes/banco-atual-2026-10-12/preview-before.ts'
if(fs.existsSync(before)){
  const code=ts.transpileModule('export '+fs.readFileSync(before,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}}
  new Function('exports','supabaseAdmin','listarEstatisticasEquipes',code)(module.exports,admin,statistics.listarEstatisticasEquipes)
  reset();const old=await module.exports.buildProgressionPreview(champ,ruleId)
  assert.equal(old.summary.occupied,1);assert.equal(old.summary.available,1);assert.equal(old.summary.canApply,true);cases++
  reset();tables.campeonato_etapa_equipes=[];tables.campeonato_etapas[1].capacidade_total=0
  const zero=await module.exports.buildProgressionPreview(champ,ruleId);assert.equal(zero.summary.capacity,null);assert.equal(zero.summary.canApply,true);cases++
}
reset();let result=await run();assert.equal(result.summary.occupied,2);assert.equal(result.summary.available,0);assert.equal(result.summary.canApply,false);cases++
assert.deepEqual(calls.filter(c=>c.table==='campeonato_etapa_equipes').map(c=>c.offset),[0,1,2]);cases++
for(const query of calls.filter(c=>c.table==='campeonato_etapa_equipes'||c.table==='campeonato_equipes')){
  assert.equal(query.params.campeonato_id,'eq.'+champ);assert.equal(query.params.order,'id.asc')
}cases++
assert.equal(calls[0].params['origem.campeonato_edicoes.campeonato_id'],'eq.'+champ);assert.ok(calls[0].params.select.includes('campeonato_progressao_regras_etapa_origem_id_fkey!inner'));cases++
for(const capacity of [0,1,3,null]){reset();tables.campeonato_etapas[1].capacidade_total=capacity;tables.campeonato_etapa_equipes=[];result=await run()
  assert.equal(result.summary.capacity,capacity);assert.equal(result.summary.available,capacity);assert.equal(result.summary.canApply,capacity!==0);cases++
}
reset();tables.campeonato_etapa_equipes[1].campeonato_equipe_id=id(100);result=await run();assert.equal(result.summary.conflictCount,1);assert.equal(result.summary.newCount,0);assert.equal(result.candidates[0].existingDestination.id,id(21));cases++
reset();tables.campeonato_etapa_equipes[1].campeonato_equipe_id=id(100);tables.campeonato_etapa_equipes[1].regra_progressao_id=ruleId
result=await run();assert.equal(result.summary.alreadyApplied,1);assert.equal(result.summary.conflictCount,0);cases++
reset();tables.campeonato_etapa_equipes.push({...tables.campeonato_etapa_equipes[0],id:id(99),status:'retirada'})
result=await run();assert.equal(result.summary.occupied,2);cases++
reset();tables.campeonato_etapa_equipes.push({...tables.campeonato_etapa_equipes[0],id:id(99),campeonato_id:id(999)})
result=await run();assert.equal(result.summary.occupied,2);cases++
reset();tables.campeonato_fases.push({...tables.campeonato_fases[1],id:id(9)})
result=await run();assert.equal(result.phase.id,phase);assert.equal(calls.find(c=>c.table==='campeonato_fases').limit,1);cases++
reset();tables.campeonato_progressao_execucoes=Array.from({length:301},(_,n)=>({id:id(500+n),campeonato_id:champ,regra_id:ruleId,status:'aplicada',created_at:n===300?'2026-10-12':'2026-10-11'}))
result=await run();assert.equal(result.activeExecution.id,id(800));assert.equal(calls.filter(c=>c.table==='campeonato_progressao_execucoes').length,1);assert.equal(calls.find(c=>c.table==='campeonato_progressao_execucoes').limit,1);cases++
reset();cap=7;ranking=Array.from({length:301},(_,n)=>({campeonato_equipe_id:id(1000+n),colocacao:n+1,nome:'Equipe '+n,pontos_total:301-n}))
tables.campeonato_equipes=ranking.map(row=>({id:row.campeonato_equipe_id,campeonato_id:champ}));tables.campeonato_progressao_regras[0].posicao_fim=301
tables.campeonato_etapas[1].capacidade_total=301;tables.campeonato_etapa_equipes=[]
result=await run();assert.equal(result.candidates.length,301);assert.equal(result.summary.newCount,301);assert.equal(result.summary.canApply,true)
assert.equal(Math.max(...calls.filter(c=>c.table==='campeonato_equipes').map(c=>c.params.id.slice(4,-1).split(',').length)),150);cases++
tables.campeonato_equipes.pop();await assert.rejects(run,/Participação fora deste campeonato/);cases++
for(const [table,offset]of[['campeonato_etapa_equipes',1],['campeonato_equipes',0],['campeonato_progressao_execucoes',0],['campeonato_fases',0],['campeonato_progressao_regras',0],['campeonato_etapas',0]]){
  reset();failTable=table;failOffset=offset;await assert.rejects(run);assert.ok(calls.every(c=>c.table!==undefined));cases++
}
for(const patch of [{posicao_inicio:0},{posicao_inicio:'1'},{posicao_fim:0},{posicao_fim:0.5},{posicao_fim:-1},{quantidade:0},{quantidade:1.5},{posicao_inicio:4,posicao_fim:3},{posicao_inicio:Number.MAX_SAFE_INTEGER,posicao_fim:null,quantidade:3}]){
  reset();Object.assign(tables.campeonato_progressao_regras[0],patch);await assert.rejects(run,/Faixa/);assert.equal(rankCalls,0);cases++
}
for(const capacity of [-1,1.5,'3',undefined,true]){reset();tables.campeonato_etapas[1].capacidade_total=capacity;await assert.rejects(run,/Capacidade/);assert.equal(rankCalls,0);cases++}
for(const invalid of [{campeonato_equipe_id:'bad',colocacao:1},{campeonato_equipe_id:id(100),colocacao:1.5},{campeonato_equipe_id:id(100),colocacao:'1'}]){reset();ranking=[invalid];await assert.rejects(run);cases++}
reset();ranking.push({...ranking[0]});await assert.rejects(run,/repetidos/);cases++
for(const bad of ['rule','source','destination']){reset();if(bad==='rule')tables.campeonato_progressao_regras[0].origem.campeonato_edicoes.campeonato_id=id(999)
  else tables.campeonato_etapas[bad==='source'?0:1].campeonato_edicoes.campeonato_id=id(999)
  await assert.rejects(run);assert.equal(rankCalls,0);cases++
}
reset();forceForeign=true;tables.campeonato_etapa_equipes[1].campeonato_id=id(999);await assert.rejects(run,/Vínculos/);cases++
reset();tables.campeonato_etapa_equipes[1].campeonato_equipe_id=tables.campeonato_etapa_equipes[0].campeonato_equipe_id;await assert.rejects(run,/Vínculos/);cases++
reset();tables.campeonato_progressao_regras[0].etapa_destino_id=source;await assert.rejects(run,/Regra inválida/);assert.equal(rankCalls,0);cases++
reset();tables.campeonato_progressao_regras[0].posicao_inicio=2;tables.campeonato_progressao_regras[0].posicao_fim=null;tables.campeonato_progressao_regras[0].quantidade=2
ranking=[1,2,3,4].map(n=>({campeonato_equipe_id:id(100+n),colocacao:n}));tables.campeonato_equipes=ranking.map(row=>({id:row.campeonato_equipe_id,campeonato_id:champ}))
result=await run();assert.deepEqual(result.candidates.map(row=>row.colocacao),[2,3]);cases++
reset();const response=await invoke();assert.equal(response.status,200);assert.equal((await response.json()).preview.summary.canApply,false);cases++
assert.equal(response.headers.get('cache-control'),'no-store');cases++
reset();failTable='campeonato_etapa_equipes';failOffset=1;const failure=await invoke();assert.equal(failure.status,400);assert.ok(!JSON.stringify(await failure.json()).includes('PRIVATE'));cases++
reset();tables.campeonato_etapa_equipes=[];tables.campeonato_etapas[1].capacidade_total=0
const apply=await invoke('apply_progression');assert.equal(apply.status,400);assert.match((await apply.json()).error,/vagas suficientes/);cases++
for(const allowed of ['no-auth','no-manage']){reset();auth=allowed!=='no-auth';manage=allowed!=='no-manage'
  const response=await invoke();assert.equal(response.status,allowed==='no-auth'?401:403);assert.equal(calls.length,0);cases++
}
for(const [championship,rule]of[['bad',ruleId],[champ,'bad']]){reset();await assert.rejects(()=>preview(championship,rule));assert.equal(calls.length,0);cases++}
console.log(`Progression preview passed: ${cases} fixtures; prior cap-one/zero-capacity failures reproduced, scoped paginated destination/participants, IN150, deterministic phase/execution, strict ranking/range/capacity, late read failure and auth-before-body. Controlled SDK/HTTP fixtures only; apply/reverse remain nontransactional.`)
