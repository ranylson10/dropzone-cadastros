import assert from 'node:assert/strict'
import fs from 'node:fs'
import { webcrypto } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server.js'
import { fixtureLoader } from './ts-fixture-loader.mjs'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor = id(1), champ = id(20), edition = id(30), publication = id(40), key = id(50)
const publishFence = { edition_id:edition,revision:7,publication_id:null,plan_hash:'a'.repeat(64) }, reopenFence = { ...publishFence,revision:10,publication_id:publication,plan_hash:'b'.repeat(64) }
const bodies = [{ action:'publish_final',expected:publishFence },{ action:'reopen_final',expected:reopenFence }]
let auth, manage, mode, calls, tableCalls, receipts, commits, fault, values, sessionActor, hold, blocked, ignoreRemove, ignoreSet, badScope
const plan = { falls:1,total_equipes:1,groups:[],ranking:[{ campeonato_equipe_id:id(80),colocacao:1,quedas:1,booyahs:1,abates:3,pontos_total:15,melhor_posicao:1 }],champion_id:id(80),champion_name:'Team',phase_id:null,decisive_game_id:null,gold_reached:false,winner_fall_id:null }
const answer = args => args.p_action.startsWith('preview_') ? {
 mode:'atomic',actor_id:args.p_actor_id,campeonato_id:args.p_campeonato_id,request_id:args.p_request_id,action:args.p_action,
 preview:{ fence:args.p_action === 'preview_publish_final' ? publishFence : reopenFence,edition:{ id:edition,status:args.p_action === 'preview_publish_final' ? 'ativa' : 'encerrada',data_fim:null },plan,stages:3,divisions:2 },
 } : { mode:'atomic',actor_id:args.p_actor_id,campeonato_id:args.p_campeonato_id,request_id:args.p_request_id,action:args.p_action,operation_confirmed:true,repetida:false,publication_id:publication,revision:11,edition:{ id:edition,campeonato_id:champ,status:args.p_action === 'publish_final' ? 'encerrada' : 'ativa',data_fim:args.p_action === 'publish_final' ? '2026-10-12' : null },registrations_open:false,total_equipes:1,champion_id:args.p_action === 'publish_final' ? id(80) : null }
const admin = createClient('https://lifecycle-atomic-fixture.supabase.co','fixture-key',{ auth:{ persistSession:false },global:{ fetch:async(input,options)=>{
 const url = new URL(input)
 if(!url.pathname.includes('/rpc/')) { tableCalls++; throw Error('Unexpected table operation') }
 const args = JSON.parse(options.body); calls.push(structuredClone(args)); assert.ok(url.pathname.endsWith('/fn_lifecycle_atomico'))
 if(hold) await hold
 if(fault && typeof fault === 'object') { const code = fault.code; if(code === '40P01') fault = null; return Response.json({ code,message:'PRIVATE_DATABASE_DIAGNOSTIC' },{ status:400 }) }
 const signature = JSON.stringify(args), stored = receipts.get(args.p_request_id)
 let result
 if(stored) { if(stored.signature !== signature) return Response.json({ code:'23505',message:'private' },{status:409}); result = { ...stored.result,repetida:true } }
 else { result = answer(args); if(!args.p_action.startsWith('preview_')) { commits++; receipts.set(args.p_request_id,{ signature,result:structuredClone(result) }) } }
 if(fault === 'lost') { fault = null; throw Error('Synthetic lost response') }
 if(fault === 'bad') result.request_id = id(999)
 return Response.json(result)
 } } })
