import assert from 'node:assert/strict'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),champ=id(2),version='2026-10-12T03:10:00.123456+00:00'
const move={mode:'move',source_slot_id:id(20),target_slot_id:id(22),source_participation_id:id(10),target_participation_id:null}
const swap={...move,mode:'swap',target_slot_id:id(21),target_participation_id:id(11)}
const expected={equipe_id:id(30),line_id:id(40),slot_id:null,status:'pendente',updated_at:version}
const participationContract={participation_write_mode:'atomic',participation_actor_id:actor},movementContract={slot_movement_mode:'atomic',slot_movement_actor_id:actor}
const forms=[['add',{slot_id:id(22),equipe_id:id(30),line_id:id(40)}],['add',{slot_id:id(22),equipe_id:id(30),line_id:null,nome_line:'Nova line'}],
 ['request',{equipe_id:id(30),line_id:id(40)}],['approve',{mode:'review_request',action:'approve',participacao_id:id(10),slot_id:id(22),expected}],
 ['reject',{mode:'review_request',action:'reject',participacao_id:id(10),motivo:'Revisar elenco',expected}],['remove',{expected:{...expected,slot_id:id(20),status:'ativo'}}],['move',move],['swap',swap]]
const values=new Map(),receipts=new Map(),calls=[]
let sessionActor=actor,sessionCalls=0,lost=false,bad=null,blocked=false,ignoredSet=false,ignoredRemove=false,changeAfterPersistence=false,hold=null,commits=0
const storage={getItem:async k=>{await Promise.resolve();if(blocked)throw Error('Storage blocked');return values.get(k)??null},setItem:async(k,v)=>{if(blocked)throw Error('Storage blocked');if(!ignoredSet)values.set(k,v);if(changeAfterPersistence)sessionActor=id(999)},removeItem:async k=>{if(!ignoredRemove)values.delete(k)}}
const load=()=>fixtureLoader({'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_,v)=>createHash('sha256').update(v).digest('hex'),randomUUID},
 [path.resolve('app/src/lib/secureStorage.ts')]:{secureStorage:storage},[path.resolve('app/src/lib/supabase.ts')]:{supabase:{auth:{getSession:async()=>{sessionCalls++;return {data:{session:sessionActor?{user:{id:sessionActor},access_token:'FRESH-'+sessionCalls}:null}}}}}},'@/config/env':{apiUrl:p=>'https://mobile-operation-fixture.invalid'+p}})
