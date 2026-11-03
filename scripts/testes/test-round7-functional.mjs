// R07: authenticated legacy team routes must not restore blocked/foreign/reserved slots.
// Everything here is an isolated Supabase fixture, never connected to production.
import assert from 'node:assert/strict'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const id = name => name
const part = { id: id('part'), equipe_id: id('team'), line_id: id('line'), grupo_id: null, slot_id: null, slot_numero: null }
const history = { fase_id: id('phase'), grupo_anterior_id: id('group'), slot_anterior_id: id('slot') }
let cases = 0

function context(data = {}) {
  const state = {
    scenario: 'base', writes: [], tableReads: [], ...data,
    group: { id: 'group', fase_id: 'phase', ...(data.group || {}) },
    slot: { id: 'slot', grupo_id: 'group', fase_id: 'phase', slot_numero: 2, status: 'livre', equipe_id: null, line_id: null, ...(data.slot || {}) },
  }
  const db = { from(name) {
    const filters = []
    const query = {
      select() { return query }, eq(column, value) { filters.push([column, value]); return query },
      is() { return query }, in() { return query }, or() { return query },
      not() { return query }, order() { return query }, limit() { return query }, gt() { return query },
      update(value) { state.writes.push({ name, type: 'update', value }); return query },
      insert(value) { state.writes.push({ name, type: 'insert', value }); return query },
      maybeSingle() {
        state.tableReads.push({ name, filters })
        return Promise.resolve({ data: name === 'campeonato_grupos' ? state.group
          : name === 'campeonato_grupo_escolha_configuracoes' ? { aberta: true, permite_troca: true }
          : name === 'campeonato_grupo_escolha_historico' ? history
          : name === 'campeonato_slots' ? state.slot : null, error: null })
      },
      then(resolve, reject) {
        state.tableReads.push({ name, filters })
        const values = {
          equipes: state.notOwner ? [] : [{ id: 'team' }], campeonato_equipes: [state.assigned ? { ...part, grupo_id:'group', slot_id:'slot', slot_numero:2 } : part],
          campeonato_grupo_escolha_bloqueios: state.blocks || [],
          lili_reservas_slot: state.lili || [], tokens: state.invites || [],
        }
        return Promise.resolve({ data: values[name] || [], error: null }).then(resolve, reject)
      },
    }
    return query
  } }
  const routes = fixtureLoader({
    '@backend/shared/supabase-admin': { supabaseAdmin: db },
    '@backend/auth/server-auth': { getBearerUser: async () => { if (state.unauthenticated) throw new Error('Sessao inválida'); return { id: 'owner' } } },
    '@backend/campeonatos/group-choice-transport': { tryAtomicGroupChoice: async () => state.atomic ? { ok: true, operation_confirmed: true } : null },
    '@backend/campeonatos/group-choice-window': { groupChoiceWindowIsOpen: () => true },
    '@backend/campeonatos/slot-transfer': { slotTransferErrorResponse: () => null },
    'next/server': { NextResponse: { json: (value, options) => new Response(JSON.stringify(value), options) } },
  })('web/app/api/campeonatos/[id]/escolha-grupo/route.ts')
  return { routes, state }
}
async function call(data, method = 'PUT') {
  const { routes, state } = context(data)
  const response = await routes[method](new Request('https://fixture.invalid/api', { method, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campeonato_equipe_id: 'part', grupo_id: 'group', slot_id: 'slot' }) }),
  { params: Promise.resolve({ id: 'champ' }) })
  return { response, payload: await response.json(), state }
}
for (const [name, state, expected] of [
  ['blocked group restore', { blocks: [{ grupo_id: 'group', slot_id: null, motivo: 'fechado' }] }, /bloqueado/],
  ['blocked slot restore', { blocks: [{ grupo_id: null, slot_id: 'slot', motivo: 'administrativo' }] }, /bloqueado/],
  ['active Lili reservation restore', { lili: [{ id: 'reservation' }] }, /reserva ativa/],
  ['active invite restore', { invites: [{ id: 'invite', expira_em: new Date(Date.now()+3600000).toISOString() }] }, /convite ativo/],
  ['null expiration invite restore', { invites: [{ id: 'invite', expira_em: null }] }, /convite ativo/],
  ['invalid expiration invite restore', { invites: [{ id: 'invite', expira_em: 'invalid' }] }, /convite ativo/],
  ['group moved to other phase restore', { group: { fase_id: 'other' } }, /fase original/],
  ['slot moved to another phase restore', { slot: { fase_id: 'other' } }, /fase original/],
  ['slot occupied restore', { slot: { status: 'ocupado', line_id:'competitor' } }, /disponível/],
]) {
  const { response, payload, state: observed } = await call(state)
  assert.equal(response.status, 400, name)
  assert.match(payload.error, expected, name)
  assert.equal(observed.writes.length, 0, `No writes before rejecting: ${name}`)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  cases++
}
for (const [name, state, expected] of [
  ['blocked group assign', { assigned: true, blocks: [{ grupo_id: 'group', motivo:'fechado' }] }, /bloqueado/],
  ['blocked slot assign', { assigned: true, blocks: [{ slot_id: 'slot' }] }, /bloqueado/],
  ['Lili reservation assign', { assigned: true, lili: [{ id: 'res' }] }, /reserva ativa/],
  ['invite reservation assign', { assigned: true, invites: [{ id: 'tok', expira_em:null }] }, /convite ativo/],
  ['slot in different phase assign', { assigned:true, slot: {fase_id:'other'} }, /fase do grupo/],
]) {
  const { response, payload, state: observed } = await call(state, 'POST')
  assert.equal(response.status, 400, name)
  assert.match(payload.error, expected, name)
  assert.equal(observed.writes.length, 0, name)
  cases++
}
// Expired invitations are not live reservations; the normal assignment can proceed.
const expired = await call({ assigned: true, invites: [{ id:'old',expira_em:'2020-01-01T00:00:00Z' }] }, 'POST')
assert.equal(expired.response.status, 200)
assert.ok(expired.state.writes.some(row => row.name === 'campeonato_slots' && row.type === 'update'))
cases++
for (const [scenario, expectedStatus] of [ ['unauthenticated', 401], ['notOwner', 400] ]) {
  const { response, state } = await call({ [scenario]: true })
  assert.equal(response.status, expectedStatus, scenario)
  assert.equal(state.writes.length, 0, scenario)
  cases++
}
for (const method of ['POST','PUT']) {
  const {response,state} = await call({atomic:true},method)
  assert.equal(response.status, 200, `atomic ${method} remains delegated to the RPC`)
  assert.deepEqual(state.tableReads, [], 'Do not add legacy reads to atomic calls')
  assert.deepEqual(state.writes, [], 'Do not add legacy writes to atomic calls')
  cases++
}
console.log(`R07: ${cases} HTTP fixture scenarios passed. Restore/assign fail closed for administrative blocks, Lili, invite and cross-phase slots.`)
