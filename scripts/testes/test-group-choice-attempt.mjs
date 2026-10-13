import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const originalStorage=globalThis.sessionStorage,originalCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto'),values=new Map();let blocked=false
globalThis.sessionStorage={getItem:key=>{if(blocked)throw new Error('Blocked');return values.get(key)||null},setItem:(key,value)=>{if(blocked)throw new Error('Blocked');values.set(key,value)},removeItem:key=>values.delete(key)}
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true})
const load=()=>fixtureLoader()('web/lib/group-choice-attempt.ts'),api=load(),body={action:'assign',campeonato_equipe_id:id(3),source_slot_id:null,group_id:id(5),slot_id:id(6),history_id:null};let cases=0
try{
  const a=await api.prepareGroupChoiceAttempt(id(1),id(20),'team',body),restored=await load().readGroupChoiceAttempt(id(1),id(20),'team')
  assert.equal(a.requestId,restored.requestId);assert.deepEqual(restored.body,body);cases++
  assert.equal((await load().prepareGroupChoiceAttempt(id(1),id(20),'team',body)).requestId,a.requestId);cases++
  await assert.rejects(()=>api.prepareGroupChoiceAttempt(id(1),id(20),'team',{...body,slot_id:id(8)}),/pendente/);cases++
  for(const [actor,championship,scope] of [[id(2),id(20),'team'],[id(1),id(21),'team'],[id(1),id(20),'admin']]){assert.equal(await api.readGroupChoiceAttempt(actor,championship,scope),null);cases++}
  const parallel=await Promise.all(Array.from({length:6},()=>api.prepareGroupChoiceAttempt(id(4),id(20),'team',body)));assert.equal(new Set(parallel.map(v=>v.requestId)).size,1);cases++
  api.completeGroupChoiceAttempt({...a,requestId:id(999)});assert.ok(values.has(a.storageKey));cases++
  api.completeGroupChoiceAttempt(a);assert.equal(values.has(a.storageKey),false);cases++
  const next=await api.prepareGroupChoiceAttempt(id(1),id(20),'team',body);api.discardGroupChoiceAttempt(next);assert.equal(values.has(next.storageKey),false);cases++
  for(const invalid of [{...body,slot_id:null},{...body,source_slot_id:undefined},{...body,action:'cancel'},
    {...body,action:'restore'},{...body,campeonato_equipe_id:'bad'}]){await assert.rejects(()=>api.prepareGroupChoiceAttempt(id(1),id(20),'team',invalid));cases++}
  const privateAttempt=await api.prepareGroupChoiceAttempt(id(1),id(22),'team',{...body,token:'PRIVATE SESSION',name:'PRIVATE NAME'})
  assert.ok(!JSON.stringify([...values]).includes('PRIVATE'));cases++
  values.set(privateAttempt.storageKey,'corrupt');await assert.rejects(()=>api.readGroupChoiceAttempt(id(1),id(22),'team'),/ler/);cases++
  blocked=true;await assert.rejects(()=>api.prepareGroupChoiceAttempt(id(1),id(30),'team',body),/guardar/);cases++
  console.log(`Group choice attempt passed: ${cases} fixtures; original intent/key, restart/isolation/concurrency, one pending choice, no credentials and storage fail-closed.`)
}finally{if(originalStorage===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=originalStorage;if(originalCrypto)Object.defineProperty(globalThis,'crypto',originalCrypto);else delete globalThis.crypto}
