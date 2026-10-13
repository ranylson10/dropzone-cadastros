import assert from 'node:assert/strict'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const load = fixtureLoader({})
const { initialWorkspaceEntityTypes, producerEntityRequest, producerRequestKey } = load('web/features/dropzone/workspace-entities.ts')
assert.deepEqual(initialWorkspaceEntityTypes('produtora'), ['championship'])
assert.deepEqual(initialWorkspaceEntityTypes('manager'), [])
assert.deepEqual(producerEntityRequest('visao', 'links', 'champ-own', true), { championshipId: '', types: [], summary: true })
for (const section of ['financeiro', 'equipe', 'configuracoes']) assert.deepEqual(producerEntityRequest(section, 'jogos', 'champ-own', true).types, [])
assert.deepEqual(producerEntityRequest('campeonatos', 'jogos', 'champ-own', true).types, ['phase', 'group', 'game'])
for (const tab of ['equipes', 'jogadores', 'grupos', 'regulamento', 'calls', 'estatisticas', 'financeiro', 'vendedores']) assert.deepEqual(producerEntityRequest('campeonatos', tab, 'champ-own', true).types, [])
assert.deepEqual(producerEntityRequest('campeonatos', 'links', 'champ-own', false), { championshipId: '', types: [], summary: false })
assert.notEqual(producerRequestKey(producerEntityRequest('campeonatos', 'jogos', 'champ-a', true)), producerRequestKey(producerEntityRequest('campeonatos', 'jogos', 'champ-b', true)))

const queries = []
let failed = false
let missingCount = false
const database = { from(table) {
  let ids; let activeOnly = false
  const query = {
    select(columns, options) { assert.equal(columns, 'id'); assert.deepEqual(options, { count: 'exact', head: true }); return query },
    in(column, values) { assert.equal(column, 'campeonato_id'); assert.ok(values.length <= 150); ids = values; return query },
    eq(column, value) { assert.equal(column, 'status'); assert.equal(value, 'ativo'); activeOnly = true; return query },
    then(resolve, reject) {
      queries.push({ table, ids, activeOnly })
      return Promise.resolve({ count: missingCount ? null : ids?.length ?? 17, error: failed ? new Error('database offline') : null }).then(resolve, reject)
    },
  }
  return query
} }
const { producerWorkspaceSummary } = fixtureLoader({ '@backend/shared/supabase-admin': { supabaseAdmin: database } })('backend/src/dropzone/entities/producer-summary.ts')
const ids = Array.from({ length: 301 }, (_, index) => `champ-${index}`)
assert.deepEqual(await producerWorkspaceSummary(ids, ''), { teamCount: 17, gameCount: 301 })
assert.equal(queries.filter(query => query.table === 'campeonato_jogos').length, 3)
assert.deepEqual(await producerWorkspaceSummary(ids, 'champ-300'), { teamCount: 1, gameCount: 1, phaseCount: 1, groupCount: 1 })
assert.equal(queries.findLast(query => query.table === 'campeonato_equipes').activeOnly, true)
assert.deepEqual(await producerWorkspaceSummary([], ''), { teamCount: 17, gameCount: 0 })
await assert.rejects(producerWorkspaceSummary(ids, 'foreign'), /não pertence/)
failed = true
await assert.rejects(producerWorkspaceSummary(ids, ''), /offline/)
failed = false; missingCount = true
await assert.rejects(producerWorkspaceSummary(ids, ''), /não foi retornada/)
console.log('OK: carregamento por perfil/aba, contagens sem transferência de registros, escopo autorizado, lotes de 150 e falhas explícitas.')
