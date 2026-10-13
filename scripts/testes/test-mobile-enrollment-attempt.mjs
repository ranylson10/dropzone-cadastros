import assert from 'node:assert/strict'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const values = new Map(), replies = new Map(), keys = []
let blocked = false, commits = 0, lost = false, malformed = false
const storage = { getItem: async key => { await Promise.resolve(); if (blocked) throw new Error('fixture unavailable'); return values.get(key) ?? null }, setItem: async (key, value) => { await Promise.resolve(); if (blocked) throw new Error('fixture unavailable'); values.set(key, value) }, removeItem: async key => values.delete(key) }
const overrides = {
  'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: async (algorithm, text) => { assert.equal(algorithm, 'SHA-256'); return createHash('sha256').update(text).digest('hex') }, randomUUID },
  [path.resolve('app/src/lib/secureStorage.ts')]: { secureStorage: storage },
  '@/config/env': { apiUrl: url => 'https://mobile-fixture.invalid' + url },
}
const load = () => fixtureLoader(overrides), api = load()('app/src/lib/enrollment-attempt.ts'), transport = load()('app/src/lib/api.ts')
const body = { equipe_id: 'team', line_id: null, nome_line: 'Private line', slot_id: 'slot' }, originalFetch = globalThis.fetch
const result = kind => ({ kind, token: 'PRIVATE-TOKEN', payload: {} })
let scenarios = 0
try {
  const attempt = await api.prepareMobileEnrollmentAttempt('actor', 'team', 'PRIVATE-TOKEN', body)
  assert.equal((await load()('app/src/lib/enrollment-attempt.ts').prepareMobileEnrollmentAttempt('actor', 'team', 'PRIVATE-TOKEN', { slot_id: 'slot', nome_line: 'Private line', equipe_id: 'team' })).requestId, attempt.requestId); scenarios++
  assert.ok(!JSON.stringify([...values]).includes('PRIVATE-TOKEN')); assert.ok(!JSON.stringify([...values]).includes('Private line')); scenarios++
  const parallel = await Promise.all(Array.from({ length: 6 }, () => api.prepareMobileEnrollmentAttempt('parallel', 'group', 'T', body)))
  assert.equal(new Set(parallel.map(item => item.requestId)).size, 1); scenarios++
  for (const [actor, kind, token, data] of [['other', 'team', 'PRIVATE-TOKEN', body], ['actor', 'group', 'PRIVATE-TOKEN', body], ['actor', 'team', 'T', body], ['actor', 'team', 'PRIVATE-TOKEN', { ...body, slot_id: 'different' }]]) {
    assert.notEqual((await api.prepareMobileEnrollmentAttempt(actor, kind, token, data)).requestId, attempt.requestId); scenarios++
  }
  await api.completeMobileEnrollmentAttempt({ ...attempt, requestId: randomUUID() }); assert.equal(values.get(attempt.storageKey), attempt.requestId); scenarios++
  await api.completeMobileEnrollmentAttempt(attempt); assert.equal(values.has(attempt.storageKey), false); scenarios++
  blocked = true; await assert.rejects(() => api.prepareMobileEnrollmentAttempt('blocked', 'group', 'T', body), /guardar esta tentativa/); blocked = false; scenarios++
  await assert.rejects(() => api.prepareMobileEnrollmentAttempt('', 'group', 'T', body), /Entre novamente/); scenarios++
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, 'mobile-fixture.invalid')
    const headers = new Headers(options.headers), key = headers.get('Idempotency-Key'); keys.push(key)
    if (new URL(url).pathname.includes('/public/inscricao/')) { assert.equal(key, null); return Response.json({ inscricao: { id: 'player' } }) }
    assert.match(key, /^[\da-f-]{36}$/i)
    assert.equal(headers.get('Authorization'), 'Bearer fixture-token')
    if (malformed) return Response.json({})
    const repeated = replies.has(key)
    if (!repeated) { replies.set(key, { ok: true, line: { id: 'line' }, slot_letra: 'A' }); commits++ }
    if (lost) { lost = false; throw new Error('Fixture response lost after commit') }
    return Response.json({ ...replies.get(key), repetida: repeated })
  }
  for (const kind of ['team_championship_invite', 'group_registration']) {
    values.clear(); keys.length = 0; replies.clear(); commits = 0; lost = true
    await assert.rejects(() => transport.executeDetailedQuickTokenAction(result(kind), body, 'fixture-token', 'actor'), /response lost/)
    assert.equal(commits, 1)
    const replay = await transport.executeDetailedQuickTokenAction(result(kind), body, 'fixture-token', 'actor')
    assert.equal(replay.repetida, true); assert.equal(keys[0], keys[1]); assert.equal(commits, 1); assert.equal(values.size, 0); scenarios++
  }
  keys.length = 0
  await assert.rejects(() => transport.executeDetailedQuickTokenAction(result('team_championship_invite'), body, 'fixture-token'), /Entre novamente/)
  assert.equal(keys.length, 0); scenarios++
  malformed = true
  await assert.rejects(() => transport.executeDetailedQuickTokenAction(result('group_registration'), body, 'fixture-token', 'actor'), /confirmar o resultado/)
  assert.equal(values.size, 1); scenarios++
  malformed = false
  assert.equal((await transport.executeDetailedQuickTokenAction(result('player_registration'), { campeonato_equipe_id: 'part' }, 'fixture-token')).inscricao.id, 'player'); scenarios++
  console.log(`Mobile enrollment passed: ${scenarios} fixture scenarios; persistence/restart/concurrency/HTTP replay/no storage no POST. Crypto/storage native implementations require device QA.`)
} finally { globalThis.fetch = originalFetch }
