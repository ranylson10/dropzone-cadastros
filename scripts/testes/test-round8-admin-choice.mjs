// R08: isolated HTTP fixtures; NEVER uses Supabase credentials or the network.
import assert from 'node:assert/strict'
import { fixtureLoader } from './ts-fixture-loader.mjs'

let cases = 0
function harness({ action = 'assign_group_manual', group = {}, slot = {}, blocks = [], lili = [], invites = [],
  denied = false, noSession = false, atomic = false, history = {}, participation = {} } = {}) {
  const state = { reads: [], writes: [] }
  const rows = {
    campeonato_equipes: { id: 'participation', equipe_id: 'team', line_id: 'line', status: 'ativo', grupo_id: action === 'cancel_group_choice_admin' ? 'group' : null,
      slot_id: action === 'cancel_group_choice_admin' ? 'slot' : null, ...participation },
    campeonato_grupos: { id: 'group', fase_id: 'phase', ...group },
    campeonato_slots: { id: 'slot', grupo_id: 'group', fase_id: 'phase', status: action === 'cancel_group_choice_admin' ? 'ocupado' : 'livre',
      slot_numero: 2, equipe_id: action === 'cancel_group_choice_admin' ? 'team' : null, line_id: action === 'cancel_group_choice_admin' ? 'line' : null, ...slot },
    campeonato_grupo_escolha_historico: { fase_id: 'phase', grupo_anterior_id: 'group', slot_anterior_id: 'slot', ...history },
  }
  const db = { from(name) {
    const filters = []
    const query = {
      select() { return query }, eq(col, value) { filters.push([col, value]); return query },
      is() { return query }, in() { return query }, not() { return query }, order() { return query }, limit() { return query }, gt() { return query },
      update(values) { state.writes.push({ name, operation: 'update', values }); return query },
      insert(values) { state.writes.push({ name, operation: 'insert', values }); return query },
      maybeSingle() { state.reads.push({ name, filters }); return Promise.resolve({ data: rows[name] ?? null, error: null }) },
      then(resolve, reject) {
        state.reads.push({ name, filters });
        const data = name === 'campeonato_grupo_escolha_bloqueios' ? blocks
          : name === 'lili_reservas_slot' ? lili : name === 'tokens' ? invites : []
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return query
  } }
  const routes = fixtureLoader({
    '@backend/shared/supabase-admin': { supabaseAdmin: db },
    '@backend/auth/server-auth': { getBearerUser: async () => { if (noSession) throw new Error('Sessao invalida.'); return { id: 'admin' } } },
    '@backend/campeonatos/campeonato-permissions': { getCampeonatoPermission: async () => ({ canManage: !denied, canView: !denied, role: denied ? 'none' : 'owner' }), permissionPublicPayload: () => ({}) },
    '@backend/campeonatos/lifecycle-safety': { assertLifecycleActionSafe: () => {} },
    '@backend/campeonatos/lifecycle-transport': { tryAtomicLifecycle: async () => null, lifecycleMode: () => 'unavailable' },
    '@backend/campeonatos/group-choice-transport': { tryAtomicGroupChoice: async () => atomic ? {ok:true,operation_confirmed:true} : null },
    '@backend/campeonatos/slot-transfer': { slotTransferErrorResponse: () => null },
    '@backend/campeonatos/structure-delete': { deleteScopedStructureRow: async () => {} },
    '@backend/campeonatos/structure-scope': { assertStructureActionScope: async () => {} },
    '@backend/campeonatos/progression-preview': { buildProgressionPreview: async () => ({}) },
    '@backend/campeonatos/advanced-structure-read': { loadAdvancedStructure: async () => ({}) },
    '@backend/campeonatos/progression-transport': { progressionWriteMode: () => 'legacy', tryAtomicProgression: async () => null },
    '@backend/campeonatos/daily-group-transport': { dailyGroupWriteMode: () => 'legacy', tryAtomicDailyGroup: async () => null },
    '@backend/campeonatos/edition-transport': { editionWriteMode: () => 'legacy', tryAtomicEdition: async () => null },
    'next/server': { NextResponse: { json: (payload, options) => new Response(JSON.stringify(payload), options) } },
  })('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
  return { routes, state }
}
async function request(options = {}) {
  const {routes,state} = harness(options)
  const response = await routes.POST(new Request('https://fixture.invalid', {
    method: 'POST', headers: {'Authorization':'Bearer fixture', 'Content-Type':'application/json'},
    body: JSON.stringify({action: options.action || 'assign_group_manual', campeonato_equipe_id: 'participation', group_id:'group', slot_id:'slot'})
  }), {params: Promise.resolve({id:'champ'})})
  return { response, body: await response.json(), state }
}
const future = new Date(Date.now() + 3600_000).toISOString()
const rejects = [
  ['admin assign blocked group', {blocks:[{grupo_id:'group', motivo:'bloqueado'}]}],
  ['admin assign blocked slot', {blocks:[{slot_id:'slot'}]}],
  ['admin assign Lili reserved', {lili:[{id:'res'}]}],
  ['admin assign invitation reserved', {invites:[{id:'invite', expira_em:future}]}],
  ['admin assign indefinite invitation', {invites:[{id:'invite',expira_em:null}]}],
  ['admin assign slot different phase', {slot:{fase_id:'other'}}],
  ['admin assign group without phase', {group:{fase_id:null}}],
  ['admin restore blocked group', {action:'restore_group_choice_admin',blocks:[{grupo_id:'group'}]}],
  ['admin restore blocked slot', {action:'restore_group_choice_admin',blocks:[{slot_id:'slot'}]}],
  ['admin restore Lili reserved', {action:'restore_group_choice_admin',lili:[{id:'res'}]}],
  ['admin restore active invitation', {action:'restore_group_choice_admin',invites:[{id:'invite',expira_em:future}]}],
  ['admin restore moved group', {action:'restore_group_choice_admin',group:{fase_id:'other'}}],
  ['admin restore moved slot', {action:'restore_group_choice_admin',slot:{fase_id:'other'}}],
  ['admin cancel inconsistent slot phase', {action:'cancel_group_choice_admin',slot:{fase_id:'other'}}],
  ['admin cancel unoccupied slot', {action:'cancel_group_choice_admin',slot:{status:'livre'}}],
  ['admin cancel other team slot', {action:'cancel_group_choice_admin',slot:{equipe_id:'other'}}],
  ['admin cancel other line slot', {action:'cancel_group_choice_admin',slot:{line_id:'other'}}],
  ['admin assign inactive participation', {participation:{status:'inativo'}}],
  ['admin cancel inactive participation', {action:'cancel_group_choice_admin',participation:{status:'inativo'}}],
  ['admin restore inactive participation', {action:'restore_group_choice_admin',participation:{status:'inativo'}}],
  ['without authorization', {denied:true}],
  ['without session', {noSession:true}],
]
for (const [description, options] of rejects) {
  const {response, state} = await request(options)
  assert.notEqual(response.status, 200, description)
  assert.equal(state.writes.length, 0, `Must reject BEFORE first write: ${description}`)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  cases++
}
for (const action of ['assign_group_manual','cancel_group_choice_admin','restore_group_choice_admin']) {
  const { response, body, state } = await request({action})
  assert.equal(response.status, 200, `Legacy happy path ${action}: ${JSON.stringify(body)}`)
  assert.ok(state.writes.some(w => w.name === 'campeonato_equipes'), `Participation write ${action}`)
  cases++
}
const expired = await request({invites:[{id:'expired',expira_em:'2020-01-01T00:00:00Z'}]})
assert.equal(expired.response.status,200,`Expired token must not reserve slot: ${JSON.stringify(expired.body)}`)
cases++
for(const action of ['assign_group_manual','cancel_group_choice_admin','restore_group_choice_admin']) {
  const {response,state} = await request({action,atomic:true})
  assert.equal(response.status,200,action)
  assert.equal(state.writes.length,0,action)
  assert.equal(state.reads.length,0,action)
  cases++
}
console.log(`R08: ${cases} HTTP fixture scenarios passed; admin choice/cancel/restore reject inconsistent phase and reserved/blocked slots before writes.`)
