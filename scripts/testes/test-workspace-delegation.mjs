import assert from 'node:assert/strict'
import { fixtureLoader } from './ts-fixture-loader.mjs'

// Exercise the real resolver and route authorization against an in-memory Data API.
// These fixtures never connect to or write to a real database.
let actor = 'deputy'
const writes = []
const rows = {
  managers: [{ id: 'manager-a', auth_user_id: 'deputy', nome: 'Vice', username: 'vice', status: 'ativo' }],
  equipes: [{ id: 'team-a', auth_user_id: 'leader', nome: 'Equipe A', status: 'ativo', senha_dono: 'never-send', private_notes: 'secret' }, { id: 'team-b', nome: 'Equipe B', status: 'ativo' }],
  jogadores: [{ id: 'player-a', auth_user_id: 'player-leader', nome: 'Jogador A', status: 'ativo', private_notes: 'never-send' }],
  manager_equipe: [
    { id: 'grant-a', manager_id: 'manager-a', equipe_id: 'team-a', pode_ver: true, pode_editar: false, pode_escalar: true, status: 'ativo' },
    { id: 'grant-b', manager_id: 'manager-a', equipe_id: 'team-b', pode_ver: false, pode_editar: true, status: 'ativo' },
    { id: 'foreign-grant', manager_id: 'other-manager', equipe_id: 'team-b', pode_ver: true, status: 'ativo' },
  ],
  manager_jogador: [{ id: 'player-grant', manager_id: 'manager-a', jogador_id: 'player-a', pode_ver: true, pode_editar: true, status: 'ativo' }],
  sistema_restricoes_conta: [],
  campeonato_equipes: [{ id: 'participation-a', campeonato_id: 'champ-a', equipe_id: 'team-a', status: 'ativo' }],
}
const database = {
  auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) },
  async rpc(_name, { p_auth_user_id: id }) {
    const profiles = id === 'deputy' ? [{ profile_type: 'manager', data: rows.managers[0] }]
      : id === 'player-leader' ? [{ profile_type: 'jogador', data: rows.jogadores[0] }]
        : id === 'leader' ? [{ profile_type: 'equipe', data: rows.equipes[0] }] : []
    return { data: profiles, error: null }
  },
  from(table) {
    const filters = []
    let range, patch, insertion, single = false
    const query = {
      select() { return query }, order() { return query },
      eq(key, value) { filters.push(row => row[key] === value); return query },
      in(key, values) { filters.push(row => values.includes(row[key])); return query },
      range(start, end) { range = [start, end]; return query },
      update(value) { patch = value; return query },
      insert(value) { insertion = value; return query },
      maybeSingle() { single = true; return query }, single() { single = true; return query },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (insertion) { rows[table].push({ id: 'created-grant', ...insertion }); writes.push({ table, insertion }) }
          let selected = (rows[table] || []).filter(row => filters.every(filter => filter(row)))
          if (patch) { selected.forEach(row => Object.assign(row, patch)); writes.push({ table, patch, ids: selected.map(row => row.id) }) }
          if (range) selected = selected.slice(range[0], range[1] + 1)
          return { data: single ? selected[0] || null : selected, error: null }
        }).then(resolve, reject)
      },
    }
    return query
  },
}
const load = fixtureLoader({ '@backend/shared/supabase-admin': { supabaseAdmin: database } })
const { listWorkspaceContexts, requireWorkspaceContext, getWorkspaceReadContext } = load('backend/src/auth/workspace-contexts.ts')
const { NextRequest } = await import('next/server.js')

