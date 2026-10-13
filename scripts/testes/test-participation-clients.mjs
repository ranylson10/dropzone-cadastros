import assert from 'node:assert/strict'
import path from 'node:path'
import {createHash,randomUUID,webcrypto} from 'node:crypto'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),champ=id(2),atomic={participation_write_mode:'atomic',participation_actor_id:actor}
const expected={equipe_id:id(5),line_id:id(6),slot_id:null,status:'pendente',updated_at:'2026-10-11T13:00:00.123456+00:00'}
const forms=[['POST',{equipe_id:id(5),line_id:id(6),slot_id:id(7)}],['POST',{equipe_id:id(5),line_id:null,slot_id:id(7),nome_line:'Nova line'}],
 ['POST',{mode:'request',equipe_id:id(5),line_id:id(6)}],['PATCH',{mode:'review_request',action:'approve',participacao_id:id(8),slot_id:id(7),expected}],
 ['PATCH',{mode:'review_request',action:'reject',participacao_id:id(8),motivo:'Revisar elenco',expected}],['DELETE',{expected:{...expected,status:'ativo',slot_id:id(7)}},id(8)]]
const values=new Map(),receipts=new Map(),calls=[]
let blocked=false,ignoredSet=false,ignoredRemove=false,lost=false,bad=false,commits=0,sessionActor=actor,sessionCalls=0,changeAccount=false,hold=null
const storage={getItem:async k=>{await Promise.resolve();if(blocked)throw Error('Storage blocked');return values.get(k)??null},
 setItem:async(k,v)=>{if(blocked)throw Error('Storage blocked');if(!ignoredSet)values.set(k,v)},removeItem:async k=>{if(!ignoredRemove)values.delete(k)}}
