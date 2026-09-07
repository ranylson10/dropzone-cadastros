import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const sourcePath = path.resolve('backend/src/campeonatos/estatisticas/baseline-rules.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const module = { exports: {} }
vm.runInNewContext(`(function(exports,module){${compiled}\n})(module.exports,module)`, { module, console })
const { resolveBaselineCut, aggregateDetailedPlayerRows, officialTeamBaseline } = module.exports

function loadTypeScriptModule(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const loaded = { exports: {} }
  const localRequire = id => id in mocks ? mocks[id] : require(id)
  const wrapper = vm.runInThisContext(`(function(require,exports,module){${code}\n})`, { filename: file })
  wrapper(localRequire, loaded.exports, loaded)
  return loaded.exports
}

const partidas = [
  { id: 'Q1', numero_partida: 1, status: 'finalizada' },
  { id: 'Q2', numero_partida: 2, status: 'finalizada' },
  { id: 'Q3', numero_partida: 3, status: 'finalizada' },
  { id: 'Q4', numero_partida: 4, status: 'em_andamento' },
  { id: 'Q5', numero_partida: 5, status: 'agendada' },
]
assert.deepEqual(Array.from(resolveBaselineCut(partidas, 'Q4').anteriores, row => row.id), ['Q1', 'Q2', 'Q3'])
assert.deepEqual(Array.from(resolveBaselineCut(partidas, 'Q1').anteriores), [])

const detailed = aggregateDetailedPlayerRows([
  { campeonato_jogador_id: 'A', campeonato_equipe_id: 'EA', player_id: '123', distancia_max_abate: 80, abates: 1, dano: 100 },
  { campeonato_jogador_id: 'A', campeonato_equipe_id: 'EA', player_id: '123', distancia_max_abate: 120, abates: 2, dano: 200 },
  { campeonato_jogador_id: 'A', campeonato_equipe_id: 'EA', player_id: '123', distancia_max_abate: 95, abates: 3, dano: 300 },
  { campeonato_jogador_id: 'B', campeonato_equipe_id: 'EB', player_id: '123', distancia_max_abate: 40, abates: 4, dano: 400 },
])
assert.equal(detailed.invalidRows.length, 0)
assert.equal(detailed.players.length, 2, 'player_id repetido não combina participações competitivas')
const playerA = detailed.players.find(row => row.campeonato_jogador_id === 'A')
assert.equal(playerA.distancia_max_abate, 120, 'distância máxima usa MAX')
assert.equal(playerA.abates, 6, 'kills usam SUM')
assert.equal(playerA.dano, 600, 'damage usa SUM')

const official = officialTeamBaseline({ quedas: 3, pontos_total: 42, abates: 17, booyahs: 1 })
assert.equal(official.drops, 3)
assert.equal(official.points, 42, 'pontos vêm diretamente da classificação oficial')
assert.equal(official.kills, 17)
assert.equal(official.booyahs, 1)

const queryData = {
  campeonato_partidas_com_mapa: partidas.map(row => ({ ...row, campeonato_id: 'camp', fase_id: 'fase', jogo_id: 'jogo' })),
  garena_matchstats_importacoes: [
    { id: 'i1', partida_id: 'Q1' }, { id: 'i2', partida_id: 'Q2' }, { id: 'i3', partida_id: 'Q3' },
  ],
  garena_matchstats_jogadores: [
    { campeonato_jogador_id: 'A', campeonato_equipe_id: 'EA', player_id: '123', distancia_max_abate: 80, headshots: 1 },
    { campeonato_jogador_id: 'A', campeonato_equipe_id: 'EA', player_id: '123', distancia_max_abate: 120, headshots: 2 },
    { campeonato_jogador_id: 'A', campeonato_equipe_id: 'EA', player_id: '123', distancia_max_abate: 95, headshots: 3 },
    { campeonato_jogador_id: 'B', campeonato_equipe_id: 'EB', player_id: '123', distancia_max_abate: 40, headshots: 4 },
  ],
}
const supabaseAdmin = {
  from(table) {
    const builder = {
      select() { return builder }, eq() { return builder }, in() { return builder }, order() { return builder }, limit() { return builder },
      then(resolve) { resolve({ data: queryData[table] || [], error: null }) },
    }
    return builder
  },
}
const calls = []
const officialTeamRows = [
  { campeonato_equipe_id: 'EA', equipe_id: 'e1', nome: 'Alpha', quedas: 3, pontos_total: 42, abates: 17, booyahs: 1 },
  { campeonato_equipe_id: 'EB', equipe_id: 'e2', nome: 'Beta', quedas: 3, pontos_total: 31, abates: 12, booyahs: 0 },
]
const officialPlayerRows = [
  { campeonato_jogador_id: 'A', campeonato_equipe_id: 'EA', id_jogo: '123', nick: 'Um', quedas: 3, abates: 6, dano: 600, assistencias: 3, revives: 1 },
  { campeonato_jogador_id: 'B', campeonato_equipe_id: 'EB', id_jogo: '123', nick: 'Dois', quedas: 3, abates: 4, dano: 400, assistencias: 2, revives: 0 },
]
const stats = {
  async listarEstatisticasEquipes(_camp, filters) { calls.push(['teams', [...filters.partidaIds]]); return officialTeamRows },
  async listarEstatisticasMvp(_camp, filters) { calls.push(['players', [...filters.partidaIds]]); return officialPlayerRows },
}
let rosterPayload = {
  slots: [
    { campeonato_equipe_id: 'EA', slot_id: 's1', slot_numero: 1, equipe_nome: 'Alpha' },
    { campeonato_equipe_id: 'EB', slot_id: 's2', slot_numero: 2, equipe_nome: 'Beta' },
  ],
  jogadores: [
    { campeonato_jogador_id: 'A', campeonato_equipe_id: 'EA', player_id: '123', nick: 'Um' },
    { campeonato_jogador_id: 'B', campeonato_equipe_id: 'EB', player_id: '123', nick: 'Dois' },
  ],
}
const roster = {
  async carregarRosterPontuadorJogo() { return rosterPayload },
}
const servicePath = path.resolve('backend/src/campeonatos/estatisticas/baseline.service.ts')
const service = loadTypeScriptModule(servicePath, {
  '../../shared/supabase-admin': { supabaseAdmin },
  '../pontuador/pontuador.service': roster,
  './estatisticas.service': stats,
  './baseline-rules': module.exports,
})
const baselineQ4 = await service.carregarBaselineAntesPartida('camp', 'jogo', 'Q4')
assert.deepEqual(baselineQ4.context.partidas_incluidas, ['Q1', 'Q2', 'Q3'])
assert.deepEqual(calls, [['teams', ['Q1', 'Q2', 'Q3']], ['players', ['Q1', 'Q2', 'Q3']]])
assert.equal(baselineQ4.teams.find(row => row.campeonato_equipe_id === 'EA').points, 42)
assert.equal(baselineQ4.players.length, 2)
assert.equal(baselineQ4.players[0].player_id, baselineQ4.players[1].player_id)
assert.notEqual(baselineQ4.players[0].campeonato_jogador_id, baselineQ4.players[1].campeonato_jogador_id)
assert.equal(baselineQ4.players.find(row => row.campeonato_jogador_id === 'A').max_kill_distance, 120)

calls.length = 0
const baselineQ1 = await service.carregarBaselineAntesPartida('camp', 'jogo', 'Q1')
assert.equal(baselineQ1.context.quantidade_partidas_incluidas, 0)
assert.equal(baselineQ1.teams.length, 2)
assert.equal(baselineQ1.players.length, 2)
assert.equal(baselineQ1.teams[0].points, 0)
assert.deepEqual(calls, [], 'Q1 não consulta agregadores sem filtro e nunca vaza o acumulado geral')

rosterPayload = { ...rosterPayload, slots: [{ slot_vazio: false, slot_numero: 3, equipe_nome: 'Sem identidade' }] }
await assert.rejects(
  service.carregarBaselineAntesPartida('camp', 'jogo', 'Q1'),
  /equipe sem campeonato_equipe_id/,
  'equipe competitiva sem identidade canônica deve falhar sem fallback genérico',
)

console.log('test-baseline-r03: ok')
