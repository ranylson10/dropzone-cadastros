import assert from 'node:assert/strict'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const body={mode:'move',source_slot_id:id(2),target_slot_id:id(3),source_participation_id:id(4),target_participation_id:null}
const values=new Map(),receipts=new Map(),keys=[],bodies=[]
let blocked=false,ignoredSet=false,lost=false,malformed=false,commits=0
const storage={getItem:async key=>{await Promise.resolve();if(blocked)throw new Error('Unavailable');return values.get(key)??null},
  setItem:async(key,value)=>{await Promise.resolve();if(blocked)throw new Error('Unavailable');if(!ignoredSet)values.set(key,value)},
  removeItem:async key=>{if(blocked)throw new Error('Unavailable');values.delete(key)}}
const overrides={'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_,text)=>createHash('sha256').update(text).digest('hex'),randomUUID},
  [path.resolve('app/src/lib/secureStorage.ts')]:{secureStorage:storage},'@/config/env':{apiUrl:path=>'https://mobile-slot-fixture.invalid'+path}}
const load=()=>fixtureLoader(overrides),api=load()('app/src/lib/slot-transfer-attempt.ts')
overrides[path.resolve('app/src/lib/supabase.ts')]={supabase:{auth:{getSession:async()=>({data:{session:{user:{id:id(1)},access_token:'AUTH-TOKEN-SECRET'}}})}}}
const contract={slot_movement_mode:'atomic',slot_movement_actor_id:id(1)}
let cases=0
const originalFetch=globalThis.fetch
try{
  const first=await api.prepareMobileSlotTransfer(id(1),id(20),body)
  assert.deepEqual((await load()('app/src/lib/slot-transfer-attempt.ts').readPendingMobileSlotTransfer(id(1),id(20))).body,body)
  assert.equal((await api.prepareMobileSlotTransfer(id(1),id(20),{...body,actor_id:'SECRET',token:'SECRET',nome:'PRIVATE NAME'})).requestId,first.requestId);cases++
  assert.ok(!JSON.stringify([...values]).includes('SECRET'));assert.ok(!JSON.stringify([...values]).includes('PRIVATE NAME'));cases++
  const parallel=await Promise.all(Array.from({length:6},()=>api.prepareMobileSlotTransfer(id(1),id(20),body)))
  assert.equal(new Set(parallel.map(t=>t.requestId)).size,1);cases++
  await assert.rejects(()=>api.prepareMobileSlotTransfer(id(1),id(20),{...body,target_slot_id:id(9)}),/pendente/)
  assert.equal((await api.readPendingMobileSlotTransfer(id(1),id(20))).requestId,first.requestId);cases++
  const otherActor=await api.prepareMobileSlotTransfer(id(10),id(20),body),otherChamp=await api.prepareMobileSlotTransfer(id(1),id(21),body)
  assert.notEqual(otherActor.requestId,first.requestId);assert.notEqual(otherChamp.requestId,first.requestId);cases++
  await api.completeMobileSlotTransfer({...first,requestId:randomUUID()});assert.equal(values.has(first.storageKey),true);cases++
  await api.completeMobileSlotTransfer(first);assert.equal(values.has(first.storageKey),false);cases++
  blocked=true;await assert.rejects(()=>api.prepareMobileSlotTransfer(id(1),id(20),body),/guardar/)
  await assert.rejects(()=>api.readPendingMobileSlotTransfer(id(1),id(20)),/ler/);blocked=false;cases++
  ignoredSet=true;await assert.rejects(()=>api.prepareMobileSlotTransfer(id(1),id(20),body),/guardar/);ignoredSet=false;cases++
  for(const bad of [{}, {...body,source_participation_id:null},{...body,mode:'swap',target_participation_id:null},
    {...body,mode:'swap',target_participation_id:body.source_participation_id},{...body,source_slot_id:'invalid'},{...body,source_slot_id:body.target_slot_id}]){
    await assert.rejects(()=>api.prepareMobileSlotTransfer(id(1),id(20),bad));cases++
  }
  const valid=await api.prepareMobileSlotTransfer(id(1),id(20),body)
  values.set(valid.storageKey,'{bad');await assert.rejects(()=>api.readPendingMobileSlotTransfer(id(1),id(20)),/ler/)
  await assert.rejects(()=>api.prepareMobileSlotTransfer(id(1),id(20),body),/guardar/);cases++
  values.delete(valid.storageKey)
  await assert.rejects(()=>api.prepareMobileSlotTransfer('',id(20),body),/Entre novamente/);cases++
  globalThis.fetch=async(url,options)=>{
    assert.equal(new URL(url).hostname,'mobile-slot-fixture.invalid');assert.equal(new URL(url).pathname,`/api/campeonatos/${id(20)}/equipes/movimentacao-atomica`)
    const headers=new Headers(options.headers),requestId=headers.get('Idempotency-Key'),data=JSON.parse(options.body)
    assert.equal(headers.get('Authorization'),'Bearer AUTH-TOKEN-SECRET');assert.match(requestId,/^[\da-f-]{36}$/i)
    keys.push(requestId);bodies.push(data)
    if(malformed)return Response.json({})
    if(!receipts.has(requestId)){receipts.set(requestId,{ok:true,mensagem:'Movida.',campeonato_id:id(20),action:data.mode,...data,participacoes:[
      {id:data.source_participation_id,equipe_id:id(6),line_id:id(7),grupo_id:id(8),slot_id:data.target_slot_id,slot_numero:2,updated_at:'2026-10-12T03:10:00.123456+00:00'},
      ...(data.mode==='swap'?[{id:data.target_participation_id,equipe_id:id(9),line_id:id(10),grupo_id:id(8),slot_id:data.source_slot_id,slot_numero:1,updated_at:'2026-10-12T03:10:00.123456+00:00'}]:[])]});commits++}
    if(lost){lost=false;throw new Error('Lost response after commit')}
    return Response.json({...receipts.get(requestId),repetida:keys.filter(t=>t===requestId).length>1})
  }
  for(const mode of ['move','swap']){
    values.clear();keys.length=0;bodies.length=0;receipts.clear();commits=0;lost=true
    const intent={...body,mode,target_participation_id:mode==='swap'?id(5):null}
    const transport=load()('app/src/lib/api.ts').mobileApi
    await assert.rejects(()=>transport.moveChampionshipSlot(id(20),intent,contract,'AUTH-TOKEN-SECRET',id(1)),/Lost response/)
    assert.equal(commits,1);assert.ok(!JSON.stringify([...values]).includes('AUTH-TOKEN-SECRET'))
    const restarted=load()('app/src/lib/slot-transfer-attempt.ts'),saved=await restarted.readPendingMobileSlotTransfer(id(1),id(20))
    assert.deepEqual(saved.body,intent)
    // The source is now empty on the fresh board, so replay MUST use the stored original intent.
    const replay=await load()('app/src/lib/api.ts').mobileApi.moveChampionshipSlot(id(20),saved.body,contract,'AUTH-TOKEN-SECRET',id(1))
    assert.equal(replay.repetida,true);assert.equal(keys[0],keys[1]);assert.deepEqual(bodies[0],bodies[1]);assert.equal(commits,1);assert.equal(values.size,0);cases++
  }
  malformed=true;values.clear();keys.length=0
  await assert.rejects(()=>load()('app/src/lib/api.ts').mobileApi.moveChampionshipSlot(id(20),body,contract,'AUTH-TOKEN-SECRET',id(1)),/confirmar a movimentação/)
  assert.equal(values.size,1);malformed=false;cases++
  keys.length=0;await assert.rejects(()=>load()('app/src/lib/api.ts').mobileApi.moveChampionshipSlot(id(20),body,contract,'AUTH-TOKEN-SECRET'),/Entre novamente/)
  assert.equal(keys.length,0);cases++
  const saved=await api.readPendingMobileSlotTransfer(id(1),id(20));blocked=true
  await assert.rejects(()=>api.forgetPendingMobileSlotTransfer(saved),/Unavailable/);blocked=false;assert.equal(values.size,1);cases++
  await api.forgetPendingMobileSlotTransfer(saved);assert.equal(values.size,0);cases++
  console.log(`Mobile slot transfer passed: ${cases} fixtures; original intent/UUID persists before PATCH, restart/replay, account isolation, one pending operation, storage failure/no POST and explicit local discard.`)
}finally{globalThis.fetch=originalFetch}
