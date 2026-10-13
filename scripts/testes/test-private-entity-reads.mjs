import assert from 'node:assert/strict'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const rows = {
  equipes: [{ id: 'team-own', nome: 'Própria', dono_auth_user_id: 'user-own' }, { id: 'team-other', nome: 'Outra', dono_auth_user_id: 'user-other' }],
  equipe_lines: [{ id: 'line-own', equipe_id: 'team-own' }, { id: 'line-other', equipe_id: 'team-other' }],
  equipe_jogadores: [{ id: 'roster-own', equipe_id: 'team-own', jogador_id: 'player-own', jogador_auth_user_id: 'user-own' }, { id: 'roster-other', equipe_id: 'team-other', jogador_id: 'player-other', jogador_auth_user_id: 'user-other' }],
  campeonato_jogadores: [{ id: 'registration-own', campeonato_id: 'champ-own', equipe_id: 'team-own', jogador_id: 'player-own', criado_por: 'user-own' }, { id: 'registration-other', campeonato_id: 'champ-other', equipe_id: 'team-other', jogador_id: 'player-other', criado_por: 'user-other' }],
  campeonato_equipes: [{ id: 'entry-own', campeonato_id: 'champ-own', equipe_id: 'team-own', status: 'ativo' }, { id: 'entry-other', campeonato_id: 'champ-other', equipe_id: 'team-other', status: 'ativo' }],
  campeonatos: [{ id: 'champ-own', produtora_id: 'producer-own', deleted_at: null }, { id: 'champ-other', produtora_id: 'producer-other', deleted_at: null }],
  tokens: [{ id: 'token-own', campeonato_id: 'champ-own', criado_por: 'user-own' }, { id: 'token-other', campeonato_id: 'champ-other', criado_por: 'user-other' }],
  campeonato_links: [{ id: 'link-own', campeonato_id: 'champ-own', criado_por: 'user-own', deleted_at: null }, { id: 'link-other', campeonato_id: 'champ-other', criado_por: 'user-other', deleted_at: null }],
  campeonato_fases: [{ id: 'phase-own', campeonato_id: 'champ-own' }, { id: 'phase-other', campeonato_id: 'champ-other' }],
  campeonato_grupos: [{ id: 'group-own', campeonato_id: 'champ-own' }, { id: 'group-other', campeonato_id: 'champ-other' }],
  campeonato_jogos: [{ id: 'game-own', campeonato_id: 'champ-own' }, { id: 'game-other', campeonato_id: 'champ-other' }],
}
const reads = []
const database = { from(table) {
  const filters = []; let range; let countOnly = false
  const query = {
    select(columns, options) { countOnly = options?.head === true && options?.count === 'exact'; return query }, order() { return query },
    eq(key, value) { filters.push(row => row[key] === value); return query },
    is(key, value) { filters.push(row => row[key] === value); return query },
    in(key, values) { filters.push(row => values.includes(row[key])); return query },
    range(start, end) { range = [start, end]; return query },
    then(resolve, reject) { return Promise.resolve().then(() => {
      let selected = (rows[table] || []).filter(row => filters.every(filter => filter(row)))
      if (range) selected = selected.slice(range[0], range[1] + 1)
      reads.push({ table, ids: countOnly ? [] : selected.map(row => row.id), countOnly })
      return { data: countOnly ? null : selected.map(row => ({ ...row })), count: countOnly ? selected.length : null, error: null }
    }).then(resolve, reject) },
  }
  return query
} }
let controlled = [{ id: 'team-own', permissoes: { pode_ver: true } }]
const load = fixtureLoader({
  '@backend/shared/supabase-admin': { supabaseAdmin: database },
  '@backend/auth/server-auth': { getAccountsByUserId: async () => [] },
  '@backend/equipes/manager-team-access': { listControllableEquipes: async () => controlled },
})
const { listEntities } = load('backend/src/dropzone/entities/list-entities.ts')
const context = type => ({ user: { id: 'user-own' }, account: { id: type === 'jogador' ? 'player-own' : type === 'produtora' ? 'producer-empty' : 'team-own', profile_type: type } })
for (const type of ['equipe', 'manager', 'jogador']) {
  for (const [entity, expected] of [['team_line', 'line-own'], ['player_team', 'roster-own'], ['player_registration', 'registration-own'], ['invite_token', 'token-own'], ['registration_link', 'link-own'], ['championship', 'champ-own'], ['championship_team', 'entry-own']]) {
    reads.length = 0
    const result = await listEntities(context(type), new URLSearchParams({ entity_type: entity }))
    assert.deepEqual(result.rows.map(row => row.id), [expected], `${type}/${entity} must work without other entity lists`)
    assert.equal(reads.some(read => read.ids.some(id => String(id).endsWith('-other'))), false, `${type}/${entity} must exclude private rows in the database query`)
  }
}
const publicTeams = await listEntities(context('produtora'), new URLSearchParams({ entity_type: 'team' }))
assert.equal(publicTeams.rows.length, 2, 'a producer with no tournaments can still use the public team selector')
assert.equal(publicTeams.rows[1].created_by, null)
assert.equal(publicTeams.rows[1].data.dono_auth_user_id, undefined)
controlled = []
assert.deepEqual(await listEntities(context('manager'), new URLSearchParams({ entity_type: 'team_line' })), { rows: [] })
assert.deepEqual(await listEntities(context('manager'), new URLSearchParams({ entity_types: '' })), { rows: [] })
await assert.rejects(listEntities(context('equipe'), new URLSearchParams({ entity_types: 'team,unsafe' })), /inválido/)
assert.deepEqual((await listEntities(context('jogador'), new URLSearchParams({ entity_types: 'player_team,player_registration' }))).rows.map(row => row.id).sort(), ['registration-own', 'roster-own'])
// Producer summaries preserve exact counts without transferring rows from inactive tabs.
reads.length = 0
const producer = { ...context('produtora'), account: { id: 'producer-own', profile_type: 'produtora' } }
const summary = await listEntities(producer, new URLSearchParams({ entity_types: '', summary: '1' }))
assert.deepEqual(summary, { rows: [], summary: { teamCount: 2, gameCount: 1 } })
assert.ok(reads.filter(read => read.table !== 'campeonatos').every(read => read.countOnly && read.ids.length === 0))
const selectedSummary = await listEntities(producer, new URLSearchParams({ entity_types: '', summary: '1', championship_id: 'champ-own' }))
assert.deepEqual(selectedSummary.summary, { teamCount: 1, gameCount: 1, phaseCount: 1, groupCount: 1 })
await assert.rejects(listEntities(producer, new URLSearchParams({ entity_types: '', summary: '1', championship_id: 'champ-other' })), /não pertence/)
await assert.rejects(listEntities(context('jogador'), new URLSearchParams({ entity_types: '', summary: '1' })), /somente/)
const scopedGames = await listEntities(producer, new URLSearchParams({ entity_types: 'game', championship_id: 'champ-own' }))
assert.deepEqual(scopedGames.rows.map(row => row.id), ['game-own'])
assert.equal(reads.some(read => read.ids.includes('game-other')), false)
const { readRowsByIds } = load('backend/src/shared/paginated-query.ts')
const selectedIds = Array.from({ length: 601 }, (_, index) => String(index))
const sizes = []
const batches = await readRowsByIds([...selectedIds, '0'], ids => {
  sizes.push(ids.length)
  return { async range(start, end) { return { data: ids.slice(start, Math.min(end + 1, start + 50)).map(id => ({ id })), error: null } } }
})
assert.equal(batches.length, 601)
assert.ok(sizes.every(size => size <= 150))
assert.equal(new Set(batches.map(row => row.id)).size, 601)
// Exercise the real staff resolver, including pagination and owner precedence.
const staffTeams = Array.from({ length: 301 }, (_, index) => ({ id: `staff-team-${index}`, nome: `Staff ${index}` }))
rows.equipes.push(...staffTeams)
rows.manager_equipe = staffTeams.map((team, index) => ({ id: `staff-link-${index}`, manager_id: 'manager-own', equipe_id: team.id, status: 'ativo', pode_ver: true, pode_editar: false }))
rows.manager_equipe.push({ id: 'staff-denied', manager_id: 'manager-own', equipe_id: 'team-other', status: 'ativo', pode_ver: false })
rows.manager_equipe.push({ id: 'staff-owner', manager_id: 'manager-own', equipe_id: 'team-own', status: 'ativo', pode_ver: true, pode_editar: false })
const actualScope = fixtureLoader({
  '@backend/shared/supabase-admin': { supabaseAdmin: database },
  '@backend/equipes/manager-invites': { isMissingRelation: () => false },
})('backend/src/equipes/manager-team-access.ts')
const staff = await actualScope.listControllableEquipes('user-own', [{ id: 'team-own', name: 'Própria', profile_type: 'equipe' }, { id: 'manager-own', profile_type: 'manager' }])
assert.equal(staff.length, 302)
assert.equal(staff.some(team => team.id === 'team-other'), false)
assert.equal(staff.find(team => team.id === 'team-own').papel, 'dono')
assert.equal(staff.find(team => team.id === 'team-own').permissoes.pode_editar, true)
assert.equal(staff.find(team => team.id === 'staff-team-300').permissoes.pode_editar, false)
console.log('OK: consultas privadas filtradas no banco, tipos independentes, escopo de jogador/equipe/manager, seletor público sem campeonatos e seleção de entidades.')