const contexts = await listWorkspaceContexts({ id: 'deputy' })
assert.deepEqual(contexts.map(item => item.id).sort(), ['manager-a', 'player-a', 'team-a'])
const team = contexts.find(item => item.id === 'team-a')
assert.equal(team.data.delegated_access, true)
assert.equal(team.auth_user_id, null)
assert.equal(team.created_by, null)
assert.equal(team.data.senha_dono, undefined)
assert.equal(team.data.private_notes, undefined)
assert.equal(team.data.delegated_permissions.pode_editar, false)
assert.equal(team.data.delegated_permissions.pode_escalar, true)
await assert.rejects(requireWorkspaceContext({ id: 'deputy' }, 'team-b'), /acesso/)
await assert.rejects(requireWorkspaceContext({ id: 'stranger' }, 'team-a'), /acesso/)
await assert.rejects(requireWorkspaceContext({ id: 'deputy' }, 'team-a', 'jogador'), /acesso/)
const owned = await listWorkspaceContexts({ id: 'leader' })
assert.equal(owned.find(item => item.id === 'team-a').data.delegated_access, undefined)

const request = (path, method = 'GET', body, headers = {}) => new NextRequest(`http://localhost${path}`, {
  method, headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json', ...headers },
  ...(body ? { body: JSON.stringify(body) } : {}),
})
await assert.rejects(getWorkspaceReadContext(request('/api/dropzone', 'GET', null, { 'x-profile-id': 'team-b' }), { id: 'deputy' }, contexts.find(item => item.id === 'manager-a')), /acesso/)

const profileRoute = load('web/app/api/me/perfil/route.ts')
let response = await profileRoute.PATCH(request('/api/me/perfil', 'PATCH', { profile_type: 'equipe', profile_id: 'team-a', nome: 'Unauthorized' }))
assert.equal(response.status, 400)
assert.equal(writes.length, 0, 'view-only deputies must never reach a write')
response = await profileRoute.PATCH(request('/api/me/perfil', 'PATCH', { profile_type: 'jogador', profile_id: 'player-a', nome: 'Updated' }))
assert.equal(response.status, 200)
assert.equal(rows.jogadores[0].nome, 'Updated')
assert.equal((await response.json()).profile.private_notes, undefined)
const writeCount = writes.length
response = await profileRoute.PATCH(request('/api/me/perfil', 'PATCH', { profile_type: 'jogador', profile_id: 'player-a', username: 'take-over' }))
assert.equal(response.status, 400)
assert.equal(writes.length, writeCount, 'editing never grants account identity control')

const trainingRoute = load('web/app/api/equipe/treinos/route.ts')
response = await trainingRoute.PATCH(request('/api/equipe/treinos', 'PATCH', { campeonato_equipe_id: 'participation-a', partida_id: 'match-a', call_nome: 'Not allowed' }))
assert.notEqual(response.status, 200)
assert.equal(writes.length, writeCount, 'a view-only team member cannot save training notes')

const staffRoute = load('web/app/api/jogadores/[id]/staff/route.ts')
const context = { params: Promise.resolve({ id: 'player-a' }) }
response = await staffRoute.PATCH(request('/staff', 'PATCH', { manager_id: 'manager-a', pode_ver: true, pode_editar: true }), context)
assert.equal(response.status, 403)
assert.equal(writes.length, writeCount, 'a deputy cannot delegate authority to itself')
actor = 'player-leader'
response = await staffRoute.PATCH(request('/staff', 'PATCH', { manager_id: 'manager-a', pode_ver: true, pode_editar: false }), context)
assert.equal(response.status, 200)
assert.equal(rows.manager_jogador[0].pode_editar, false)
actor = 'deputy'
response = await profileRoute.PATCH(request('/api/me/perfil', 'PATCH', { profile_type: 'jogador', profile_id: 'player-a', nome: 'Denied after change' }))
assert.equal(response.status, 400, 'permission changes take effect on the next request')
actor = 'player-leader'
response = await staffRoute.DELETE(request('/staff', 'DELETE', { manager_id: 'manager-a' }), context)
assert.equal(response.status, 200)
await assert.rejects(requireWorkspaceContext({ id: 'deputy' }, 'player-a'), /acesso/)
rows.manager_equipe[0].status = 'removido'
await assert.rejects(requireWorkspaceContext({ id: 'deputy' }, 'team-a'), /acesso/)
assert.equal((await listWorkspaceContexts({ id: 'deputy' })).filter(item => item.data.delegated_access).length, 0)
console.log('Workspace delegation: scope, sanitized profiles, leader-only grants, edit permissions and immediate revocation passed.')