const originalFetch=globalThis.fetch
function reset(){values.clear();receipts.clear();calls.length=0;sessionActor=actor;sessionCalls=0;lost=false;bad=null;blocked=false;ignoredSet=false;ignoredRemove=false;changeAfterPersistence=false;hold=null;commits=0}
function success(championship,method,body,removal){
 if(['move','swap'].includes(body.mode))return {ok:true,campeonato_id:championship,action:body.mode,...body,participacoes:[{id:body.source_participation_id,equipe_id:id(30),line_id:id(40),slot_id:body.target_slot_id,grupo_id:id(50),slot_numero:2,updated_at:version},
  ...(body.mode==='swap'?[{id:body.target_participation_id,equipe_id:id(31),line_id:id(41),slot_id:body.source_slot_id,grupo_id:id(50),slot_numero:1,updated_at:version}]:[])]}
 const action=method==='DELETE'?'remove':method==='PATCH'?body.action:body.mode==='request'?'request':'add',location=['add','approve'].includes(action)
 return {ok:true,operation_confirmed:true,campeonato_id:championship,action,participacao:{id:removal||body.participacao_id||id(10),campeonato_id:championship,
  equipe_id:body.expected?.equipe_id||body.equipe_id,line_id:body.expected?.line_id||body.line_id||id(40),status:action==='remove'?'removido':action==='reject'?'rejeitado':action==='request'?'pendente':'ativo',
  slot_id:location?body.slot_id:null,grupo_id:location?id(50):null,slot_numero:location?2:null,updated_at:version,...(action==='reject'?{motivo_rejeicao:body.motivo}:{})},
  ...(['add','approve','request'].includes(action)?{line:{id:body.expected?.line_id||body.line_id||id(40),nome:'Line',criada_agora:false}}:{})}
}
function send(api,action,body,mode='atomic',championship=champ){
 const p={...participationContract,participation_write_mode:mode},m={...movementContract,slot_movement_mode:mode}
 if(['move','swap'].includes(action))return api.moveChampionshipSlot(championship,body,m,'STALE-TOKEN',actor)
 if(action==='add')return api.addChampionshipTeamToSlot(championship,body,p,'STALE-TOKEN',actor)
 if(action==='request')return api.requestChampionshipEntry(championship,body,p,'STALE-TOKEN',actor)
 if(action==='remove')return api.removeChampionshipParticipation(championship,id(10),p,body.expected,'STALE-TOKEN',actor)
 return api.reviewChampionshipEntry(championship,body,p,'STALE-TOKEN',actor)
}
globalThis.fetch=async(url,options)=>{
 const parsed=new URL(url),body=JSON.parse(options.body),headers=new Headers(options.headers),key=headers.get('Idempotency-Key'),championship=parsed.pathname.split('/')[3]
 assert.equal(parsed.hostname,'mobile-operation-fixture.invalid');assert.ok(headers.get('Authorization').startsWith('Bearer FRESH-'));assert.equal(options.cache,'no-store')
 calls.push({url,body,key,method:options.method,token:headers.get('Authorization')});if(hold)await hold
 if(!key)return Response.json({ok:true})
 if(receipts.has(key))return Response.json({...receipts.get(key),repetida:true})
 const data=success(championship,options.method,body,parsed.searchParams.get('participacao_id'));commits++;receipts.set(key,data)
 if(lost){lost=false;throw Error('Lost after commit')}
 return Response.json(bad?bad(structuredClone(data)):data)
}
let cases=0
try{
 for(const [action,body] of forms){
  reset();lost=true;const loader=load(),api=loader('app/src/lib/api.ts').mobileApi
  await assert.rejects(()=>send(api,action,{...body,token:'EXTRA-SECRET',actor_id:id(999)}),/Lost/);assert.equal(commits,1);assert.equal(values.size,1);assert.ok(!JSON.stringify([...values]).includes('TOKEN'));assert.ok(!JSON.stringify([...values]).includes('EXTRA'));cases++
  const restarted=load(),pending=['move','swap'].includes(action)?await restarted('app/src/lib/slot-transfer-attempt.ts').readPendingMobileSlotTransfer(actor,champ):await restarted('app/src/lib/participation-attempt.ts').participationAttempts.read(actor,champ)
  assert.equal((await send(restarted('app/src/lib/api.ts').mobileApi,action,pending.body)).repetida,true);assert.equal(calls[0].key,calls[1].key);assert.deepEqual(calls[0].body,calls[1].body);assert.equal(commits,1);assert.equal(values.size,0);cases++
  reset();const shared=load()('app/src/lib/api.ts').mobileApi;let release;hold=new Promise(r=>release=r)
  const six=Array.from({length:6},()=>send(shared,action,body));await new Promise(r=>setTimeout(r,15));assert.equal(calls.length,1);release();await Promise.all(six);assert.equal(commits,1);cases++
  reset();await send(load()('app/src/lib/api.ts').mobileApi,action,body,'legacy');assert.equal(calls[0].key,null);assert.equal(values.size,0);cases++
  for(const mutate of [r=>({ok:true}),r=>({...r,campeonato_id:id(999)}),r=>({...r,action:'invalid'})]){
   reset();bad=mutate;await assert.rejects(()=>send(load()('app/src/lib/api.ts').mobileApi,action,body),/confirmar/);assert.equal(values.size,1);cases++
  }
  for(const failure of ['blocked','ignoredSet','sessionChanged','missingSession']){
   reset();blocked=failure==='blocked';ignoredSet=failure==='ignoredSet';changeAfterPersistence=failure==='sessionChanged';if(failure==='missingSession')sessionActor=null
   await assert.rejects(()=>send(load()('app/src/lib/api.ts').mobileApi,action,body));assert.equal(calls.length,0);assert.equal(values.size,failure==='sessionChanged'?1:0);cases++
  }
 }
 for(const [action,body] of forms.slice(0,6))for(const first of ['participation','movement']){
  reset();const loader=load(),api=loader('app/src/lib/api.ts').mobileApi
  if(first==='movement')await loader('app/src/lib/slot-transfer-attempt.ts').prepareMobileSlotTransfer(actor,champ,move)
  else await loader('app/src/lib/participation-attempt.ts').participationAttempts.prepare(actor,champ,loader('backend/src/campeonatos/participation-contract.ts').participationIntent(action==='remove'?'DELETE':['approve','reject'].includes(action)?'PATCH':'POST',action==='request'?{...body,mode:'request'}:body,action==='remove'?id(10):undefined))
  for(const mode of ['atomic','legacy']){
   await assert.rejects(()=>first==='movement'?send(api,action,body,mode):send(api,'move',move,mode),/aguardando/);assert.equal(calls.length,0);assert.equal(values.size,1);cases++
  }
 }
 for(const [action,body] of forms.slice(0,6))for(const first of ['participation','movement']){
  reset();const api=load()('app/src/lib/api.ts').mobileApi;let release;hold=new Promise(r=>release=r)
  const primary=first==='movement'?send(api,'move',move):send(api,action,body)
  await new Promise(r=>setTimeout(r,15));await assert.rejects(()=>first==='movement'?send(api,action,body):send(api,'move',move),/andamento/);assert.equal(calls.length,1);assert.equal(values.size,1);release();await primary;cases++
 }
 for(const family of ['movement','participation']){
  reset();const loader=load(),api=loader('app/src/lib/api.ts').mobileApi;lost=true
  await assert.rejects(()=>family==='movement'?send(api,'move',move):send(api,'add',forms[0][1]));const pending=family==='movement'?await loader('app/src/lib/slot-transfer-attempt.ts').readPendingMobileSlotTransfer(actor,champ):await loader('app/src/lib/participation-attempt.ts').participationAttempts.read(actor,champ)
  const discard=loader('app/src/lib/championship-discard.ts').discardMobileChampionshipAttempt
  sessionActor=id(999);await assert.rejects(()=>discard(champ,actor,family,pending),/conta mudou/);assert.equal(values.size,1);cases++
  sessionActor=actor;ignoredRemove=true;await assert.rejects(()=>discard(champ,actor,family,pending),/encerrar/);assert.equal(values.size,1);cases++
  await (family==='movement'?send(api,'move',move):send(api,'add',forms[0][1]));assert.equal(values.size,1);assert.equal(commits,1);cases++
  ignoredRemove=false;await assert.rejects(()=>discard(champ,actor,family,{...pending,requestId:id(999)}),/tentativa mudou/);assert.equal(values.size,1);cases++
  const before=calls.length;await discard(champ,actor,family,pending);assert.equal(values.size,0);assert.equal(calls.length,before);cases++
 }
 reset();const loader=load(),api=loader('app/src/lib/api.ts').mobileApi;let release;hold=new Promise(r=>release=r)
 const waiting=send(api,'move',move);await new Promise(r=>setTimeout(r,15));const saved=await loader('app/src/lib/slot-transfer-attempt.ts').readPendingMobileSlotTransfer(actor,champ)
 await assert.rejects(()=>loader('app/src/lib/championship-discard.ts').discardMobileChampionshipAttempt(champ,actor,'movement',saved),/andamento/);assert.equal(values.size,1);release();await waiting;cases++
 reset();sessionActor=id(999);await assert.rejects(()=>send(load()('app/src/lib/api.ts').mobileApi,'move',move),/conta mudou/);assert.equal(calls.length,0);assert.equal(values.size,0);cases++
 reset();const inconsistent=load(),a=inconsistent('app/src/lib/api.ts').mobileApi,part=inconsistent('app/src/lib/participation-attempt.ts').participationAttempts
 const p=await part.prepare(actor,champ,inconsistent('backend/src/campeonatos/participation-contract.ts').participationIntent('POST',forms[0][1]));const m=await inconsistent('app/src/lib/slot-transfer-attempt.ts').prepareMobileSlotTransfer(actor,champ,move)
 await assert.rejects(()=>send(a,'move',move),/aguardando/);await assert.rejects(()=>send(a,'add',forms[0][1]),/aguardando/);assert.equal(calls.length,0);assert.equal(values.size,2);cases++
 await inconsistent('app/src/lib/championship-discard.ts').discardMobileChampionshipAttempt(champ,actor,'movement',m);await send(a,'add',forms[0][1]);assert.equal(calls[0].key,p.requestId);assert.equal(values.size,0);cases++
 console.log(`Mobile championship operations passed: ${cases} fixtures; eight actions, cross-family lease/pending guards, strict DTO, fresh session/token, durable replay and scoped explicit discard.`)
}finally{globalThis.fetch=originalFetch}
