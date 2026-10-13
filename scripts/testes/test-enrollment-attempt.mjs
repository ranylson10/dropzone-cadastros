import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const originalStorage = globalThis.sessionStorage, originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
const values = new Map()
let unavailable = false
const storage = {
  getItem: key => { if (unavailable) throw new Error('fixture storage blocked'); return values.get(key) ?? null },
  setItem: (key, value) => { if (unavailable) throw new Error('fixture quota'); values.set(key, value) },
  removeItem: key => values.delete(key),
}
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
globalThis.sessionStorage = storage
const load = () => fixtureLoader()('web/features/token-flow/enrollment-attempt.ts')
const api = load(), body = { equipe_id: 'team', line_id: null, nome_line: ' Line privada ', slot_id: 'slot' }
let scenarios = 0
try {
  const a = await api.prepareEnrollmentAttempt('actor', 'team', 'PRIVATE-TOKEN', body)
  const retry = await load().prepareEnrollmentAttempt('actor', 'team', 'PRIVATE-TOKEN', { slot_id: 'slot', nome_line: 'Line privada', line_id: undefined, equipe_id: 'team' })
  assert.equal(a.requestId, retry.requestId); scenarios++
  assert.ok(!JSON.stringify([...values]).includes('PRIVATE-TOKEN')); assert.ok(!JSON.stringify([...values]).includes('privada')); scenarios++
  for (const [actor, kind, token, data] of [
    ['other', 'team', 'PRIVATE-TOKEN', body], ['actor', 'group', 'PRIVATE-TOKEN', body], ['actor', 'team', 'other-token', body],
    ['actor', 'team', 'PRIVATE-TOKEN', { ...body, equipe_id: 'other' }], ['actor', 'team', 'PRIVATE-TOKEN', { ...body, slot_id: 'other' }],
    ['actor', 'team', 'PRIVATE-TOKEN', { ...body, nome_line: 'other' }], ['actor', 'team', 'PRIVATE-TOKEN', { ...body, line_id: 'existing' }],
  ]) { assert.notEqual((await api.prepareEnrollmentAttempt(actor, kind, token, data)).requestId, a.requestId); scenarios++ }
  const parallel = await Promise.all(Array.from({ length: 6 }, () => api.prepareEnrollmentAttempt('parallel', 'team', 'TOKEN', body)))
  assert.equal(new Set(parallel.map(attempt => attempt.requestId)).size, 1); scenarios++
  api.completeEnrollmentAttempt({ ...a, requestId: parallel[0].requestId }); assert.equal(values.get(a.storageKey), a.requestId); scenarios++
  api.completeEnrollmentAttempt(a); assert.equal(values.has(a.storageKey), false)
  assert.notEqual((await api.prepareEnrollmentAttempt('actor', 'team', 'PRIVATE-TOKEN', body)).requestId, a.requestId); scenarios++
  values.set(a.storageKey, 'corrupt')
  await assert.rejects(() => api.prepareEnrollmentAttempt('actor', 'team', 'PRIVATE-TOKEN', body), /guardar esta tentativa/); scenarios++
  unavailable = true
  await assert.rejects(() => api.prepareEnrollmentAttempt('blocked', 'team', 'TOKEN', body), /guardar esta tentativa/); scenarios++
  await assert.rejects(() => api.prepareEnrollmentAttempt('', 'team', 'TOKEN', body), /Entre novamente/); scenarios++
  console.log(`Enrollment attempt passed: ${scenarios} fixture scenarios; durable key, isolation, confirmed completion and storage fail-closed.`)
} finally {
  if (originalStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = originalStorage
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto); else delete globalThis.crypto
}
