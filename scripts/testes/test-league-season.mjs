import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
let tables,calls,rankReads,allow,permissionError,cap=1,lateError
const champ=id(1),previous=id(2),actor=id(3)
const division=(id,name,type='mantida',qty='2',origin='')=>({id,nome:name,codigo:'A',equipes:'4',entradas:[{id:'entry',tipo:type,quantidade:qty,origem_agrupamento_id:origin}]})
const current={nome_agrupamento:'Divisões',divisoes:[division('a','Divisão A')]},prior={nome_agrupamento:'Divisões',divisoes:[{...division('a','Divisão A'),entradas:[]}]}
const ranking=Array.from({length:6},(_,n)=>({equipe_id:id(100+n),line_id:id(200+n),colocacao:n+1,nome:'Team '+n,tag:null,logo_url:null}))
const admin=createClient('https://season-reader-fixture.supabase.co','fixture',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
 const url=new URL(input),table=url.pathname.split('/').at(-1),offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000)
 assert.equal(options.method||'GET','GET');calls.push({table,offset,params:Object.fromEntries(url.searchParams)})
 if(lateError&&table==='campeonato_grupos'&&offset>=1)return Response.json({code:'XX000',message:'PRIVATE late database error'},{status:500})
 let rows=(tables[table]||[]).filter(row=>[...url.searchParams].every(([key,value])=>value.startsWith('eq.')?String(row[key])===value.slice(3):value.startsWith('lt.')?row[key]<Number(value.slice(3)):true))
 const orders=(url.searchParams.get('order')||'').split(',').filter(Boolean)
 rows.sort((a,b)=>{for(const item of orders){const [key,direction]=item.split('.'),difference=typeof a[key]==='number'?a[key]-b[key]:String(a[key]).localeCompare(String(b[key]));if(difference)return direction==='desc'?-difference:difference}return 0})
 rows=rows.slice(offset,offset+Math.min(limit,cap));return Response.json(rows)
}}})
const load=()=>fixtureLoader({'@backend/shared/supabase-admin':{supabaseAdmin:admin},
 '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>{if(permissionError)throw Error('PRIVATE permission database');return{canView:allow,canManage:allow,role:allow?'owner':'none'}}},
 '@backend/campeonatos/liga-config':{loadLigaConfig:async()=>prior},
 '@backend/campeonatos/estatisticas/estatisticas.service':{listarEstatisticasEquipes:async()=>{rankReads++;return ranking}},
})
function reset(){calls=[];rankReads=0;allow=true;permissionError=false;lateError=false;tables={campeonato_edicoes:[{id:id(10),campeonato_id:champ,franquia_id:id(11),numero_edicao:2,temporada:'Current'},{id:id(12),campeonato_id:previous,franquia_id:id(11),numero_edicao:1,temporada:'Previous'}],campeonato_grupos:[{id:id(20),campeonato_id:previous,nome:'Unused'},{id:id(21),campeonato_id:previous,nome:'Divisão A'}]}}
let cases=0
const check=async(name,body)=>{await body();cases++;console.log('PASS '+name)}
const read=()=>load()('backend/src/campeonatos/league-season-read.ts').loadLeagueSeasonSuggestions(champ,current,actor)
const pure=load()('backend/src/campeonatos/league-season-plan.ts')
await check('cap-one groups are complete and scoped before ranking',async()=>{reset();const result=await read();assert.equal(result.suggestions[0].candidatos.length,2);assert.equal(rankReads,1);assert.ok(calls.filter(x=>x.table==='campeonato_grupos').length>=3);assert.ok(calls.filter(x=>x.table==='campeonato_grupos').every(x=>x.params.campeonato_id==='eq.'+previous))})
await check('previous private data is not read without previous management access',async()=>{reset();allow=false;assert.equal(await read(),null);assert.equal(rankReads,0);assert.ok(!calls.some(x=>x.table==='campeonato_grupos'))})
await check('duplicate group names refuse instead of first-match selection',async()=>{reset();tables.campeonato_grupos.push({id:id(22),campeonato_id:previous,nome:'DIVISÃO A'});await assert.rejects(read,/ambíguo/);assert.equal(rankReads,0)})
await check('late page failure is sanitized and no partial preview returned',async()=>{reset();lateError=true;await assert.rejects(read,error=>!error.message.includes('PRIVATE')&&error.message.includes('Não foi possível'));assert.equal(rankReads,0)})
await check('permission diagnostics are never public',async()=>{reset();permissionError=true;await assert.rejects(read,error=>!error.message.includes('PRIVATE'))})
await check('without actor no private season query',async()=>{reset();assert.equal(await load()('backend/src/campeonatos/league-season-read.ts').loadLeagueSeasonSuggestions(champ,current,null),null);assert.equal(calls.length,0)})
for(const qty of ['-1','1.5','NaN','Infinity','1e2',true,null,[],{},'','9007199254740992'])await check('invalid quantity refuses '+JSON.stringify(qty),async()=>{assert.throws(()=>pure.seasonQuantity(qty))})
for(const qty of [0,1,'001',' 2 ',9007199254740991])await check('valid integer quantity '+JSON.stringify(qty),async()=>{assert.equal(pure.seasonQuantity(qty),Number(qty))})
await check('promotion/relegation/retention preserve the existing allocation order',async()=>{
 const plan={nome_agrupamento:'Divisões',divisoes:[division('top','Top','promovida','1','a'),division('a','Divisão A','mantida','3'),division('bottom','Bottom','rebaixada','2','a')]}
 const result=pure.buildLeagueSeasonSuggestions(plan,prior,new Map([['a',ranking]]));assert.deepEqual(result.map(x=>x.candidatos.map(c=>c.colocacao)),[[1],[2,3,4],[5,6]])
})
await check('duplicate candidates across repeated retained entries refuse',async()=>{const plan=structuredClone(current);plan.divisoes[0].entradas.push({...plan.divisoes[0].entradas[0],id:'second'});assert.throws(()=>pure.buildLeagueSeasonSuggestions(plan,prior,new Map([['a',ranking]])),/mais de uma sugestão/)})
await check('duplicate plan names and unknown source refuse',async()=>{const plan=structuredClone(current);plan.divisoes.push(division('other','DIVISÃO A'));assert.throws(()=>pure.validateSeasonPlan(plan),/ambíguos/);assert.throws(()=>pure.buildLeagueSeasonSuggestions({nome_agrupamento:'Divisões',divisoes:[division('x','X','promovida','1','absent')]},prior,new Map()),/não foi encontrada/)})
console.log(`League season reader/selection: ${cases} checks passed; synthetic SDK HTTP, no real project access or writes.`)
