import assert from 'node:assert/strict'
import path from 'node:path'
import { createHash, randomUUID, webcrypto } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server.js'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const actor = id(1), champ = id(2), version = '2026-10-12T03:10:00.123456+00:00'
const expected = { equipe_id: id(5), line_id: id(6), slot_id: null, status: 'pendente', updated_at: version }
const participation = [
  ['POST', { equipe_id: id(5), line_id: id(6), slot_id: id(7) }],
  ['POST', { equipe_id: id(5), line_id: null, nome_line: 'Nova line', slot_id: id(7) }],
  ['POST', { mode: 'request', equipe_id: id(5), line_id: id(6) }],
  ['PATCH', { mode: 'review_request', action: 'approve', participacao_id: id(8), slot_id: id(7), expected }],
  ['PATCH', { mode: 'review_request', action: 'reject', participacao_id: id(8), motivo: 'Revisar elenco', expected }],
  ['DELETE', { expected: { ...expected, status: 'ativo', slot_id: id(7) } }, id(8)],
]
const move = { mode: 'move', source_slot_id: id(7), target_slot_id: id(9), source_participation_id: id(8), target_participation_id: null }
const batchExpected = [0, 1].map(n => ({ id: id(8 + n), slot_id: id(30 + n), equipe_id: id(40 + n), line_id: id(50 + n), updated_at: version }))
const movement = [
  ['PATCH', move], ['PATCH', { ...move, mode: 'swap', target_participation_id: id(10) }],
  ['PATCH', { mode: 'shuffle_group', group_id: id(20), expected: batchExpected }],
  ['PATCH', { mode: 'distribute_phase', phase_id: id(21), group_ids: [id(20), id(22)], strategy: 'balanced', expected: batchExpected }],
]
let auth = true, authReads = 0, permissions = 0, tableReads = 0, legacyWrites = 0, commits = 0, calls = [], absent = 0, fault = null
const receipts = new Map(), storage = new Map()
function result(name, args) {
  if (name === 'fn_gravar_participacao_atomica') {
    const a = args.p_args, action = args.p_action, location = ['add', 'approve'].includes(action)
    const part = { id: a.participacao_id || id(8), campeonato_id: champ, equipe_id: a.equipe_id || a.expected?.equipe_id,
      line_id: a.line_id || a.expected?.line_id || id(6), status: action === 'request' ? 'pendente' : action === 'remove' ? 'removido' : action === 'reject' ? 'rejeitado' : 'ativo',
      slot_id: location ? a.slot_id : null, grupo_id: location ? id(20) : null, slot_numero: location ? 1 : null, updated_at: version,
      ...(action === 'reject' ? { motivo_rejeicao: a.motivo } : {}) }
    return { ok: true, campeonato_id: champ, action, participacao: part,
      ...(['add', 'request', 'approve'].includes(action) ? { line: { id: part.line_id, nome: 'Line fixture', criada_agora: false } } : {}) }
  }
  if (name === 'fn_transferir_slots_atomico') return { ok: true, campeonato_id: champ, mode: args.p_mode, action: args.p_mode, mensagem: 'Movida.',
    source_slot_id: args.p_source_slot_id, target_slot_id: args.p_target_slot_id,
    source_participation_id: args.p_source_participation_id, target_participation_id: args.p_target_participation_id,
    participacoes: [
      { id: args.p_source_participation_id, slot_id: args.p_target_slot_id, equipe_id: id(5), line_id: id(6), grupo_id: id(20), slot_numero: 2, updated_at: version },
      ...(args.p_target_participation_id ? [{ id: args.p_target_participation_id, slot_id: args.p_source_slot_id, equipe_id: id(11), line_id: id(12), grupo_id: id(20), slot_numero: 1, updated_at: version }] : []),
    ] }
  assert.equal(name, 'fn_distribuir_slots_atomico')
  return { ok: true, campeonato_id: champ, mode: args.p_mode, action: args.p_mode === 'shuffle_group' ? 'shuffle' : 'distribute',
    phase_id: args.p_phase_id, strategy: args.p_strategy, group_ids: args.p_group_ids, expected_count: args.p_expected.length,
    participacoes: args.p_expected.map((row, n) => ({ ...row, slot_id: id(60 + n), grupo_id: args.p_group_ids[n % args.p_group_ids.length], slot_numero: n + 1 })),
    distribuicao: args.p_group_ids.map((grupo_id, n) => ({ grupo_id, equipes: args.p_expected.filter((_, i) => i % args.p_group_ids.length === n).length })) }
}
const admin = createClient('https://atomic-route-fixture.supabase.co', 'fixture', { auth: { persistSession: false }, global: { fetch: async (input, options) => {
  const url = new URL(input)
  if (!url.pathname.includes('/rpc/')) {
    tableReads++; assert.equal(url.pathname, '/rest/v1/campeonato_equipes'); assert.equal(options.method || 'GET', 'GET')
    return Response.json({ id: id(8), campeonato_id: champ, ...expected, slot_id: id(7), grupo_id: id(20), slot_numero: 1 })
  }
  const args = JSON.parse(options.body), name = url.pathname.split('/').at(-1)
  calls.push({ name, args }); assert.equal(args.p_actor_id, actor); assert.equal(args.p_campeonato_id, champ)
  if (fault === 'missing') return Response.json({ code: 'PGRST202', message: 'PRIVATE missing RPC' }, { status: 404 })
  const key = args.p_actor_id + ':' + args.p_request_id, previous = receipts.get(key), identity = JSON.stringify(args)
  if (previous) { assert.equal(previous.identity, identity); return Response.json({ ...previous.data, repetida: true }) }
  const data = result(name, args); commits++; receipts.set(key, { identity, data })
  if (fault === 'lost') { fault = null; throw Error('PRIVATE lost after commit') }
  return Response.json(data)
} } })
const overrides = {
  '@backend/shared/supabase-admin': { supabaseAdmin: admin },
  '@backend/auth/server-auth': { getBearerUser: async request => {
    authReads++; assert.equal(request.headers.get('Authorization'), 'Bearer fixture-session')
    if (!auth) throw Error('Sessão inválida'); return { id: actor }
  } },
  '@backend/campeonatos/campeonato-permissions': { getCampeonatoPermission: async () => { permissions++; return { role: 'owner', canManage: true, canRemove: true } } },
  '@backend/campeonatos/participacao-sync': { softRemoveParticipacao: async () => { legacyWrites++ } },
  '@/lib/supabase-browser': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: actor }, access_token: 'fixture-session' } } }) } } },
  [path.resolve('app/src/lib/supabase.ts')]: { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: actor }, access_token: 'fixture-session' } } }) } } },
  [path.resolve('app/src/lib/secureStorage.ts')]: { secureStorage: { getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => { storage.set(k, v) }, removeItem: async k => { storage.delete(k) } } },
  '@/config/env': { apiUrl: p => 'https://fixture.invalid' + p },
  'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, randomUUID, digestStringAsync: async (_, text) => createHash('sha256').update(text).digest('hex') },
}
const load = () => fixtureLoader(overrides)
const routes = load(), canonical = routes('web/app/api/campeonatos/[id]/equipes/route.ts')
const endpoints = { participation: routes('web/app/api/campeonatos/[id]/equipes/participacao-atomica/route.ts'), movement: routes('web/app/api/campeonatos/[id]/equipes/movimentacao-atomica/route.ts') }
const names = { participation: 'participacao-atomica', movement: 'movimentacao-atomica' }, forms = { participation, movement }
const modes = { participation: 'PARTICIPATION_WRITE_MODE', movement: 'SLOT_MOVEMENT_MODE' }
const original = { fetch: globalThis.fetch, storage: globalThis.sessionStorage, crypto: Object.getOwnPropertyDescriptor(globalThis, 'crypto'), p: process.env.PARTICIPATION_WRITE_MODE, s: process.env.SLOT_MOVEMENT_MODE }
globalThis.sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => { storage.set(k, v) }, removeItem: k => { storage.delete(k) } }
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
const reset = () => { auth = true; authReads = permissions = tableReads = legacyWrites = commits = absent = 0; calls = []; fault = null; receipts.clear(); storage.clear() }
function request(family, method, body, remove, key = id(99)) {
  const url = `https://fixture.invalid/api/campeonatos/${champ}/equipes/${names[family]}` + (remove ? '?participacao_id=' + remove : '')
  return endpoints[family][method](new NextRequest(url, { method, headers: { Authorization: 'Bearer fixture-session', 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: champ }) })
}
const zero = () => { assert.equal(tableReads + legacyWrites + calls.length, 0); assert.equal(permissions, 0) }
let cases = 0
try {
  for (const family of ['participation', 'movement']) {
    for (const mode of ['legacy', undefined, 'typo']) for (const [method, body, remove] of forms[family]) {
      reset(); if (mode === undefined) delete process.env[modes[family]]; else process.env[modes[family]] = mode
      const response = await request(family, method, body, remove)
      assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store'); zero(); assert.equal(authReads, 1); cases++
    }
    process.env[modes[family]] = 'atomic'; process.env[modes[family === 'participation' ? 'movement' : 'participation']] = 'typo'
    for (const [method, body, remove] of forms[family]) {
      reset(); const response = await request(family, method, body, remove)
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(calls.length, 1); assert.equal(tableReads + legacyWrites, 0); assert.equal(authReads, 1)
      assert.equal((await response.json()).campeonato_id, champ); cases++
      assert.equal((await request(family, method, body, remove)).status, 200); assert.equal(commits, 1); cases++
      reset(); auth = false; const denied = await request(family, method, '{invalid', remove)
      assert.equal(denied.status, 400); zero(); assert.equal(authReads, 1); cases++
    }
  }
  process.env.PARTICIPATION_WRITE_MODE = process.env.SLOT_MOVEMENT_MODE = 'atomic'
  for (const [family, method, body] of [['participation', 'PATCH', move], ['movement', 'PATCH', participation[3][1]], ['movement', 'PATCH', { mode: 'apply_progression' }]]) {
    reset(); assert.equal((await request(family, method, body)).status, 400); zero(); cases++
  }
  reset(); assert.equal((await request('participation', 'POST', { mode: 'apply_league_season_suggestions' })).status, 400); zero(); cases++
  for (const [family, operations] of Object.entries(forms)) for (const [method, body, remove] of operations) {
    reset(); assert.equal((await request(family, method, body, remove, null)).status, 400); assert.equal(tableReads + legacyWrites + calls.length, 0); cases++
  }
  for (const marker of ['', 'unknown', 'participation,movement', 'ATOMIC']) {
    reset(); const req = new NextRequest('https://fixture.invalid/api', { method: 'PATCH', headers: { Authorization: 'Bearer fixture-session', 'X-DropZone-Atomic-Operation': marker }, body: '{}' })
    let parsed = 0; req.json = async () => { parsed++; throw Error('PRIVATE parsed') }
    assert.equal((await canonical.PATCH(req, { params: Promise.resolve({ id: champ }) })).status, 400); assert.equal(parsed, 0); zero(); cases++
  }
  for (const family of ['participation', 'movement']) {
    reset(); process.env[modes[family]] = 'legacy'
    const req = new NextRequest('https://fixture.invalid/api', { method: 'PATCH', headers: { Authorization: 'Bearer fixture-session', 'X-DropZone-Atomic-Operation': family }, body: '{}' })
    let parsed = 0; req.json = async () => { parsed++; throw Error('PRIVATE parsed') }
    assert.equal((await canonical.PATCH(req, { params: Promise.resolve({ id: champ }) })).status, 503); assert.equal(parsed, 0); zero(); cases++
  }
  // Historical clients may send keys in legacy mode. Keys alone cannot opt them into a new protocol.
  process.env.PARTICIPATION_WRITE_MODE = process.env.SLOT_MOVEMENT_MODE = 'legacy'
  for (const key of [id(99), null]) {
    reset(); const req = new NextRequest(`https://fixture.invalid/api?participacao_id=${id(8)}`, { method: 'DELETE', headers: { Authorization: 'Bearer fixture-session', ...(key ? { 'Idempotency-Key': key } : {}) } })
    assert.equal((await canonical.DELETE(req, { params: Promise.resolve({ id: champ }) })).status, 200); assert.equal(legacyWrites, 1); assert.equal(tableReads, 1); assert.equal(calls.length, 0); cases++
  }
  const clientCalls = []
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url, 'https://fixture.invalid'), key = new Headers(options.headers).get('Idempotency-Key')
    clientCalls.push({ path: parsed.pathname, method: options.method, body: options.body, key })
    const family = parsed.pathname.endsWith('/participacao-atomica') ? 'participation' : parsed.pathname.endsWith('/movimentacao-atomica') ? 'movement' : null
    assert.ok(family, 'Atomic clients must never fall back to the legacy URL')
    if (absent) return Response.json({ error: 'Contrato indisponível.' }, { status: absent })
    return endpoints[family][options.method](new NextRequest(parsed, { ...options, headers: new Headers(options.headers) }), { params: Promise.resolve({ id: champ }) })
  }
  for (const platform of ['web', 'mobile']) for (const family of ['participation', 'movement']) {
    const metadata = family === 'participation' ? { participation_write_mode: 'atomic', participation_actor_id: actor } : { slot_movement_mode: 'atomic', slot_movement_actor_id: actor }
    const send = () => {
      const modules = load()
      if (family === 'participation') return platform === 'web' ? modules('web/lib/participation-write.ts').writeParticipation(champ, metadata, 'POST', participation[0][1])
        : modules('app/src/lib/participation-write.ts').writeMobileParticipation(champ, metadata, 'POST', participation[0][1], 'fixture-session', actor)
      return platform === 'web' ? modules('web/lib/slot-movement-write.ts').writeSlotMovement(champ, metadata, move)
        : modules('app/src/lib/slot-transfer-write.ts').writeMobileSlotTransfer(champ, metadata, move, 'fixture-session', actor)
    }
    for (const scenario of ['flag-disabled', 'not-found', 'method-unavailable', 'missing-rpc', 'lost-after-commit']) {
      reset(); clientCalls.length = 0; process.env.PARTICIPATION_WRITE_MODE = process.env.SLOT_MOVEMENT_MODE = 'atomic'
      if (scenario === 'flag-disabled') process.env[modes[family]] = 'legacy'
      if (scenario === 'not-found') absent = 404
      if (scenario === 'method-unavailable') absent = 405
      if (scenario === 'missing-rpc') fault = 'missing'
      if (scenario === 'lost-after-commit') fault = 'lost'
      await assert.rejects(send); assert.equal(storage.size, 1); assert.equal(clientCalls.length, 1)
      assert.equal(tableReads + legacyWrites, 0); assert.equal(commits, scenario === 'lost-after-commit' ? 1 : 0)
      assert.ok(!JSON.stringify([...storage]).includes('fixture-session')); cases++
      process.env.PARTICIPATION_WRITE_MODE = process.env.SLOT_MOVEMENT_MODE = 'atomic'; absent = 0; fault = null
      const response = await send(); assert.equal(response.ok, true); assert.equal(storage.size, 0); assert.equal(commits, 1)
      assert.equal(clientCalls.length, 2); assert.deepEqual(clientCalls[0], clientCalls[1]); assert.equal(tableReads + legacyWrites, 0); cases++
    }
  }
  console.log(`Atomic operation routes passed: ${cases} fixtures; dedicated routes/auth before guards, independent flags, zero legacy writes on 503/404/405/missing RPC, durable original replay, and historical canonical legacy compatibility. Supabase/Auth/receipts are controlled HTTP fixtures, not staging.`)
} finally {
  globalThis.fetch = original.fetch
  if (original.storage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = original.storage
  if (original.crypto) Object.defineProperty(globalThis, 'crypto', original.crypto); else delete globalThis.crypto
  if (original.p === undefined) delete process.env.PARTICIPATION_WRITE_MODE; else process.env.PARTICIPATION_WRITE_MODE = original.p
  if (original.s === undefined) delete process.env.SLOT_MOVEMENT_MODE; else process.env.SLOT_MOVEMENT_MODE = original.s
}
