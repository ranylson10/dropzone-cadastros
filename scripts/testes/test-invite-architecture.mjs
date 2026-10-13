import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server.js'
import { fixtureLoader } from './ts-fixture-loader.mjs'
import { match } from './lib/postgrest-fixture.mjs'
import { backendServiceEvidence } from './lib/backend-service-evidence.mjs'

const routeFile = 'web/app/api/campeonatos/[id]/managers/convites/route.ts'
const snapshot = 'relatorios-testes/lote-duplo-2026-10-12/convites/legacy-route.snapshot.ts'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const actor = id(1), champ = id(20), otherChamp = id(21), manager = id(30), invitation = id(40), notification = id(50)
let tables, calls, auth, bodyReads, fail
function reset() {
  auth = true; bodyReads = 0; calls = []; fail = null
  tables = {
    campeonatos: [{ id: champ, nome: 'Champ', produtora_id: id(10), criado_por: actor, deleted_at: null }],
    produtoras: [{ id: id(10), nome: 'Producer', auth_user_id: actor }],
    managers: [{ id: manager, username: 'manager', nome: 'Manager', auth_user_id: id(2), public_id: 123, status: 'ativo' }],
    campeonato_manager_convites: [], campeonato_vendedores: [], notificacoes: [],
  }
}
const admin = createClient('https://invite-architecture-fixture.supabase.co', 'fixture-key', { auth: { persistSession: false }, global: { fetch: async (input, options = {}) => {
  const url = new URL(input), table = url.pathname.split('/').at(-1), method = options.method || 'GET'
  assert.equal(url.hostname, 'invite-architecture-fixture.supabase.co')
  assert.ok(!url.pathname.includes('/rpc/'), 'This extraction introduces no RPC or production calls.')
  const payload = options.body ? JSON.parse(options.body) : null
  calls.push({ table, method, filters: [...url.searchParams], payload })
  if (fail?.table === table && fail.method === method) return Response.json({ code: fail.code || 'XX000', message: fail.message || 'fixture failure' }, { status: 400 })
  let rows = (tables[table] || []).filter(row => [...url.searchParams].every(([field, filter]) => ['select', 'order', 'limit', 'offset'].includes(field) || match(row, `${field}.${filter}`)))
  if (method === 'POST') {
    const row = { id: table === 'notificacoes' ? notification : invitation, ...payload }
    tables[table].push(row); rows = [row]
  }
  if (method === 'PATCH') for (const row of rows) Object.assign(row, payload)
  const order = url.searchParams.get('order')
  if (order) { const [column, direction] = order.split('.'); rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (direction === 'desc' ? -1 : 1)) }
  const limit = url.searchParams.get('limit'); if (limit) rows = rows.slice(0, Number(limit))
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'Content-Range': `*/${rows.length}` } })
  const selected = url.searchParams.get('select')
  if (selected && selected !== '*') rows = rows.map(row => Object.fromEntries(selected.split(',').filter(key => key in row).map(key => [key, row[key]])))
  return Response.json(new Headers(options.headers).get('Accept')?.includes('vnd.pgrst.object') ? rows[0] || null : rows)
} } })
const overrides = {
  '@backend/shared/supabase-admin': { supabaseAdmin: admin },
  '@backend/auth/server-auth': { getBearerUser: async () => { if (!auth) throw Error('Sessao invalida.'); return { id: actor } } },
}
const load = fixtureLoader(overrides), legacy = load(snapshot), route = load(routeFile)
const request = (method, body = {}, query = '') => {
  const req = new NextRequest(`https://fixture.invalid/api/campeonatos/${champ}/managers/convites${query}`, { method, headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) })
  const json = req.json.bind(req); req.json = () => { bodyReads++; return json() }; return req
}
const context = championshipId => ({ params: Promise.resolve({ id: championshipId || champ }) })
const run = async (handler, method, body = {}, query = '', championshipId) => {
  const response = await handler[method](request(method, body, query), context(championshipId))
  return { status: response.status, body: await response.json(), tables: structuredClone(tables), calls: structuredClone(calls), bodyReads }
}
const pending = (changes = {}) => ({ id: invitation, campeonato_id: champ, manager_id: manager, tipo: 'convite', status: 'pendente', notificacao_id: notification, ...changes })
let checks = 0, historicalChecks = 0
const results = []
const ActualDate = Date
globalThis.Date = class extends ActualDate { constructor(...args) { super(...(args.length ? args : ['2026-10-12T12:00:00.000Z'])) } static now() { return new ActualDate('2026-10-12T12:00:00.000Z').getTime() } }
async function test(name, fn, historical = false) { reset(); await fn(); checks++; if (historical) historicalChecks++; results.push({ name, historical }); console.log('PASS ' + name) }
async function parity(name, method, body, setup = () => {}) {
  await test('legacy/current parity: ' + name, async () => { setup(); const before = await run(legacy, method, body); reset(); setup(); const after = await run(route, method, body); assert.deepEqual(after, before) })
}
try {
  await parity('list with invitation and active seller projections', 'GET', {}, () => { tables.campeonato_manager_convites.push(pending()); tables.campeonato_vendedores.push({ id: id(60), campeonato_id: champ, manager_id: manager, status: 'ativo', limite_vagas: 3 }) })
  await parity('empty listing avoids unnecessary managers query', 'GET', {})
  await parity('producer-owner access independent from creator', 'GET', {}, () => { tables.campeonatos[0].criado_por = id(99) })
  await parity('championship creator access independent from producer owner', 'GET', {}, () => { tables.produtoras[0].auth_user_id = id(99) })
  await parity('unauthorized list exposes no invitations', 'GET', {}, () => { tables.campeonatos[0].criado_por = tables.produtoras[0].auth_user_id = id(99) })
  await parity('deleted championship unavailable', 'GET', {}, () => { tables.campeonatos[0].deleted_at = '2026-10-01' })
  await parity('missing invitation relation keeps setup_required payload', 'GET', {}, () => { fail = { table: 'campeonato_manager_convites', method: 'GET', code: '42P01' } })
  await parity('create by active manager id plus permissions and commission', 'POST', { manager_id: manager, mensagem: '  Hello  ', validade_dias: 10, limite_vagas: 4, comissao_percentual: 12.5, permissoes: { adicionar_equipes: true } })
  for (const [field, value] of [['manager_username', '@manager'], ['q', '123'], ['username', 'MANAGER']]) await parity('create by ' + field, 'POST', { [field]: value })
  await parity('commission over 20 percent rejected', 'POST', { manager_id: manager, comissao: 21 })
  await parity('message truncated and validity capped', 'POST', { manager_id: manager, mensagem: 'x'.repeat(700), validade_dias: 300, limite_vagas: -4 })
  await parity('inactive manager rejected', 'POST', { manager_id: manager }, () => { tables.managers[0].status = 'inativo' })
  await parity('manager without login rejected', 'POST', { manager_id: manager }, () => { tables.managers[0].auth_user_id = null })
  await parity('self invitation rejected', 'POST', { manager_id: manager }, () => { tables.managers[0].auth_user_id = actor })
  await parity('active seller cannot be invited again', 'POST', { manager_id: manager }, () => { tables.campeonato_vendedores.push({ id: id(60), campeonato_id: champ, manager_id: manager, status: 'ativo' }) })
  await parity('pending duplicate rejected', 'POST', { manager_id: manager }, () => { tables.campeonato_manager_convites.push(pending()) })
  await parity('30 pending invitations cap preserved', 'POST', { manager_id: manager }, () => { for (let n = 0; n < 30; n++) tables.campeonato_manager_convites.push(pending({ id: id(100 + n), manager_id: id(200 + n) })) })
  await parity('missing invitation relation creation diagnostic preserved', 'POST', { manager_id: manager }, () => { fail = { table: 'campeonato_manager_convites', method: 'POST', code: '42P01' } })
  for (const method of ['GET', 'POST', 'DELETE']) {
    await test(method + ' rejects invalid session before application queries or payload', async () => { auth = false; const value = await run(route, method, { manager_id: manager, convite_id: invitation }); assert.equal(value.status, 400); assert.equal(calls.length, 0); assert.equal(bodyReads, 0) })
    await test(method + ' rejects other owner before invitation queries and payload', async () => { tables.campeonatos[0].criado_por = tables.produtoras[0].auth_user_id = id(99); const value = await run(route, method, { manager_id: manager, convite_id: invitation }); assert.equal(value.status, 400); assert.equal(bodyReads, 0); assert.deepEqual(calls.map(call => call.table), ['campeonatos', 'produtoras']) })
  }
  await test('listing retains maximum 50 and excludes other championship and inactive sellers', async () => {
    for (let n = 0; n < 60; n++) tables.campeonato_manager_convites.push(pending({ id: id(100 + n), created_at: String(n).padStart(2, '0') }))
    tables.campeonato_manager_convites.push(pending({ id: id(500), campeonato_id: otherChamp, created_at: '99' }))
    tables.campeonato_vendedores.push({ id: id(60), campeonato_id: champ, status: 'inativo' }, { id: id(61), campeonato_id: otherChamp, status: 'ativo' })
    const value = await run(route, 'GET'); assert.equal(value.body.convites.length, 50); assert.equal(value.body.convites[0].created_at, '59'); assert.deepEqual(value.body.vendedores, [])
  })
  await test('legacy cancellation also cancels an incoming pedido', async () => { tables.campeonato_manager_convites.push(pending({ tipo: 'pedido' })); tables.notificacoes.push({ id: notification, status: 'nao_lida' }); const value = await run(legacy, 'DELETE', { convite_id: invitation }); assert.equal(value.status, 200); assert.equal(tables.campeonato_manager_convites[0].status, 'cancelado'); assert.equal(tables.notificacoes[0].status, 'arquivada') }, true)
  for (const [name, changes] of [['incoming pedido', { tipo: 'pedido' }], ['other championship', { campeonato_id: otherChamp }], ['accepted invitation', { status: 'aceito' }]]) {
    await test('current cancellation refuses ' + name + ' and preserves notification', async () => { tables.campeonato_manager_convites.push(pending(changes)); tables.notificacoes.push({ id: notification, status: 'nao_lida' }); const before = structuredClone(tables); const value = await run(route, 'DELETE', { convite_id: invitation }); assert.equal(value.status, 400); assert.deepEqual(tables, before); assert.ok(!calls.some(call => call.table === 'notificacoes')) })
  }
  for (const byQuery of [false, true]) await test('cancels own pending invitation via ' + (byQuery ? 'query' : 'body') + ' and archives notification', async () => {
    tables.campeonato_manager_convites.push(pending()); tables.notificacoes.push({ id: notification, status: 'nao_lida' })
    const value = await run(route, 'DELETE', byQuery ? {} : { convite_id: invitation }, byQuery ? '?convite_id=' + invitation : '')
    assert.equal(value.status, 200); assert.deepEqual(value.body, { ok: true }); assert.equal(tables.campeonato_manager_convites[0].status, 'cancelado'); assert.equal(tables.notificacoes[0].status, 'arquivada')
    const mutation = calls.find(call => call.method === 'PATCH' && call.table === 'campeonato_manager_convites')
    for (const filter of [['campeonato_id', 'eq.' + champ], ['tipo', 'eq.convite'], ['status', 'eq.pendente']]) assert.ok(mutation.filters.some(item => item[0] === filter[0] && item[1] === filter[1]))
  })
  await test('application service retains authorization when called outside HTTP', async () => { tables.campeonatos[0].criado_por = tables.produtoras[0].auth_user_id = id(99); let parsed = false; const service = load('backend/src/campeonatos/manager-invite-service.ts'); await assert.rejects(service.createChampionshipManagerInvite(champ, actor, async () => { parsed = true; return { manager_id: manager } }), /Somente o admin/); assert.equal(parsed, false); assert.ok(!calls.some(call => call.method !== 'GET')) })
  await test('thin route remains visible to transitive security scanners', async () => {
    const source = fs.readFileSync(routeFile, 'utf8'), evidence = backendServiceEvidence(source, path.resolve(routeFile))
    assert.ok(evidence.files.includes('backend/src/campeonatos/manager-invite-service.ts')); assert.ok(evidence.files.includes('backend/src/campeonatos/manager-champ-invites.ts'))
    assert.match(evidence.source, /getBearerUser\(/); assert.match(evidence.source, /requireCampeonatoAdmin\(/); assert.match(evidence.source, /supabaseAdmin/); assert.match(evidence.source, /\.eq\('campeonato_id', campeonatoId\)/)
    assert.doesNotMatch(source, /supabaseAdmin|\.from\(|sellerCommissionBps|createNotificacao/)
  })
} finally { globalThis.Date = ActualDate }
const report = { generatedAt: new Date().toISOString(), checks, historicalChecks, currentChecks: checks - historicalChecks, results, snapshot: { file: snapshot, sha256: createHash('sha256').update(fs.readFileSync(snapshot)).digest('hex') }, scope: 'Real legacy/current route handlers, application services, authorization/normalizers and Supabase SDK; fake HTTP/Auth only; no PostgreSQL, project calls or delivery of real notifications.' }
if (process.env.INVITE_ARCHITECTURE_REPORT) fs.writeFileSync(process.env.INVITE_ARCHITECTURE_REPORT, JSON.stringify(report, null, 2) + '\n')
console.log(`Invite architecture: ${checks} passed (${historicalChecks} historical; ${checks - historicalChecks} current).`)
