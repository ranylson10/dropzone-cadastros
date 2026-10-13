import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),champ=id(2),version='2026-10-11T13:00:00.123456+00:00'
const expected=[0,1].map(n=>({id:id(10+n),slot_id:id(20+n),equipe_id:id(30+n),line_id:id(40+n),updated_at:version}))
const forms=[{mode:'move',source_slot_id:id(20),target_slot_id:id(22),source_participation_id:id(10),target_participation_id:null},
 {mode:'swap',source_slot_id:id(20),target_slot_id:id(21),source_participation_id:id(10),target_participation_id:id(11)},
 {mode:'shuffle_group',group_id:id(50),expected},
 ...['balanced','random'].map(strategy=>({mode:'distribute_phase',phase_id:id(60),group_ids:[id(50),id(51)],strategy,expected}))]
const contract={slot_movement_mode:'atomic',slot_movement_actor_id:actor},participation={participation_write_mode:'atomic',participation_actor_id:actor}
const values=new Map(),receipts=new Map(),calls=[]
let blocked=false,ignoredSet=false,ignoredRemove=false,lost=false,bad=null,hold=null,entered=null,sessionActor=actor,sessionCalls=0,changeAccount=false,commits=0
const originalFetch=globalThis.fetch,originalStorage=globalThis.sessionStorage,originalCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto')
globalThis.sessionStorage={getItem:k=>{if(blocked)throw Error('Blocked');return values.get(k)??null},setItem:(k,v)=>{if(blocked)throw Error('Blocked');if(!ignoredSet)values.set(k,v)},removeItem:k=>{if(!ignoredRemove)values.delete(k)}}
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true})
const loader=()=>fixtureLoader({'@/lib/supabase-browser':{supabase:{auth:{getSession:async()=>{sessionCalls++;return {data:{session:sessionActor?{user:{id:changeAccount&&sessionCalls>1?id(999):sessionActor},access_token:'PRIVATE-'+sessionCalls}:null}}}}}}})
function reset(){values.clear();receipts.clear();calls.length=0;blocked=false;ignoredSet=false;ignoredRemove=false;lost=false;bad=null;hold=null;entered=null;sessionActor=actor;sessionCalls=0;changeAccount=false;commits=0}
function requestEntered(){let timer;const promise=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Fixture HTTP did not start')),5000);entered=resolve});return promise.finally(()=>clearTimeout(timer))}
function success(body){
 if(['move','swap'].includes(body.mode))return {ok:true,campeonato_id:champ,action:body.mode,...body,participacoes:[
  {...expected[0],slot_id:body.target_slot_id,grupo_id:id(50),slot_numero:2},...(body.mode==='swap'?[{...expected[1],slot_id:body.source_slot_id,grupo_id:id(50),slot_numero:1}]:[])]}
 const groups=body.mode==='shuffle_group'?[body.group_id]:body.group_ids
 return {ok:true,operation_confirmed:true,campeonato_id:champ,action:body.mode==='shuffle_group'?'shuffle':'distribute',mode:body.mode,
  phase_id:body.phase_id??null,group_ids:groups,strategy:body.strategy??null,
  participacoes:body.expected.map((p,n)=>({...p,slot_id:id(70+n),grupo_id:groups[n%groups.length],slot_numero:n+1})),
  distribuicao:groups.map((grupo_id,n)=>({grupo_id,equipes:body.expected.filter((_,i)=>i%groups.length===n).length}))}
}
globalThis.fetch=async(url,options)=>{
 const headers=new Headers(options.headers),body=JSON.parse(options.body),key=headers.get('Idempotency-Key')
 calls.push({url,method:options.method,body,key,token:headers.get('Authorization')});assert.ok(headers.get('Authorization').startsWith('Bearer PRIVATE-'));assert.equal(options.cache,'no-store');assert.equal(new URL(url,'https://fixture.invalid').pathname,`/api/campeonatos/${champ}/equipes${key?(['move','swap','shuffle_group','distribute_phase'].includes(body.mode)?'/movimentacao-atomica':'/participacao-atomica'):''}`)
 entered?.()
 if(hold)await hold
 if(!key)return Response.json({ok:true})
 if(receipts.has(key))return Response.json({...receipts.get(key),repetida:true})
 const data=success(body);commits++;receipts.set(key,data)
 if(lost){lost=false;throw Error('Lost after commit')}
 return Response.json(bad?bad(structuredClone(data)):data)
}
let cases=0
try{
 const pure=loader()('backend/src/campeonatos/slot-movement-contract.ts')
 for(const body of forms){
  reset();lost=true;const api=loader()('web/lib/slot-movement-write.ts')
  await assert.rejects(()=>api.writeSlotMovement(champ,contract,{...body,token:'EXTRA-SECRET',actor_id:id(999)}),/Lost/)
  assert.equal(values.size,1);assert.equal(commits,1);assert.ok(!JSON.stringify([...values]).includes('PRIVATE'));assert.ok(!JSON.stringify([...values]).includes('EXTRA'));cases++
  const restarted=loader()('web/lib/slot-movement-write.ts'),pending=await restarted.slotMovementAttempts.read(actor,champ)
  assert.equal((await restarted.writeSlotMovement(champ,contract,pending.body)).repetida,true);assert.deepEqual(calls[1].body,calls[0].body);assert.equal(calls[1].key,calls[0].key);assert.equal(commits,1);assert.equal(values.size,0);cases++
  if(body.expected)assert.equal(calls[0].body.expected[0].updated_at,version)
  reset();const concurrent=loader()('web/lib/slot-movement-write.ts');let release;hold=new Promise(r=>release=r)
  const waiting=requestEntered(),six=Array.from({length:6},()=>concurrent.writeSlotMovement(champ,contract,body));await waiting;assert.equal(calls.length,1);release();await Promise.all(six);assert.equal(commits,1);cases++
  reset();await loader()('web/lib/slot-movement-write.ts').writeSlotMovement(champ,{slot_movement_mode:'legacy'},body);assert.equal(calls[0].key,null);assert.equal(values.size,0);cases++
 }
 const corrupt=[r=>({ok:true}),r=>({...r,campeonato_id:id(999)}),r=>({...r,action:'remove'}),r=>({...r,participacoes:[]}),
  r=>({...r,participacoes:r.participacoes.map(p=>({...p,updated_at:'bad'}))}),r=>({...r,participacoes:r.participacoes.map(p=>({...p,slot_id:id(999)}))})]
 for(const body of forms)for(const mutate of corrupt){reset();bad=mutate;await assert.rejects(()=>loader()('web/lib/slot-movement-write.ts').writeSlotMovement(champ,contract,body),/confirmar a movimentação/);assert.equal(values.size,1);cases++}
 for(const mutate of [r=>({...r,operation_confirmed:false}),r=>({...r,group_ids:[id(999)]}),r=>({...r,strategy:'random'}),r=>({...r,distribuicao:[{grupo_id:id(50),equipes:999}]}),r=>({...r,participacoes:r.participacoes.map(p=>({...p,line_id:id(999)}))})]){
  reset();bad=mutate;await assert.rejects(()=>loader()('web/lib/slot-movement-write.ts').writeSlotMovement(champ,contract,forms[3]),/confirmar a movimentação/);assert.equal(values.size,1);cases++
 }
 for(const fault of ['blocked','ignoredSet','actor','noSession','changedActor']){
  reset();if(fault==='blocked')blocked=true;if(fault==='ignoredSet')ignoredSet=true;if(fault==='noSession')sessionActor=null;if(fault==='changedActor')changeAccount=true
  await assert.rejects(()=>loader()('web/lib/slot-movement-write.ts').writeSlotMovement(champ,fault==='actor'?{...contract,slot_movement_actor_id:id(999)}:contract,forms[0]));assert.equal(calls.length,0);assert.equal(values.size,fault==='changedActor'?1:0);cases++
 }
 reset();await assert.rejects(()=>loader()('web/lib/slot-movement-write.ts').writeSlotMovement(champ,{slot_movement_mode:'legacy',slot_movement_actor_id:id(999)},forms[0]),/conta mudou/);assert.equal(calls.length,0);cases++
 reset();const api=loader()('web/lib/slot-movement-write.ts'),saved=await api.slotMovementAttempts.prepare(actor,champ,forms[0])
 for(const body of [forms[1],{...forms[0],target_slot_id:id(99)}]){await assert.rejects(()=>api.writeSlotMovement(champ,contract,body),/pendente/);assert.equal(calls.length,0);cases++}
 await assert.rejects(()=>api.writeSlotMovement(champ,{slot_movement_mode:'legacy'},forms[0]),/pendente/);assert.equal(calls.length,0);cases++
 for(const [a,c] of [[id(99),champ],[actor,id(99)]]){assert.equal(await api.slotMovementAttempts.read(a,c),null);cases++}
 await api.slotMovementAttempts.complete({...saved,requestId:id(999)});assert.equal(values.size,1);cases++
 ignoredRemove=true;await assert.rejects(()=>api.slotMovementAttempts.discard(saved),/encerrar/);await api.slotMovementAttempts.complete(saved);assert.equal(values.size,1);cases++
 ignoredRemove=false;await api.slotMovementAttempts.discard(saved);assert.equal(values.size,0);assert.equal(calls.length,0);cases++
 reset();const broken=await api.slotMovementAttempts.prepare(actor,champ,forms[0]);values.set(broken.storageKey,'broken');await assert.rejects(()=>api.slotMovementAttempts.read(actor,champ),/ler/);await assert.rejects(()=>api.writeSlotMovement(champ,contract,forms[0]));assert.equal(calls.length,0);cases++
 for(const first of ['movement','participation']){
  reset();const shared=loader(),move=shared('web/lib/slot-movement-write.ts'),part=shared('web/lib/participation-write.ts'),partBody={slot_id:id(80),equipe_id:id(81),line_id:id(82)}
  const partIntent=shared('backend/src/campeonatos/participation-contract.ts').participationIntent('POST',partBody)
  if(first==='movement')await move.slotMovementAttempts.prepare(actor,champ,forms[0]);else await part.participationAttempts.prepare(actor,champ,partIntent)
  for(const mode of ['atomic','legacy']){
   await assert.rejects(()=>first==='movement'?part.writeParticipation(champ,{...participation,participation_write_mode:mode},'POST',partBody):move.writeSlotMovement(champ,{...contract,slot_movement_mode:mode},forms[0]),/aguardando/);assert.equal(calls.length,0);assert.equal(values.size,1);cases++
  }
  reset();let release;hold=new Promise(r=>release=r)
  const waiting=requestEntered()
  const primary=first==='movement'?move.writeSlotMovement(champ,contract,forms[0]):part.writeParticipation(champ,{participation_write_mode:'legacy'},'POST',partBody)
  await waiting;await assert.rejects(()=>first==='movement'?part.writeParticipation(champ,participation,'POST',partBody):move.writeSlotMovement(champ,contract,forms[0]),/andamento/);assert.equal(calls.length,1);assert.ok(values.size<=1);release();await primary;cases++
 }
 const invalid=[null,[],{...forms[0],target_slot_id:id(20)},{...forms[1],target_participation_id:null},{...forms[0],target_participation_id:id(11)},
  ...[[],[expected[0]],Array(1001).fill(expected[0]),[expected[0],expected[0]],[expected[0],{...expected[1],slot_id:expected[0].slot_id}],[expected[0],{...expected[1],updated_at:'2026-10-11T13:00:00.1234567Z'}]].map(expected=>({...forms[2],expected})),
  {...forms[3],group_ids:[id(50),id(50)]},{...forms[3],strategy:'unknown'},{...forms[3],phase_id:'bad'}]
 for(const body of invalid){assert.throws(()=>pure.slotMovementIntent(body));cases++}
 const board=expected.map(p=>({id:p.slot_id,equipe_id:p.equipe_id,line_id:p.line_id,participacao_id:p.id,status:'ocupado',slot_movement_expected:p}))
 assert.deepEqual(pure.slotMovementBoardExpected([...board,{id:id(99),status:'reservado'}]),expected);cases++
 for(const change of [{slot_movement_expected:null},{equipe_id:id(999)},{line_id:id(999)},{participacao_id:id(999)}]){assert.throws(()=>pure.slotMovementBoardExpected([{...board[0],...change}]));cases++}
 console.log(`Slot movement clients passed: ${cases} fixtures; five intents, durable replay, strict DTO, account/storage/legacy guards and mutual participation lease.`)
}finally{globalThis.fetch=originalFetch;if(originalStorage===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=originalStorage;if(originalCrypto)Object.defineProperty(globalThis,'crypto',originalCrypto);else delete globalThis.crypto}