const overrides = {
 '@backend/shared/supabase-admin':{ supabaseAdmin:admin },
 '@backend/auth/server-auth':{ getBearerUser:async()=>{ if(!auth) throw Error('Sessao invalida.'); return { id:actor } } },
 '@backend/campeonatos/campeonato-permissions':{ getCampeonatoPermission:async()=>({ canView:true,canManage:manage,role:'owner' }),permissionPublicPayload:value=>value },
 '@backend/campeonatos/advanced-structure-read':{ loadAdvancedStructure:async()=>({ edition:{ id:edition,campeonato_id:champ,status:'ativa',data_fim:null } }) },
 '@/lib/supabase-browser':{ supabase:{ auth:{ getSession:async()=>({ data:{ session:sessionActor ? { user:{ id:sessionActor },access_token:'fixture-token' } : null } }) } } },
}
const load = () => fixtureLoader(overrides), params = { params:Promise.resolve({ id:champ }) }
const route = (loader,dedicated) => loader(`web/app/api/campeonatos/[id]/estrutura-avancada/${dedicated ? 'lifecycle-atomico/' : ''}route.ts`)
const request = (body,uuid=key) => new NextRequest('https://fixture.invalid/api',{ method:'POST',headers:{ Authorization:'Bearer fixture-token','Content-Type':'application/json',...(uuid ? { 'Idempotency-Key':uuid } : {}) },body:JSON.stringify(body) })
const originals = { fetch:globalThis.fetch,storage:globalThis.sessionStorage,crypto:Object.getOwnPropertyDescriptor(globalThis,'crypto'),mode:process.env.LIFECYCLE_WRITE_MODE }
Object.defineProperty(globalThis,'crypto',{ value:webcrypto,configurable:true })
globalThis.sessionStorage = { getItem:k=>{ if(blocked) throw Error('Blocked'); return values.get(k) ?? null },setItem:(k,v)=>{ if(blocked) throw Error('Blocked'); if(!ignoreSet) values.set(k,v) },removeItem:k=>{ if(!ignoreRemove) values.delete(k) } }
function reset() { auth = manage = true; mode = 'atomic'; process.env.LIFECYCLE_WRITE_MODE = mode; calls = []; tableCalls = 0; receipts = new Map(); values = new Map(); commits = 0; fault = null; sessionActor = actor; hold = null; blocked = ignoreRemove = ignoreSet = badScope = false }
let checks = 0
const test = async(name,fn) => { reset(); await fn(); checks++; console.log('PASS '+name) }
try {
 for(const dedicated of [false,true]) for(const body of [{ action:'preview_publish_final' },{ action:'preview_reopen_final' },...bodies]) await test('single RPC only '+body.action+' '+dedicated,async()=>{ const response = await route(load(),dedicated).POST(request(body),params); assert.equal(response.status,200); assert.equal(response.headers.get('Cache-Control'),'no-store'); assert.equal(calls.length,1); assert.equal(tableCalls,0); if(body.action.startsWith('preview_')) assert.equal(commits,0) })
 for(const dedicated of [false,true]) for(const body of bodies) await test('UUID required before RPC '+dedicated+' '+body.action,async()=>{ assert.equal((await route(load(),dedicated).POST(request(body,null),params)).status,400); assert.equal(calls.length,0) })
 for(const dedicated of [false,true]) await test('auth/manage before reading mutation body '+dedicated,async()=>{ auth = false; assert.equal((await route(load(),dedicated).POST(request(bodies[0]),params)).status,401); auth = true; manage = false; let parsed = false; const req = request(bodies[0]); req.json = async()=>{ parsed = true; throw Error('private') }; assert.equal((await route(load(),dedicated).POST(req,params)).status,403); assert.equal(parsed,false); assert.equal(calls.length,0) })
 for(const code of ['42501','23505','23514','23503','40001','55P03','22023','22P02','22003','54000','PGRST202','42883','XX000']) await test('private error mapping '+code,async()=>{ fault = { code }; const response = await route(load(),true).POST(request(bodies[0]),params); assert.equal(response.status,code === '42501' ? 403 : ['22023','22P02','22003','54000'].includes(code) ? 400 : ['PGRST202','42883','XX000'].includes(code) ? 503 : 409); assert.ok(!(await response.text()).includes('PRIVATE')); assert.equal(tableCalls,0) })
 await test('known-aborted deadlock retries unchanged UUID/body once',async()=>{ fault = { code:'40P01' }; assert.equal((await route(load(),true).POST(request(bodies[0]),params)).status,200); assert.equal(calls.length,2); assert.deepEqual(calls[0],calls[1]); assert.equal(commits,1) })
 await test('bad acknowledgement remains uncertain',async()=>{ fault = 'bad'; assert.equal((await route(load(),true).POST(request(bodies[0]),params)).status,503) })
 for(const value of ['legacy','invalid','']) await test('disabled/invalid flag refuses without legacy writes '+value,async()=>{ process.env.LIFECYCLE_WRITE_MODE = value; assert.equal((await route(load(),true).POST(request(bodies[0]),params)).status,503); assert.equal(calls.length,0); assert.equal(tableCalls,0) })
 await test('dedicated route rejects another family',async()=>{ assert.equal((await route(load(),true).POST(request({ action:'save_edition' }),params)).status,400); assert.equal(calls.length,0) })
 globalThis.fetch = async(url,options)=>{ if(badScope) return new Response('<html>Old version</html>',{status:404}); return route(load(),String(url).endsWith('/lifecycle-atomico')).POST(new NextRequest('https://fixture.invalid'+url,options),params) }
 const contract = { lifecycle_write_mode:'atomic',edition_actor_id:actor }
 for(const body of bodies) await test('lost response and module restart recover original '+body.action,async()=>{ fault = 'lost'; const api = load()('web/lib/lifecycle-write.ts'); await assert.rejects(()=>api.writeLifecycle(champ,contract,{ ...body,token:'EXTRA_SECRET' })); assert.equal(commits,1); assert.equal(values.size,1); assert.ok(!JSON.stringify([...values]).includes('fixture-token')); assert.ok(!JSON.stringify([...values]).includes('EXTRA_SECRET')); const restarted = load()('web/lib/lifecycle-write.ts'),pending = await restarted.lifecycleAttempts.read(actor,champ); assert.equal((await restarted.writeLifecycle(champ,contract,pending.body)).repetida,true); assert.deepEqual(calls[0],calls[1]); assert.equal(commits,1); assert.equal(values.size,0) })
 await test('changed review refuses before HTTP',async()=>{ const api = load()('web/lib/lifecycle-write.ts'); await api.lifecycleAttempts.prepare(actor,champ,bodies[0]); await assert.rejects(()=>api.writeLifecycle(champ,contract,{ ...bodies[0],expected:{ ...publishFence,revision:8 } }),/pendente/); assert.equal(calls.length,0) })
 await test('another account/resource cannot read pending attempt',async()=>{ const api = load()('web/lib/lifecycle-write.ts'); await api.lifecycleAttempts.prepare(actor,champ,bodies[0]); assert.equal(await api.lifecycleAttempts.read(id(99),champ),null); assert.equal(await api.lifecycleAttempts.read(actor,id(99)),null) })
 await test('missing/wrong session stops before persistence/HTTP',async()=>{ sessionActor = id(99); const api = load()('web/lib/lifecycle-write.ts'); await assert.rejects(()=>api.writeLifecycle(champ,contract,bodies[0])); assert.equal(calls.length,0); assert.equal(values.size,0) })
 await test('invalid resource callback stops before persistence',async()=>{ const api = load()('web/lib/lifecycle-write.ts'); await assert.rejects(()=>api.writeLifecycle(champ,contract,bodies[0],()=>{ throw Error('old resource') })); assert.equal(calls.length,0); assert.equal(values.size,0) })
 for(const problem of ['blocked','ignored','corrupt']) await test('storage '+problem+' fails before HTTP',async()=>{ const api = load()('web/lib/lifecycle-write.ts'); if(problem === 'blocked') blocked = true; if(problem === 'ignored') ignoreSet = true; if(problem === 'corrupt') { const pending = await api.lifecycleAttempts.prepare(actor,champ,bodies[0]); values.set(pending.storageKey,'broken') } await assert.rejects(()=>api.writeLifecycle(champ,contract,bodies[0])); assert.equal(calls.length,0) })
 await test('six duplicate submits share one request/commit',async()=>{ const api = load()('web/lib/lifecycle-write.ts'); const results = await Promise.all(Array.from({ length:6 },()=>api.writeLifecycle(champ,contract,bodies[0]))); assert.equal(calls.length,1); assert.equal(commits,1); assert.ok(results.every(r=>r.operation_confirmed)) })
 await test('cleanup failure keeps confirmed original receipt replayable',async()=>{ ignoreRemove = true; const api = load()('web/lib/lifecycle-write.ts'); const result = await api.writeLifecycle(champ,contract,bodies[0]); assert.equal(result.operation_confirmed,true); assert.equal(values.size,1); ignoreRemove = false; assert.equal((await api.writeLifecycle(champ,contract,bodies[0])).repetida,true); assert.equal(commits,1) })
 await test('HTML 404 keeps attempt and never falls back to canonical URL',async()=>{ badScope = true; const api = load()('web/lib/lifecycle-write.ts'); await assert.rejects(()=>api.writeLifecycle(champ,contract,bodies[0])); assert.equal(values.size,1); assert.equal(calls.length,0) })
 await test('preview creates no durable mutation attempt',async()=>{ const api = load()('web/lib/lifecycle-write.ts'); const response = await api.previewLifecycle(champ,contract,'publish_final'); assert.equal(response.preview.plan.champion_name,'Team'); assert.equal(values.size,0); assert.equal(commits,0) })
 await test('stale resource during confirmation keeps original intent',async()=>{ const api = load()('web/lib/lifecycle-write.ts'); let n = 0; await assert.rejects(()=>api.writeLifecycle(champ,contract,bodies[0],()=>{ if(++n > 1) throw Error('scope changed') })); assert.equal(calls.length,0); assert.equal(values.size,1) })
 const actualTimeout = globalThis.setTimeout
 await test('client 35-second timeout retains attempt without fallback',async()=>{
  globalThis.setTimeout = (fn,ms,...args)=>actualTimeout(fn,ms === 35000 ? 2 : ms,...args)
  const network = globalThis.fetch; globalThis.fetch = async(_url,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))
  try { await assert.rejects(()=>load()('web/lib/lifecycle-write.ts').writeLifecycle(champ,contract,bodies[0])); assert.equal(values.size,1) } finally { globalThis.fetch = network; globalThis.setTimeout = actualTimeout }
 })
 const parsed = load()('backend/src/campeonatos/lifecycle-contract.ts')
 for(const patch of [{ revision:'7' },{ revision:-1 },{ revision:9007199254740992 },{ plan_hash:'short' },{ edition_id:'foreign' }]) await test('invalid review field fails closed',async()=>{ assert.throws(()=>parsed.lifecycleIntent({ action:'publish_final',expected:{ ...publishFence,...patch } })) })
 await test('invalid/foreign preview winner is rejected',async()=>{ const args = { p_actor_id:actor,p_campeonato_id:champ,p_request_id:key,p_action:'preview_publish_final' }, result = answer(args); result.preview.plan = { ...plan,champion_id:id(999) }; assert.throws(()=>parsed.assertLifecycleResponse(result,actor,champ,key,{ action:args.p_action })) })
 const target = process.env.LIFECYCLE_ATOMIC_TEST_REPORT
 if(target) fs.writeFileSync(target,JSON.stringify({ generatedAt:new Date().toISOString(),checks,scope:'Real handlers/SDK/clients; synthetic HTTP/Auth/storage, no project calls or native PostgreSQL.' },null,2)+'\n')
 console.log(`Lifecycle atomic contract: ${checks} checks passed.`)
} finally { globalThis.fetch = originals.fetch; globalThis.sessionStorage = originals.storage; if(originals.crypto) Object.defineProperty(globalThis,'crypto',originals.crypto); if(originals.mode === undefined) delete process.env.LIFECYCLE_WRITE_MODE; else process.env.LIFECYCLE_WRITE_MODE = originals.mode }
