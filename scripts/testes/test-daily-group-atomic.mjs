import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {NextRequest} from 'next/server.js'
import {fixtureLoader} from './ts-fixture-loader.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor=id(1),champ=id(2),rule=id(3),execution=id(4),key=id(10)
const hour=id(3),group=id(4),version='2026-10-12T00:00:00.123456+00:00'
const fence={groups:[{id:group,campeonato_id:champ,diario_horario_id:null,updated_at:version}],hours:[{id:hour,campeonato_id:champ,grupo_id:null,updated_at:version}]}
const bodies=[{action:'link_daily_group',daily_hour_id:hour,group_id:group,expected:fence}]
let mode,auth,manage,calls,tableCalls,commits,fault,sessionActor,sessionCalls,changeAccount,blocked,ignoreSet,ignoreRemove,hold,badScope
const receipts=new Map(),values=new Map()
const admin=createClient('https://progression-atomic-fixture.supabase.co','fixture',{auth:{persistSession:false},global:{fetch:async(input,options)=>{
 const url=new URL(input);assert.equal(url.pathname,'/rest/v1/rpc/fn_vincular_diario_grupo_atomico')
 const args=JSON.parse(options.body);calls.push(args)
 if(hold)await hold
 if(fault?.code){const failure=fault;fault=null;return Response.json({code:failure.code,message:failure.message||'PRIVATE diagnostics'},{status:400})}
 const receiptKey=args.p_actor_id+':'+args.p_request_id,previous=receipts.get(receiptKey)
 if(args.p_request_id&&previous)return Response.json({...previous,repetida:true})
 const data={ok:true,actor_id:args.p_actor_id,campeonato_id:args.p_campeonato_id,daily_group_action:'link',operation_confirmed:true,request_id:args.p_request_id,daily_hour_id:hour,group_id:group,snapshot:{groups:[{...fence.groups[0],diario_horario_id:hour}],hours:[{...fence.hours[0],grupo_id:group}]}}
 if(args.p_request_id){commits++;receipts.set(receiptKey,data)}
 if(fault==='lost'){fault=null;throw Error('PRIVATE lost after commit')}
 if(fault==='bad'){fault=null;return Response.json({...data,actor_id:id(999)})}
 return Response.json(data)
}}})
const overrides={
 '@backend/shared/supabase-admin':{supabaseAdmin:new Proxy(admin,{get(target,property){if(property==='from')return()=>{tableCalls++;throw Error('Legacy table write reached')};return target[property]}})},
 '@backend/auth/server-auth':{getBearerUser:async request=>{if(!auth||request.headers.get('Authorization')!=='Bearer fixture-token')throw Error('Sessao invalida.');return{id:actor}}},
 '@backend/campeonatos/campeonato-permissions':{getCampeonatoPermission:async()=>({role:manage?'owner':'none',canManage:manage,canView:manage}),permissionPublicPayload:permission=>permission},
 '@backend/campeonatos/advanced-structure-read':{loadAdvancedStructure:async()=>({edition:null})},
 '@backend/campeonatos/progression-preview':{buildProgressionPreview:async()=>preview},
 '@backend/campeonatos/structure-scope':{assertStructureActionScope:async()=>{}},
 '@/lib/supabase-browser':{supabase:{auth:{getSession:async()=>{sessionCalls++;return{data:{session:sessionActor?{user:{id:changeAccount&&sessionCalls>1?id(999):sessionActor},access_token:'fixture-token'}:null}}}}}},
}
const load=()=>fixtureLoader(overrides),params={params:Promise.resolve({id:champ})}
const route=(loader,dedicated)=>loader(`web/app/api/campeonatos/[id]/estrutura-avancada/${dedicated?'horario-grupo-atomico/':''}route.ts`)
const request=(body,requestId=key)=>new NextRequest(`https://fixture.invalid/api/campeonatos/${champ}/estrutura-avancada`,{method:'POST',headers:{Authorization:'Bearer fixture-token','Content-Type':'application/json',...(requestId?{'Idempotency-Key':requestId}:{})},body:JSON.stringify(body)})
const originals={mode:process.env.DAILY_GROUP_WRITE_MODE,fetch:globalThis.fetch,storage:globalThis.sessionStorage,crypto:Object.getOwnPropertyDescriptor(globalThis,'crypto')}
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true})
globalThis.sessionStorage={getItem:k=>{if(blocked)throw Error('blocked');return values.get(k)??null},setItem:(k,v)=>{if(blocked)throw Error('blocked');if(!ignoreSet)values.set(k,v)},removeItem:k=>{if(!ignoreRemove)values.delete(k)}}
let cases=0
function reset(){mode='atomic';process.env.DAILY_GROUP_WRITE_MODE=mode;auth=true;manage=true;calls=[];tableCalls=0;commits=0;fault=null;receipts.clear();values.clear();sessionActor=actor;sessionCalls=0;changeAccount=false;blocked=false;ignoreSet=false;ignoreRemove=false;hold=null;badScope=false}
const check=async(name,fn)=>{await fn();cases++;console.log('PASS '+name)}
try{
 for(const dedicated of [false,true])for(const body of bodies)await check(`${dedicated?'dedicated':'canonical'} ${body.action} uses RPC only`,async()=>{reset();const response=await route(load(),dedicated).POST(request(body),params);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(calls.length,1);assert.equal(tableCalls,0)})
 for(const dedicated of [false,true])for(const body of bodies)await check('missing UUID fails before RPC',async()=>{reset();const response=await route(load(),dedicated).POST(request(body,null),params);assert.equal(response.status,400);assert.equal(calls.length,0)})
 for(const dedicated of [false,true])await check('auth and manage checked before atomic mutation',async()=>{reset();auth=false;assert.equal((await route(load(),dedicated).POST(request(bodies[0]),params)).status,401);assert.equal(calls.length,0);auth=true;manage=false;assert.equal((await route(load(),dedicated).POST(request(bodies[0]),params)).status,403);assert.equal(calls.length,0)})
 for(const code of ['42501','23505','23514','23503','40001','55P03','22023','22P02','PGRST202','42883','XX000'])await check('private RPC error mapped '+code,async()=>{reset();fault={code};const response=await route(load(),true).POST(request(bodies[0]),params);assert.equal(response.status,code==='42501'?403:['22023','22P02'].includes(code)?400:['PGRST202','42883','XX000'].includes(code)?503:409);assert.ok(!(await response.text()).includes('PRIVATE'));assert.equal(tableCalls,0)})
 await check('known-aborted deadlock retries exact immutable payload once',async()=>{reset();fault={code:'40P01'};assert.equal((await route(load(),true).POST(request(bodies[0]),params)).status,200);assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(commits,1)})
 await check('bad RPC acknowledgment remains uncertain',async()=>{reset();fault='bad';assert.equal((await route(load(),true).POST(request(bodies[0]),params)).status,503)})
 await check('disabled dedicated route never falls back to legacy',async()=>{reset();process.env.DAILY_GROUP_WRITE_MODE='legacy';assert.equal((await route(load(),true).POST(request(bodies[0]),params)).status,503);assert.equal(calls.length,0);assert.equal(tableCalls,0)})
 await check('invalid flag fails closed',async()=>{reset();process.env.DAILY_GROUP_WRITE_MODE='other';assert.equal((await route(load(),true).POST(request(bodies[0]),params)).status,503);assert.equal(calls.length,0)})
 globalThis.fetch=async(url,options)=>{if(badScope)return new Response('<html>stale</html>',{status:200});const endpoint=String(url).endsWith('/horario-grupo-atomico');return route(load(),endpoint).POST(new NextRequest('https://fixture.invalid'+url,options),params)}
 const contract={daily_group_write_mode:'atomic',daily_group_actor_id:actor}
 for(const body of bodies)await check('lost response / module restart replays original '+body.action,async()=>{reset();fault='lost';const api=load()('web/lib/daily-group-write.ts');await assert.rejects(()=>api.writeDailyGroup(champ,contract,{...body,token:'EXTRA-SECRET'}));assert.equal(commits,1);assert.equal(values.size,1);assert.ok(!JSON.stringify([...values]).includes('fixture-token'));assert.ok(!JSON.stringify([...values]).includes('EXTRA-SECRET'));const restarted=load()('web/lib/daily-group-write.ts'),pending=await restarted.dailyGroupAttempts.read(actor,champ);assert.equal((await restarted.writeDailyGroup(champ,contract,pending.body)).repetida,true);assert.deepEqual(calls[0],calls[1]);assert.equal(commits,1);assert.equal(values.size,0)})
 await check('changed intent refuses before HTTP',async()=>{reset();const api=load()('web/lib/daily-group-write.ts');await api.dailyGroupAttempts.prepare(actor,champ,bodies[0]);await assert.rejects(()=>api.writeDailyGroup(champ,contract,{...bodies[0],expected:{...fence,hours:[{...fence.hours[0],updated_at:'2026-10-12T00:00:01Z'}]}}),/pendente/);assert.equal(calls.length,0)})
 for(const other of [[id(99),champ],[actor,id(99)]])await check('pending scope isolates account/championship',async()=>{reset();const api=load()('web/lib/daily-group-write.ts');await api.dailyGroupAttempts.prepare(actor,champ,bodies[0]);assert.equal(await api.dailyGroupAttempts.read(...other),null)})
 for(const failure of ['blocked','ignore-set','html','bad-ack','missing-rpc','disabled'])await check('uncertain/failure retains attempt or blocks before HTTP: '+failure,async()=>{reset();const api=load()('web/lib/daily-group-write.ts');blocked=failure==='blocked';ignoreSet=failure==='ignore-set';badScope=failure==='html';fault=failure==='bad-ack'?'bad':failure==='missing-rpc'?{code:'PGRST202'}:null;if(failure==='disabled')process.env.DAILY_GROUP_WRITE_MODE='legacy';await assert.rejects(()=>api.writeDailyGroup(champ,contract,bodies[0]));assert.equal(values.size,['blocked','ignore-set'].includes(failure)?0:1);if(['blocked','ignore-set'].includes(failure))assert.equal(calls.length,0);assert.equal(tableCalls,0)})
 await check('session changes after persistence prevent HTTP',async()=>{reset();changeAccount=true;const api=load()('web/lib/daily-group-write.ts');await assert.rejects(()=>api.writeDailyGroup(champ,contract,bodies[0]),/conta mudou/);assert.equal(calls.length,0);assert.equal(values.size,1)})
 await check('component epoch changes prevent HTTP even with same actor',async()=>{reset();const api=load()('web/lib/daily-group-write.ts');let checks=0;await assert.rejects(()=>api.writeDailyGroup(champ,contract,bodies[0],()=>{if(++checks===2)throw Error('epoch changed')}),/epoch changed/);assert.equal(calls.length,0);assert.equal(values.size,1)})
 await check('six same intents share one lease/HTTP/receipt',async()=>{reset();let release;hold=new Promise(resolve=>{release=resolve});const api=load()('web/lib/daily-group-write.ts'),runs=Array.from({length:6},()=>api.writeDailyGroup(champ,contract,bodies[0]));await new Promise(resolve=>setTimeout(resolve,25));assert.equal(calls.length,1);release();await Promise.all(runs);assert.equal(commits,1)})
 await check('legacy mode refuses linking before HTTP',async()=>{reset();const api=load()('web/lib/daily-group-write.ts');for(const body of bodies)await assert.rejects(()=>api.writeDailyGroup(champ,{daily_group_write_mode:'legacy'},body),/indisponível/);assert.equal(calls.length,0)})
 await check('corrupted/copied storage refuses without HTTP',async()=>{reset();const api=load()('web/lib/daily-group-write.ts'),attempt=await api.dailyGroupAttempts.prepare(actor,champ,bodies[0]);values.set(attempt.storageKey,'invalid');await assert.rejects(()=>api.writeDailyGroup(champ,contract,bodies[0]),/ler/);assert.equal(calls.length,0)})
 await check('failed cleanup retains confirmed replay; discard verifies removal',async()=>{reset();ignoreRemove=true;const api=load()('web/lib/daily-group-write.ts');await api.writeDailyGroup(champ,contract,bodies[0]);assert.equal(values.size,1);const attempt=await api.dailyGroupAttempts.read(actor,champ);await assert.rejects(()=>api.dailyGroupAttempts.discard(attempt),/encerrar/);ignoreRemove=false;await api.dailyGroupAttempts.discard(attempt);assert.equal(values.size,0)})
 await check('browser HTTP timeout retains original and releases the runtime lease',async()=>{
  reset();const previousFetch=globalThis.fetch,previousTimer=globalThis.setTimeout
  const api=load()('web/lib/daily-group-write.ts')
  try{
   globalThis.setTimeout=(fn,delay,...args)=>previousTimer(fn,delay===30000?1:delay,...args)
   globalThis.fetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('Fixture timeout')),{once:true}))
   await assert.rejects(()=>api.writeDailyGroup(champ,contract,bodies[0]),/tentativa original/);assert.equal(values.size,1)
  }finally{globalThis.fetch=previousFetch;globalThis.setTimeout=previousTimer}
  const pending=await api.dailyGroupAttempts.read(actor,champ);await api.writeDailyGroup(champ,contract,pending.body);assert.equal(values.size,0);assert.equal(commits,1)
 })
 console.log(`Daily group atomic contract: ${cases} checks passed; real Supabase JS transport + Next handlers, synthetic HTTP/storage only.`)
}finally{globalThis.fetch=originals.fetch;globalThis.sessionStorage=originals.storage;if(originals.crypto)Object.defineProperty(globalThis,'crypto',originals.crypto);if(originals.mode==null)delete process.env.DAILY_GROUP_WRITE_MODE;else process.env.DAILY_GROUP_WRITE_MODE=originals.mode}
