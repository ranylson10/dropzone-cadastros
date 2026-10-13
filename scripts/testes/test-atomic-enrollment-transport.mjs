import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const actor = { user: { id: id(1) }, accounts: [{ id: id(2), profile_type: 'equipe' }] }
const defaultTeam = { id: id(2), nome: 'Fixture', permissoes: { pode_editar: true, pode_escalar: true } }
let calls = [], legacy = [], teams = [defaultTeam], fault = null, commits = 0, failAuth = false
const receipts = new Map()
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function result(args) {
  const part = { id: id(5), equipe_id: args.p_equipe_id, line_id: args.p_line_id || id(3), slot_id: args.p_slot_id || id(4), grupo_id: id(6) }
  const common = { ok: true, participacao: part, equipe: { id: part.equipe_id, nome: 'Fixture' }, line: { id: part.line_id, nome: args.p_nome_line || 'Line fixture', criada_agora: !args.p_line_id }, mensagem: 'Line inscrita.' }
  return args.p_kind === 'team' ? { ...common, slot: { id: part.slot_id, letra: 'A', numero: 1 }, grupo: { id: id(6), nome: 'Group' }, slot_letra: 'A' }
    : { ...common, campeonato_equipe_id: part.id, grupo_id: part.grupo_id, slot_id: part.slot_id, slot_letra: 'A', referencia: 'Line fixture', valor_inscricao: 5, precisa_pagamento: true, link: { usos: 1, limite_vagas: 2, restantes: 1, encerrado: false } }
}
const admin = createClient('https://atomic-fixture.supabase.co', 'fixture-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, options) => {
  const url = new URL(input)
  assert.equal(url.hostname, 'atomic-fixture.supabase.co')
  assert.equal(url.pathname, '/rest/v1/rpc/fn_inscrever_por_convite_atomico', 'no legacy table reads or writes in atomic path')
  assert.equal(options.method, 'POST')
  const args = JSON.parse(options.body); calls.push(args)
  if (fault && fault !== 'lost') return reply(fault.success ?? fault, fault.success ? 200 : 400)
  const key = `${args.p_actor_id}:${args.p_request_id}`, fingerprint = JSON.stringify(args), saved = receipts.get(key)
  if (saved) return saved.fingerprint === fingerprint ? reply({ ...saved.data, repetida: true })
    : reply({ code: '22023', message: 'Chave de repetição vinculada a outros dados.', details: 'PRIVATE SQL' }, 400)
  const data = result(args); receipts.set(key, { fingerprint, data }); commits++
  if (fault === 'lost') { fault = null; throw new Error('PRIVATE SQL simulated lost response after commit') }
  return reply(data)
} } })
const load = fixtureLoader({
  '@backend/shared/supabase-admin': { supabaseAdmin: admin },
  '@backend/equipes/manager-team-access': { listControllableEquipes: async userId => { assert.equal(userId, actor.user.id); return teams } },
  '@backend/campeonatos/invites/team-invite-accept': { acceptTeamInvite: async (...args) => { legacy.push('team'); return { ok: true } } },
  '@backend/campeonatos/invites/group-invite-accept': { acceptGroupInvite: async (...args) => { legacy.push('group'); return { ok: true } } },
  '@backend/auth/server-auth': { getBearerUser: async req => { if (failAuth || !req.headers.get('authorization')) throw new Error('Sessao ausente.'); return actor.user }, getAccountsForUser: async () => actor.accounts },
})
const dispatch = load('backend/src/campeonatos/invites/invite-enrollment.ts')
const api = load('backend/src/campeonatos/invites/atomic-enrollment.ts')
const routes = { team: load('web/app/api/convites/equipe/[token]/route.ts'), group: load('web/app/api/convites/grupo/[token]/route.ts') }
const body = { equipe_id: id(2), line_id: id(3), slot_id: id(4) }
const savedMode = process.env.INVITE_ENROLLMENT_MODE
const reset = () => { calls = []; legacy = []; teams = [defaultTeam]; fault = null; commits = 0; failAuth = false; receipts.clear() }
const request = (kind, data = body, key = id(9), token = 'literal%2F.*') => routes[kind].POST(new Request('https://fixture.invalid/api', { method: 'POST', headers: { authorization: 'Bearer fixture', 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(data) }), { params: Promise.resolve({ token }) })
let scenarios = 0
try {
  delete process.env.INVITE_ENROLLMENT_MODE
  for (const kind of ['team', 'group']) { reset(); await dispatch.acceptInvite(kind, actor, 'T', body, null); assert.deepEqual(legacy, [kind]); assert.equal(calls.length, 0); scenarios++ }
  process.env.INVITE_ENROLLMENT_MODE = 'misspelled'
  reset(); await assert.rejects(() => dispatch.acceptInvite('team', actor, 'T', body, id(9)), error => error.status === 503); assert.equal(calls.length + legacy.length, 0); scenarios++
  process.env.INVITE_ENROLLMENT_MODE = 'atomic'
  for (const kind of ['team', 'group']) {
    reset()
    const response = await request(kind, { ...body, actor_id: id(999), request_id: id(999), vaga_index: 0, referencia_equipe: ' Referência ' })
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), result(calls[0]))
    assert.equal(calls.length, 1); assert.equal(calls[0].p_actor_id, actor.user.id); assert.equal(calls[0].p_request_id, id(9))
    assert.equal(calls[0].p_token, 'literal%2F.*'); assert.equal(calls[0].p_kind, kind); assert.equal(legacy.length, 0); scenarios++
    const repeated = await request(kind); assert.equal(repeated.status, kind === 'group' ? 409 : 200) // group changed reference/index is a different fingerprint
    const same = await request(kind, { ...body, vaga_index: 0, referencia_equipe: ' Referência ' }); assert.equal(same.status, 200); assert.equal((await same.json()).repetida, true); assert.equal(commits, 1); scenarios++
  }
  for (const kind of ['team', 'group']) {
    reset(); fault = 'lost'
    const lost = await request(kind); assert.equal(lost.status, 503); assert.equal((await lost.json()).resultado_incerto, true)
    assert.equal(commits, 1)
    const replay = await request(kind); assert.equal(replay.status, 200); assert.equal((await replay.json()).repetida, true)
    assert.equal(commits, 1); assert.equal(calls[0].p_request_id, calls[1].p_request_id); assert.equal(legacy.length, 0); scenarios++
  }
  for (const key of [null, 'bad', [], id(9) + ',' + id(10)]) { reset(); const response = await request('team', body, key); assert.equal(response.status, 400); assert.equal(calls.length + legacy.length, 0); scenarios++ }
  for (const invalid of [null, [], 3, { ...body, line_id: {} }, { ...body, slot_id: 'wrong' }, { ...body, nome_line: ['x'], line_id: null }, { ...body, vaga_index: [] }, { ...body, vaga_index: true }, { ...body, vaga_index: -1 }, { ...body, vaga_index: 2147483648 }]) {
    reset(); const response = await request('group', invalid); assert.equal(response.status, 400); assert.equal(calls.length + legacy.length, 0); scenarios++
  }
  reset(); failAuth = true; const unauthorized = await routes.team.POST({ headers: new Headers(), json: () => { throw new Error('body must not be read before auth') } }, { params: Promise.resolve({ token: 'T' }) }); assert.equal(unauthorized.status, 400); assert.equal(calls.length + legacy.length, 0); scenarios++
  reset(); teams = [{ ...defaultTeam, permissoes: { pode_editar: false, pode_escalar: false } }]; assert.equal((await request('team')).status, 400); assert.equal(calls.length, 0); scenarios++
  reset(); teams = [{ ...defaultTeam, permissoes: { pode_editar: false, pode_escalar: true } }]; assert.equal((await request('team', { ...body, line_id: null, nome_line: 'New' })).status, 400); assert.equal(calls.length, 0); assert.equal((await request('team')).status, 200); scenarios++
  reset(); teams = [defaultTeam, { ...defaultTeam, id: id(22) }]; assert.equal((await request('team', { ...body, equipe_id: undefined })).status, 400); assert.equal(calls.length, 0); assert.equal((await request('team')).status, 200); scenarios++
  for (const error of [
    { code: 'PGRST202', message: 'PRIVATE SQL missing function', status: 503 },
    { code: '42883', message: 'PRIVATE SQL undefined function', status: 503 },
    { code: '40P01', message: 'PRIVATE SQL deadlock', status: 409 },
    { code: '40001', message: 'PRIVATE SQL serialization', status: 409 },
    { code: '55P03', message: 'PRIVATE SQL lock timeout', status: 409 },
    { code: '57014', message: 'PRIVATE SQL statement cancelled', status: 503 },
    { code: '23505', message: 'PRIVATE SQL constraint row', status: 409 },
    { code: '42501', message: 'Sem permissão para inscrever ou criar a line.', status: 403 },
    { code: '22023', message: 'Inscrições fechadas ou prazo encerrado neste campeonato.', status: 409 },
    { code: '22023', message: 'PRIVATE SQL unexpected validation', status: 503 },
  ]) {
    reset(); fault = { code: error.code, message: error.message, details: 'PRIVATE SQL full row', hint: 'PRIVATE SQL secret' }
    const response = await request('group'); assert.equal(response.status, error.status); assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE SQL')); assert.equal(calls.length, 1); assert.equal(legacy.length, 0); scenarios++
  }
  reset(); fault = { success: { ok: true, line: { id: id(3) } } }; const malformed = await request('team'); assert.equal(malformed.status, 503); assert.equal(legacy.length, 0); scenarios++
  for (const kind of ['team', 'group']) {
    reset(); const invalid = result({ p_kind: kind, p_equipe_id: id(2), p_line_id: id(3), p_slot_id: id(4) }); invalid.equipe.id = id(999)
    fault = { success: invalid }; assert.equal((await request(kind)).status, 503); assert.equal(legacy.length, 0); scenarios++
  }
  reset(); const parallel = await Promise.all([request('group'), request('group')]); assert.ok(parallel.every(response => response.status === 200)); assert.equal(commits, 1); scenarios++
  assert.equal(api.enrollmentErrorResponse(new Error('Known domain'), 'Fallback').body.error, 'Known domain')
  assert.equal(api.enrollmentErrorResponse({ message: 'PRIVATE SQL' }, 'Fallback').body.error, 'Fallback')
  console.log(`Atomic enrollment transport passed: ${scenarios} fixture scenarios, no real writes; default legacy, atomic no-fallback, actor/DTO/errors/replay verified.`)
} finally {
  if (savedMode == null) delete process.env.INVITE_ENROLLMENT_MODE; else process.env.INVITE_ENROLLMENT_MODE = savedMode
}
