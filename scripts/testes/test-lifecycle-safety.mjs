import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server.js'
import { fixtureLoader } from './ts-fixture-loader.mjs'
import { match } from './lib/postgrest-fixture.mjs'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const actor = id(1), champ = id(20), editionId = id(30)
let tables, calls, auth, manage, canView, failTable, insertPending, failReload, sessionActor, current, rawBody
function reset() {
 auth = manage = canView = current = true; failTable = null; insertPending = false; failReload = false; sessionActor = actor; calls = []; rawBody = null
 tables = {
  campeonatos: [{ id: champ, tipo: 'diario' }],
  campeonato_edicoes: [{ id: editionId, campeonato_id: champ, status: 'ativa', data_fim: null, metadados: { keep: 'preserved' } }],
  campeonato_etapas: [{ id: id(40), edicao_id: editionId, status: 'ativa' }, { id: id(41), edicao_id: editionId, status: 'cancelada' }, { id: id(42), edicao_id: editionId, status: 'encerrada' }],
  campeonato_divisoes: [{ id: id(50), edicao_id: editionId, status: 'planejada' }],
  campeonato_configuracoes: [{ id: id(60), campeonato_id: champ, aceita_novas_inscricoes_equipes: true }],
  campeonato_partidas: [{ id: id(70), campeonato_id: champ, status: 'finalizada' }],
 }
}
const admin = createClient('https://lifecycle-fixture.supabase.co', 'fixture-key', { auth: { persistSession: false }, global: { fetch: async (input, options = {}) => {
 const url = new URL(input), table = url.pathname.split('/').at(-1), method = options.method || 'GET'
 calls.push({ table, method, filters: [...url.searchParams] })
 assert.ok(!url.pathname.includes('/rpc/'), 'no synthetic RPC should be requested')
 if (method === 'PATCH' && insertPending) { insertPending = false; tables.campeonato_partidas.push({ id: id(71), campeonato_id: champ, status: 'agendada' }) }
 if (method === 'PATCH' && table === failTable) return Response.json({ code: 'XX000', message: 'PRIVATE_FAILURE' }, { status: 400 })
 if (method === 'POST') {
  tables[table] ||= []; tables[table].push({ id: id(81), ...JSON.parse(options.body) })
  return Response.json(tables[table].at(-1), { status: 201 })
 }
 const rows = (tables[table] || []).filter(row => [...url.searchParams].every(([field, filter]) => ['select', 'order', 'offset', 'limit'].includes(field) || match(row, `${field}.${filter}`)))
 if (method === 'PATCH') { const patch = JSON.parse(options.body); for (const row of rows) Object.assign(row, patch) }
 if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'Content-Range': `*/${rows.length}` } })
 return Response.json(new Headers(options.headers).get('Accept')?.includes('vnd.pgrst.object') ? rows[0] || null : rows)
 } } })
