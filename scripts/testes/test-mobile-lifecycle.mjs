import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { fixtureLoader } from './ts-fixture-loader.mjs'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor = id(1), champ = id(20), edition = id(30), publication = id(40)
const fence = { edition_id: edition, revision: 7, publication_id: null, plan_hash: 'a'.repeat(64) }
const reopenFence = { ...fence, revision: 10, publication_id: publication, plan_hash: 'b'.repeat(64) }
const contract = { lifecycle_write_mode: 'atomic', edition_actor_id: actor }
const bodies = [{ action: 'publish_final', expected: fence }, { action: 'reopen_final', expected: reopenFence }]
const plan = { falls: 1, total_equipes: 1, groups: [], ranking: [{ campeonato_equipe_id: id(80), colocacao: 1, quedas: 1, booyahs: 1, abates: 3, pontos_total: 15, melhor_posicao: 1 }], champion_id: id(80), champion_name: 'Team', phase_id: null, decisive_game_id: null, gold_reached: false, winner_fall_id: null }
let values, receipts, calls, sessionActor, sessions, lost, ignoredSet, ignoredRemove, blocked, changeAfterPersistence, hold, bad, status, mode, manage, commits, boardPatch
const original = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout }
const storage = { getItem: async k => { if (blocked) throw Error('Blocked'); return values.get(k) ?? null }, setItem: async (k,v) => { if (blocked) throw Error('Blocked'); if (!ignoredSet) values.set(k,v); if (changeAfterPersistence) sessionActor = id(99) }, removeItem: async k => { if (!ignoredRemove) values.delete(k) } }
const load = () => fixtureLoader({ 'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: async (_,v) => createHash('sha256').update(v).digest('hex'), randomUUID },
  [path.resolve('app/src/lib/secureStorage.ts')]: { secureStorage: storage }, [path.resolve('app/src/lib/supabase.ts')]: { supabase: { auth: { getSession: async () => ({ data: { session: sessionActor ? { user: { id: sessionActor }, access_token: 'FRESH-' + (++sessions) } : null } }) } } },
  '@/config/env': { apiUrl: p => 'https://mobile-lifecycle-fixture.invalid' + p },
})
const reset = () => { values = new Map(); receipts = new Map(); calls = []; sessionActor = actor; sessions = commits = 0; lost = ignoredSet = ignoredRemove = blocked = changeAfterPersistence = false; hold = bad = boardPatch = null; status = 200; mode = 'atomic'; manage = true }
function result(body,key) {
  const base = { mode: 'atomic', actor_id: actor, campeonato_id: champ, request_id: key, action: body.action }
  return body.action.startsWith('preview_') ? { ...base, preview: { fence: body.action === 'preview_publish_final' ? fence : reopenFence, edition: { id: edition, status: body.action === 'preview_publish_final' ? 'ativa' : 'encerrada', data_fim: null }, plan, stages: 3, divisions: 2 } }
    : { ...base, operation_confirmed: true, repetida: false, publication_id: publication, revision: 11, edition: { id: edition, campeonato_id: champ, status: body.action === 'publish_final' ? 'encerrada' : 'ativa', data_fim: body.action === 'publish_final' ? '2026-10-12' : null }, registrations_open: false, total_equipes: 1, champion_id: body.action === 'publish_final' ? id(80) : null }
}
globalThis.fetch = async (url,options) => {
  const parsed = new URL(url), headers = new Headers(options.headers)
  assert.equal(parsed.hostname,'mobile-lifecycle-fixture.invalid'); assert.ok(headers.get('Authorization').startsWith('Bearer FRESH-')); assert.equal(options.cache,'no-store')
  if (!options.body) return Response.json({ lifecycle_write_mode: mode, lifecycle_manage_allowed: manage, edition_actor_id: actor, edition: { id: edition, campeonato_id: champ, status: 'ativa', data_fim: null }, ...boardPatch })
  assert.ok(parsed.pathname.endsWith('/estrutura-avancada/lifecycle-atomico'))
  const body = JSON.parse(options.body), key = headers.get('Idempotency-Key'); calls.push({ body, key, url })
  if (hold) await hold
  if (status !== 200) return new Response('<html>Unavailable</html>',{status})
  let answer = result(body,key)
  if (!body.action.startsWith('preview_')) {
    if (receipts.has(key)) answer = { ...receipts.get(key), repetida: true }
    else { commits++; receipts.set(key,answer) }
  }
  if (lost) { lost = false; throw Error('Lost response after commit') }
  return Response.json(bad ? bad(structuredClone(answer)) : answer)
}
let checks = 0
async function test(name,work) { reset(); await work(); checks++; console.log('PASS '+name) }
try {
  for (const body of bodies) {
    await test('durable restart replay '+body.action,async () => {
      const api = load()('app/src/lib/lifecycle-write.ts'); lost = true
      await assert.rejects(() => api.writeMobileLifecycle(champ,actor,contract,{ ...body, token: 'EXTRA_SECRET' }),/Lost/)
      assert.equal(commits,1); assert.equal(values.size,1); assert.ok(!JSON.stringify([...values]).includes('FRESH')); assert.ok(!JSON.stringify([...values]).includes('EXTRA_SECRET'))
      const restarted = load()('app/src/lib/lifecycle-write.ts'), pending = await restarted.mobileLifecycleAttempts.read(actor,champ)
      assert.equal((await restarted.retryMobileLifecycle(champ,actor,pending)).repetida,true)
      assert.deepEqual(calls[0],calls[1]); assert.equal(commits,1); assert.equal(values.size,0)
    })
    await test('six simultaneous duplicate intents share lease '+body.action,async () => {
      const api = load()('app/src/lib/lifecycle-write.ts'); let release; hold = new Promise(r => release = r)
      const submissions = Array.from({length:6},() => api.writeMobileLifecycle(champ,actor,contract,body))
      await new Promise(r => setTimeout(r,15)); assert.equal(calls.length,1); release(); await Promise.all(submissions); assert.equal(commits,1)
    })
    for (const failure of ['blocked','ignoredSet','corrupt','sessionChanged','missingSession','scopeChanged']) await test(failure+' refuses before HTTP '+body.action,async () => {
      const api = load()('app/src/lib/lifecycle-write.ts')
      if (failure === 'corrupt') { const saved = await api.mobileLifecycleAttempts.prepare(actor,champ,body); values.set(saved.storageKey,'broken') }
      blocked = failure === 'blocked'; ignoredSet = failure === 'ignoredSet'; changeAfterPersistence = failure === 'sessionChanged'; if (failure === 'missingSession') sessionActor = null
      let count = 0
      await assert.rejects(() => api.writeMobileLifecycle(champ,actor,contract,body,() => { if (failure === 'scopeChanged' && ++count > 1) throw Error('Old scope') }))
      assert.equal(calls.length,0); assert.equal(values.size,['corrupt','sessionChanged','scopeChanged'].includes(failure) ? 1 : 0)
    })
    for (const mutate of [r => ({ ok: true }), r => ({...r,actor_id:id(99)}), r => ({...r,request_id:id(99)}), r => ({...r,campeonato_id:id(99)}), r => ({...r,registrations_open:true}), r => ({...r,edition:{...r.edition,status:'cancelada'}})]) await test('invalid acknowledgement remains pending '+body.action,async () => {
      const api = load()('app/src/lib/lifecycle-write.ts'); bad = mutate
      await assert.rejects(() => api.writeMobileLifecycle(champ,actor,contract,body),/confirmar/); assert.equal(values.size,1)
    })
    for (const code of [404,503]) await test('HTML '+code+' has no legacy fallback '+body.action,async () => {
      status = code; await assert.rejects(() => load()('app/src/lib/lifecycle-write.ts').writeMobileLifecycle(champ,actor,contract,body)); assert.equal(calls.length,1); assert.equal(values.size,1)
    })
  }
  for (const value of ['unavailable','legacy',undefined]) await test('new intent refuses disabled/unknown negotiation '+value,async () => {
    await assert.rejects(() => load()('app/src/lib/lifecycle-write.ts').writeMobileLifecycle(champ,actor,{...contract,lifecycle_write_mode:value},bodies[0]),/indisponíveis/)
    assert.equal(calls.length,0); assert.equal(values.size,0)
  })
  await test('mismatched actor negotiation refuses',async () => { await assert.rejects(() => load()('app/src/lib/lifecycle-write.ts').writeMobileLifecycle(champ,actor,{...contract,edition_actor_id:id(99)},bodies[0]),/conta mudou/); assert.equal(calls.length,0) })
  await test('read-only preview creates no journal',async () => { const api = load()('app/src/lib/lifecycle-write.ts'); const data = await api.previewMobileLifecycle(champ,actor,contract,'publish_final'); assert.equal(data.preview.plan.champion_name,'Team'); assert.equal(values.size,0); assert.equal(commits,0) })
  await test('preview rejects foreign winner',async () => { bad = r => ({...r,preview:{...r.preview,plan:{...r.preview.plan,champion_id:id(99)}}}); await assert.rejects(() => load()('app/src/lib/lifecycle-write.ts').previewMobileLifecycle(champ,actor,contract,'publish_final')); assert.equal(values.size,0) })
  for (const failure of ['actor','championship','date','status']) await test('board refuses foreign/invalid '+failure,async () => {
    boardPatch = failure === 'actor' ? {edition_actor_id:id(99)} : {edition:{id:edition,campeonato_id:failure === 'championship' ? id(99) : champ,status:failure === 'status' ? 'weird' : 'ativa',data_fim:failure === 'date' ? 'invalid' : null}}
    await assert.rejects(() => load()('app/src/lib/lifecycle-write.ts').readMobileLifecycleBoard(champ,actor,() => {}))
  })
  for (const failure of ['flag','permission']) await test('board negotiation unavailable '+failure,async () => { mode = failure === 'flag' ? 'legacy' : 'atomic'; manage = failure !== 'permission'; const board = await load()('app/src/lib/lifecycle-write.ts').readMobileLifecycleBoard(champ,actor,() => {}); assert.equal(board.contract.lifecycle_write_mode,'unavailable') })
  await test('journal isolated by account and championship',async () => { const attempts = load()('app/src/lib/lifecycle-write.ts').mobileLifecycleAttempts; await attempts.prepare(actor,champ,bodies[0]); assert.equal(await attempts.read(id(99),champ),null); assert.equal(await attempts.read(actor,id(99)),null) })
  await test('changed fence refuses new HTTP over pending original',async () => { const api = load()('app/src/lib/lifecycle-write.ts'); await api.mobileLifecycleAttempts.prepare(actor,champ,bodies[0]); await assert.rejects(() => api.writeMobileLifecycle(champ,actor,contract,{...bodies[0],expected:{...fence,revision:8}}),/pendente/); assert.equal(calls.length,0) })
  await test('failed cleanup retains receipt for replay',async () => { const api = load()('app/src/lib/lifecycle-write.ts'); ignoredRemove = true; await api.writeMobileLifecycle(champ,actor,contract,bodies[0]); assert.equal(values.size,1); ignoredRemove = false; assert.equal((await api.writeMobileLifecycle(champ,actor,contract,bodies[0])).repetida,true); assert.equal(commits,1) })
  await test('explicit discard validates original and sends no request',async () => { const api = load()('app/src/lib/lifecycle-write.ts'); const saved = await api.mobileLifecycleAttempts.prepare(actor,champ,bodies[0]); await assert.rejects(() => api.discardMobileLifecycle(champ,actor,{...saved,requestId:id(99)}),/tentativa mudou/); await api.discardMobileLifecycle(champ,actor,saved); assert.equal(values.size,0); assert.equal(calls.length,0) })
  await test('discard refuses stale session and ignored removal',async () => { const api = load()('app/src/lib/lifecycle-write.ts'); const saved = await api.mobileLifecycleAttempts.prepare(actor,champ,bodies[0]); sessionActor = id(99); await assert.rejects(() => api.discardMobileLifecycle(champ,actor,saved)); sessionActor = actor; ignoredRemove = true; await assert.rejects(() => api.discardMobileLifecycle(champ,actor,saved),/encerrar/); assert.equal(values.size,1) })
  await test('discard and another family cannot cross active lease',async () => { const loader = load(), api = loader('app/src/lib/lifecycle-write.ts'); let release; hold = new Promise(r => release = r); const primary = api.writeMobileLifecycle(champ,actor,contract,bodies[0]); await new Promise(r => setTimeout(r,15)); const pending = await api.mobileLifecycleAttempts.read(actor,champ); await assert.rejects(() => api.discardMobileLifecycle(champ,actor,pending),/andamento/); await assert.rejects(() => loader('backend/src/campeonatos/championship-operation.ts').runChampionshipOperation(actor,champ,'another-family',false,async () => {}),/andamento/); release(); await primary })
  await test('stale retry never recreates completed journal UUID',async () => { const api = load()('app/src/lib/lifecycle-write.ts'); const pending = await api.mobileLifecycleAttempts.prepare(actor,champ,bodies[0]); await api.retryMobileLifecycle(champ,actor,pending); await assert.rejects(() => api.retryMobileLifecycle(champ,actor,pending),/tentativa mudou/); assert.equal(calls.length,1); assert.equal(commits,1); assert.equal(values.size,0) })
  await test('retry refuses changed body and another journal UUID',async () => { const api = load()('app/src/lib/lifecycle-write.ts'); const pending = await api.mobileLifecycleAttempts.prepare(actor,champ,bodies[0]); await assert.rejects(() => api.retryMobileLifecycle(champ,actor,{...pending,body:{...pending.body,expected:{...fence,revision:8}}}),/tentativa mudou/); await assert.rejects(() => api.retryMobileLifecycle(champ,actor,{...pending,requestId:id(99)}),/tentativa mudou/); assert.equal(calls.length,0); assert.equal(values.size,1) })
  await test('35-second timeout retains original intent',async () => {
    globalThis.setTimeout = (fn,ms,...rest) => original.setTimeout(fn,ms === 35000 ? 2 : ms,...rest)
    const network = globalThis.fetch; globalThis.fetch = async (_url,options) => new Promise((_,reject) => options.signal.addEventListener('abort',() => reject(Error('abort'))))
    try { await assert.rejects(() => load()('app/src/lib/lifecycle-write.ts').writeMobileLifecycle(champ,actor,contract,bodies[0]),/Tempo esgotado/); assert.equal(values.size,1) } finally { globalThis.fetch = network; globalThis.setTimeout = original.setTimeout }
  })
  const report = process.env.MOBILE_LIFECYCLE_TEST_REPORT
  if (report) fs.writeFileSync(report,JSON.stringify({ checks, failures:0, scope:'Real mobile transport/contracts/journal/lease; synthetic Auth/HTTP/storage, no device/project calls.' },null,2)+'\n')
  console.log(`Mobile lifecycle: ${checks} checks passed.`)
} finally { globalThis.fetch = original.fetch; globalThis.setTimeout = original.setTimeout }