const overrides={
 '@backend/shared/supabase-admin':{supabaseAdmin:{}},
 '@/lib/supabase-browser': { supabase: { auth: { getSession: async () => {
   sessionCalls++
   return {data:{session:sessionActor?{user:{id:changeAccount&&sessionCalls>1?id(999):sessionActor},access_token:'PRIVATE-TOKEN'}:null}}
 } } } },
 'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_,value)=>createHash('sha256').update(value).digest('hex'),randomUUID},
 [path.resolve('app/src/lib/secureStorage.ts')]:{secureStorage:storage},'@/config/env':{apiUrl:p=>'https://fixture.invalid'+p},
 [path.resolve('app/src/lib/supabase.ts')]:{supabase:{auth:{getSession:async()=>{sessionCalls++;return {data:{session:sessionActor?{user:{id:changeAccount&&sessionCalls>1?id(999):sessionActor},access_token:'PRIVATE-TOKEN'}:null}}}}}},
}
const load=()=>fixtureLoader(overrides)
const originalFetch=globalThis.fetch,originalStorage=globalThis.sessionStorage,originalCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto')
globalThis.sessionStorage={getItem:k=>{if(blocked)throw Error('Storage blocked');return values.get(k)??null},
 setItem:(k,v)=>{if(blocked)throw Error('Storage blocked');if(!ignoredSet)values.set(k,v)},removeItem:k=>{if(!ignoredRemove)values.delete(k)}}
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true})
function reset(){values.clear();receipts.clear();calls.length=0;commits=0;lost=false;bad=false;blocked=false;ignoredSet=false;ignoredRemove=false;sessionActor=actor;sessionCalls=0;changeAccount=false;hold=null}
function success(method,body,remove){
 const action=method==='DELETE'?'remove':method==='PATCH'?body.action:body.mode==='request'?'request':'add'
 const location=['add','approve'].includes(action),status=action==='remove'?'removido':action==='reject'?'rejeitado':action==='request'?'pendente':'ativo'
 return {ok:true,operation_confirmed:true,campeonato_id:champ,action,participacao:{id:remove||body.participacao_id||id(8),campeonato_id:champ,
  equipe_id:body.expected?.equipe_id||body.equipe_id,line_id:body.expected?.line_id||body.line_id||id(6),status,
  slot_id:location?body.slot_id:null,grupo_id:location?id(9):null,slot_numero:location?1:null,updated_at:expected.updated_at,
  ...(action==='reject'?{motivo_rejeicao:body.motivo}: {})},
  ...(['add','approve','request'].includes(action)?{line:{id:body.expected?.line_id||body.line_id||id(6),nome:'Line',criada_agora:false}}:{})}
}
globalThis.fetch=async(url,options)=>{
 const parsed=new URL(url,'https://fixture.invalid'),headers=new Headers(options.headers),body=JSON.parse(options.body),key=headers.get('Idempotency-Key')
 assert.equal(headers.get('Authorization'),'Bearer PRIVATE-TOKEN');;assert.equal(parsed.pathname,`/api/campeonatos/${champ}/equipes${key?'/participacao-atomica':''}`);calls.push({path:parsed.pathname,query:parsed.search,method:options.method,key,body})
 if(hold)await hold
 if(!key)return Response.json({ok:true})
 const data=success(options.method,body,parsed.searchParams.get('participacao_id')),previous=receipts.get(key)
 if(previous)return Response.json({...previous,repetida:true})
 commits++;receipts.set(key,data)
 if(lost){lost=false;throw Error('Lost after commit')}
 return Response.json(bad?{ok:true}:data)
}
let cases=0
try{
 const contract=load()('backend/src/campeonatos/participation-contract.ts')
 for(const environment of ['web','mobile']){
  const modulePath=environment==='web'?'web/lib/participation-write.ts':'app/src/lib/participation-write.ts'
  const adapter=()=>load()(modulePath)
  const send=(api,method,body,remove,metadata=atomic)=>environment==='web'?api.writeParticipation(champ,metadata,method,body,remove):api.writeMobileParticipation(champ,metadata,method,body,'PRIVATE-TOKEN',sessionActor,remove)
  for(const [method,body,remove] of forms){
   reset();lost=true;const api=adapter()
   await assert.rejects(()=>send(api,method,{...body,token:'EXTRA-SECRET',actor_id:id(999),permission:'owner'},remove),/Lost|conectar/)
   assert.equal(values.size,1);assert.equal(commits,1);assert.ok(!JSON.stringify([...values]).includes('PRIVATE-TOKEN'));assert.ok(!JSON.stringify([...values]).includes('EXTRA-SECRET'));cases++
   const restarted=adapter(),pending=await restarted.participationAttempts.read(actor,champ)
   assert.equal((await send(restarted,pending.method,pending.body,pending.participationId||undefined)).repetida,true)
   assert.equal(calls[0].key,calls[1].key);assert.deepEqual(calls[0].body,calls[1].body);assert.equal(commits,1);assert.equal(values.size,0);cases++
   if(method==='DELETE')assert.equal(calls[0].query,'?participacao_id='+remove)
   if(body.expected)assert.equal(calls[0].body.expected.updated_at,expected.updated_at)
  }
  reset();const api=adapter(),[method,body]=forms[0],intent=contract.participationIntent(method,body)
  const attempt=await api.participationAttempts.prepare(actor,champ,intent)
  await assert.rejects(()=>send(api,method,{...body,slot_id:id(10)}),/pendente/);assert.equal(calls.length,0);cases++
  for(const [otherActor,otherChamp] of [[id(99),champ],[actor,id(99)]]){assert.equal(await api.participationAttempts.read(otherActor,otherChamp),null);cases++}
  await api.participationAttempts.complete({...attempt,requestId:id(999)});assert.equal(values.size,1);cases++
  await api.participationAttempts.discard(attempt);assert.equal(values.size,0);cases++
  reset();bad=true;await assert.rejects(()=>send(adapter(),method,body),/confirmar o resultado/);assert.equal(values.size,1);cases++
  reset();blocked=true;await assert.rejects(()=>send(adapter(),method,body),/armazenamento/);assert.equal(calls.length,0);cases++
  reset();ignoredSet=true;await assert.rejects(()=>send(adapter(),method,body),/guardar/);assert.equal(calls.length,0);cases++
  reset();const parallel=adapter();let release;hold=new Promise(r=>{release=r})
  const requests=Array.from({length:6},()=>send(parallel,method,body));await new Promise(r=>setTimeout(r,25));assert.equal(calls.length,1);release();await Promise.all(requests);assert.equal(commits,1);cases++
  reset();await send(adapter(),method,body,undefined,{participation_write_mode:'legacy'});assert.equal(calls[0].key,null);assert.equal(values.size,0);cases++
  reset();const waiting=adapter();await waiting.participationAttempts.prepare(actor,champ,intent)
  await assert.rejects(()=>send(waiting,method,body,undefined,{participation_write_mode:'legacy'}),/aguardando/);assert.equal(calls.length,0);cases++
  reset();await assert.rejects(()=>send(adapter(),method,body,undefined,{...atomic,participation_actor_id:id(999)}),/conta mudou/);assert.equal(calls.length,0);assert.equal(values.size,0);cases++
  reset();sessionActor=null;await assert.rejects(()=>send(adapter(),method,body),/Entre novamente/);assert.equal(calls.length,0);cases++
  reset();const broken=adapter(),stored=await broken.participationAttempts.prepare(actor,champ,intent)
  values.set(stored.storageKey,'corrupt');await assert.rejects(()=>broken.participationAttempts.read(actor,champ),/ler/);await assert.rejects(()=>send(broken,method,body),/ler/);assert.equal(calls.length,0);cases++
  reset();const kept=adapter(),saved=await kept.participationAttempts.prepare(actor,champ,intent);ignoredRemove=true
  await assert.rejects(()=>kept.participationAttempts.discard(saved),/encerrar/);await kept.participationAttempts.complete(saved);assert.equal(values.size,1);cases++
  if(environment==='web'){reset();changeAccount=true;await assert.rejects(()=>send(adapter(),method,body),/conta mudou/);assert.equal(calls.length,0);assert.equal(values.size,1);cases++}
 }
 for(const invalid of [{method:'PATCH',body:{}},{method:'POST',body:{mode:'apply_league_season_suggestions'}},
  ...[{...expected,slot_id:undefined},{...expected,updated_at:'2026-10-11T13:00:00.1234567Z'}, {...expected,line_id:'bad'}, {...expected,status:'ativo'}].map(expected=>({method:'PATCH',body:{...forms[3][1],expected}})),
  {method:'DELETE',body:{expected},participationId:id(8)},{method:'POST',body:{...forms[1][1],nome_line:'x'.repeat(121)}},
  {method:'PATCH',body:{...forms[4][1],motivo:'x'.repeat(501)}}]){assert.throws(()=>contract.participationIntent(invalid.method,invalid.body,invalid.participationId));cases++}
 const snapshot=load()('backend/src/campeonatos/participation-snapshot.ts').participationSnapshot
 const row={...expected,id:id(8),campeonato_id:champ,grupo_id:id(9),slot_numero:1,slot_id:id(7),status:'ativo',criado_por:'PRIVATE'},slot={id:id(7),equipe_id:id(5),line_id:id(6),grupo_id:id(9),slot_numero:1}
 assert.equal(snapshot(row,champ,slot).updated_at,expected.updated_at);assert.ok(!JSON.stringify(snapshot(row,champ,slot)).includes('PRIVATE'));cases++
 for(const bad of [{...row,campeonato_id:id(99)},{...row,slot_id:id(99)},{...row,equipe_id:id(99)},{...row,line_id:id(99)},{...row,grupo_id:id(99)},{...row,slot_numero:2},{...row,updated_at:'bad'}]){assert.equal(snapshot(bad,champ,slot),null);cases++}
 console.log(`Participation clients passed: ${cases} fixtures; six actions, lost response/restart/replay, exact version, account isolation, one request for duplicate taps, private storage, DTO/snapshot and legacy boundaries.`)
}finally{globalThis.fetch=originalFetch;if(originalStorage===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=originalStorage;if(originalCrypto)Object.defineProperty(globalThis,'crypto',originalCrypto);else delete globalThis.crypto}