const overrides = {
 '@backend/shared/supabase-admin': { supabaseAdmin: admin },
 '@backend/auth/server-auth': { getBearerUser: async () => { if (!auth) throw Error('Sessao invalida.'); return { id: actor } } },
 '@backend/campeonatos/campeonato-permissions': { getCampeonatoPermission: async () => ({ canView, canManage: manage, role: canView ? 'owner' : 'none' }), permissionPublicPayload: value => value },
 '@backend/campeonatos/estatisticas/estatisticas.service': { carregarResumoCampeao: async () => ({ fase: null, final_concluida: true, aguardando_desempate: false, campeao: { campeonato_equipe_id: id(80) } }), listarEstatisticasEquipes: async () => [{ campeonato_equipe_id: id(80), pontos_total: 10 }] },
 '@backend/campeonatos/advanced-structure-read': { loadAdvancedStructure: async () => { if (failReload) throw Error('PRIVATE_RELOAD'); return { edition: structuredClone(tables.campeonato_edicoes[0]), stages: [] } } },
 '@/lib/supabase-browser': { supabase: { auth: { getSession: async () => ({ data: { session: sessionActor ? { user: { id: sessionActor }, access_token: 'fixture-token' } : null } }) } } },
}
const snapshot = 'relatorios-testes/lifecycle-2026-10-12/legacy-route.snapshot.ts'
const legacy = fixtureLoader(overrides)(snapshot), route = fixtureLoader(overrides)('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
const params = { params: Promise.resolve({ id: champ }) }
const request = (action, token = 'fixture-token', body = { action }) => new NextRequest('https://fixture.invalid/api', { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', 'Idempotency-Key': id(999) }, body: JSON.stringify(body) })
const writes = () => calls.filter(c => c.method === 'PATCH')
let checks = 0
const results = []
async function test(name, fn) { reset(); await fn(); checks++; results.push(name); console.log('PASS ' + name) }
// Historical handler, frozen before removing its unsafe writers. No real project access.
for (const table of ['campeonato_etapas', 'campeonato_divisoes', 'campeonato_edicoes', 'campeonato_configuracoes']) {
 await test('legacy publish failure leaves partial state: ' + table, async () => {
  failTable = table; const before = structuredClone(tables); const response = await legacy.POST(request('publish_final'), params)
  assert.equal(response.status, 400); assert.equal(writes().length, 4); assert.notDeepEqual(tables, before)
  assert.deepEqual(tables[table], before[table]); assert.equal(tables.campeonato_etapas[1].status, 'cancelada')
 })
}
for (const table of ['campeonato_etapas', 'campeonato_divisoes', 'campeonato_edicoes']) {
 await test('legacy reopen failure leaves partial state: ' + table, async () => {
  tables.campeonato_edicoes[0].status = 'encerrada'; tables.campeonato_divisoes[0].status = 'encerrada'
  failTable = table; const before = structuredClone(tables); assert.equal((await legacy.POST(request('reopen_final'), params)).status, 400)
  assert.equal(writes().length, 3); assert.notDeepEqual(tables, before); assert.deepEqual(tables[table], before[table])
 })
}
await test('legacy publication accepts a new unfinished fall after validation', async () => {
 insertPending = true; assert.equal((await legacy.POST(request('publish_final'), params)).status, 200)
 assert.equal(tables.campeonato_edicoes[0].status, 'encerrada'); assert.equal(tables.campeonato_partidas.at(-1).status, 'agendada')
})
await test('legacy retry ignores original UUID and performs eight writes', async () => {
 assert.equal((await legacy.POST(request('publish_final'), params)).status, 200); assert.equal((await legacy.POST(request('publish_final'), params)).status, 200)
 assert.equal(writes().length, 8)
})
await test('legacy reload failure reports an error after all four writes', async () => {
 failReload = true; assert.equal((await legacy.POST(request('publish_final'), params)).status, 400)
 assert.equal(tables.campeonato_edicoes[0].status, 'encerrada'); assert.equal(tables.campeonato_configuracoes[0].aceita_novas_inscricoes_equipes, false)
})
await test('legacy reopening loses prior stage status and retains old winner metadata', async () => {
 tables.campeonato_edicoes[0].metadados.final_campeao_campeonato_equipe_id = id(80)
 await legacy.POST(request('publish_final'), params); assert.equal((await legacy.POST(request('reopen_final'), params)).status, 200)
 assert.equal(tables.campeonato_etapas[2].status, 'ativa'); assert.equal(tables.campeonato_divisoes[0].status, 'ativa')
 assert.equal(tables.campeonato_edicoes[0].metadados.final_campeao_campeonato_equipe_id, id(80))
 assert.equal(tables.campeonato_configuracoes[0].aceita_novas_inscricoes_equipes, false)
})
const historicalChecks = checks
for (const action of ['publish_final', 'reopen_final', ' publish_final ']) for (const method of ['POST', 'PATCH', 'DELETE']) {
 await test(method + ' refuses lifecycle before any table request: ' + action.trim(), async () => {
  const before = structuredClone(tables); const response = await route[method](request(action), params)
  assert.equal(response.status, 503); assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.deepEqual(tables, before); assert.equal(calls.length, 0)
  assert.match((await response.json()).error, /temporariamente indisponíveis/)
 })
}
for (const action of ['publish_final', 'reopen_final']) for (const denied of ['bearer', 'session', 'view', 'manage']) {
 await test('auth before blocked ' + action + ': ' + denied, async () => {
  if (denied === 'session') auth = false; if (denied === 'view') canView = false; if (denied === 'manage') manage = false
  const response = await route.POST(request(action, denied === 'bearer' ? null : 'fixture-token'), params)
  assert.equal(response.status, ['bearer', 'session'].includes(denied) ? 401 : 403); assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.equal(calls.length, 0)
 })
}
await test('manage denial happens before parsing JSON', async () => {
 manage = false; let parsed = false; const req = request('publish_final'); req.json = async () => { parsed = true; throw Error('private') }
 assert.equal((await route.POST(req, params)).status, 403); assert.equal(parsed, false); assert.equal(calls.length, 0)
})
await test('GET explicitly exposes unavailable mode while retaining readable edition', async () => {
 const response = await route.GET(request('GET'), params); assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store')
 const body = await response.json(); assert.equal(body.lifecycle_write_mode, 'unavailable'); assert.equal(body.edition.status, 'ativa')
})
await test('ordinary prize operation remains functional', async () => {
 const response = await route.POST(request('create_prize', 'fixture-token', { action: 'create_prize', stage_id: id(40), prize_type: 'colocacao', position: 1, title: 'Prize', value: 50 }), params)
 assert.equal(response.status, 200); assert.equal(tables.campeonato_etapa_premiacoes.length, 1)
 assert.equal(tables.campeonato_etapa_premiacoes[0].etapa_id, id(40)); assert.equal(tables.campeonato_etapa_premiacoes[0].valor, 50)
 assert.equal(tables.campeonato_edicoes[0].status, 'ativa'); assert.equal(writes().length, 0)
})
const originalFetch = globalThis.fetch
try {
 globalThis.fetch = async (url, options) => {
  assert.equal(options.method, 'GET'); assert.equal(options.cache, 'no-store'); assert.ok(options.signal)
  calls.push({ method: options.method, url }); return rawBody ? Response.json(rawBody) : route.GET(new NextRequest('https://fixture.invalid' + url, options), params)
 }
 const read = fixtureLoader(overrides)('web/lib/edition-lifecycle-read.ts').readEditionLifecycle
 const run = () => read(champ, actor, () => current, new AbortController().signal)
 await test('read-only client checks its own actor and championship', async () => { assert.deepEqual(await run(), { status: 'ativa', data_fim: null }); assert.equal(calls.length, 1) })
 await test('read-only client accepts absent edition without fabricating status', async () => { rawBody = { edition: null, edition_actor_id: actor }; assert.equal(await run(), null) })
 for (const denied of [null, id(99)]) await test('read-only client denies missing/other session before HTTP', async () => { sessionActor = denied; await assert.rejects(run); assert.equal(calls.length, 0) })
 await test('resource epoch invalidated before HTTP is refused', async () => { current = false; await assert.rejects(run); assert.equal(calls.length, 0) })
 for (const body of [{ edition_actor_id: id(99), edition: tables.campeonato_edicoes[0] }, { edition_actor_id: actor, edition: { campeonato_id: id(99), status: 'ativa', data_fim: null } }, { edition_actor_id: actor, edition: { campeonato_id: champ, status: 'invented', data_fim: null } }, { edition_actor_id: actor, edition: { campeonato_id: champ, status: 'ativa', data_fim: 'private-date' } }]) {
  await test('invalid/foreign lifecycle DTO is refused', async () => { rawBody = body; await assert.rejects(run) })
 }
 await test('session/resource changes during GET are refused after response', async () => {
  globalThis.fetch = async () => { current = false; sessionActor = id(99); return Response.json({ edition_actor_id: actor, edition: tables.campeonato_edicoes[0] }) }
  await assert.rejects(run)
 })
} finally { globalThis.fetch = originalFetch }
const target = process.env.LIFECYCLE_TEST_REPORT
if (target) fs.writeFileSync(target, JSON.stringify({ generatedAt: new Date().toISOString(), checks, historicalChecks, currentChecks: checks - historicalChecks, results, snapshot: { file: snapshot, sha256: createHash('sha256').update(fs.readFileSync(snapshot)).digest('hex') }, scope: 'Real legacy/current handlers and Supabase SDK; isolated fake HTTP/Auth, no native PostgreSQL or project calls.' }, null, 2) + '\n')
console.log(`Lifecycle safety: ${checks} checks passed (${historicalChecks} historical reproductions; ${checks - historicalChecks} current).`)
