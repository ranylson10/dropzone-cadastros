import assert from 'node:assert/strict'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const { manualDraftTeams } = fixtureLoader()('web/features/campeonatos/pontuador/manual-draft.ts')
const draft = (patch = {}) => ({ posicao: '1', abates: '5', punicao: '', motivo: '', jogadores: {}, ...patch })
assert.deepEqual(manualDraftTeams({ a: draft() }, { a: draft() }, {}), [])
assert.deepEqual(manualDraftTeams({ a: draft() }, {}, {}).at(0).jogadores, [])
assert.deepEqual(manualDraftTeams({ a: draft() }, {}, { a: true }), [])
assert.throws(() => manualDraftTeams({ a: draft({ abates: '' }) }, {}, {}), /colocação e abates/)
assert.throws(() => manualDraftTeams({ a: draft(), b: draft() }, {}, {}), /mesma colocação/)
assert.throws(() => manualDraftTeams({ a: draft({ jogadores: { p: '6' } }) }, {}, {}), /excedem/)
assert.throws(() => manualDraftTeams({ a: draft({ jogadores: { p: '-1' } }) }, {}, {}), /inteiros/)
assert.deepEqual(manualDraftTeams({ a: draft({ abates: '0', jogadores: { p: '0', unknown: '' } }) }, {}, {})[0].jogadores, [{ campeonato_jogador_id: 'p', abates: 0 }])

let absent = false, noGame = false, noRoster = false, otherPosition = 2
const writes = []
const database = { from(table) {
  let operation = 'select', payload
  const query = {
    select() { return query }, eq() { return query }, in() { return query },
    upsert(value) { operation = 'upsert'; payload = value; return query },
    maybeSingle() { return query },
    then(resolve, reject) {
      if (operation === 'upsert') { writes.push({ table, payload }); return Promise.resolve({ error: null }).then(resolve, reject) }
      const data = table === 'campeonato_partidas' ? { id: 'drop', campeonato_id: 'champ', fase_id: 'phase', jogo_id: 'game', status: 'agendada' }
        : table === 'campeonato_equipes' ? [{ id: 'a', equipe_id: 'team-a', grupo_id: 'group' }]
        : table === 'campeonato_jogadores' ? [{ id: 'p', campeonato_equipe_id: 'a', jogador_id: 'player', equipe_id: 'team-a' }]
        : table === 'campeonato_pontuador_jogadores_jogo' ? (noRoster ? [] : [{ campeonato_jogador_id: 'p', campeonato_equipe_id: 'a' }])
        : table === 'campeonato_resultados_jogadores' ? [{ campeonato_jogador_id: 'p', dano: 350, assistencias: 3, revives: 2 }]
        : table === 'campeonato_pontuador_equipes_matriz' ? [
          ...(!noGame ? [{ campeonato_equipe_id: 'a', status_presenca: absent ? 'falta' : 'pendente' }] : []),
          { campeonato_equipe_id: 'b', posicao: otherPosition, resultado_id: 'old', status_presenca: 'presente' },
        ] : []
      return Promise.resolve({ data, error: null }).then(resolve, reject)
    },
  }
  return query
} }
const load = fixtureLoader({
  '@backend/shared/supabase-admin': { supabaseAdmin: database },
  './statistics-read.service': { listarEstatisticasEquipes: () => [], listarEstatisticasMvp: () => [] },
  './published-statistics.service': {},
})
const { salvarPontuacaoManual } = load('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
const body = (patch = {}) => ({ partida_id: 'drop', equipes: [{ campeonato_equipe_id: 'a', posicao: 1, abates: 5, jogadores: [{ campeonato_jogador_id: 'p', abates: 5 }], ...patch }] })
await salvarPontuacaoManual('champ', 'actor', body())
const player = writes.find(write => write.table === 'campeonato_resultados_jogadores').payload[0]
assert.deepEqual([player.abates, player.dano, player.assistencias, player.revives], [5, 350, 3, 2])
writes.length = 0
absent = true; await assert.rejects(salvarPontuacaoManual('champ', 'actor', body()), /FALT/)
absent = false; noGame = true; await assert.rejects(salvarPontuacaoManual('champ', 'actor', body()), /neste jogo/)
noGame = false; otherPosition = 1; await assert.rejects(salvarPontuacaoManual('champ', 'actor', body()), /mesma colocação/)
otherPosition = 2; noRoster = true; await assert.rejects(salvarPontuacaoManual('champ', 'actor', body()), /elenco deste jogo/); noRoster = false
await assert.rejects(salvarPontuacaoManual('champ', 'actor', body({ jogadores: [{ campeonato_jogador_id: 'p', abates: -1 }] })), /inválidos/)
await assert.rejects(salvarPontuacaoManual('champ', 'actor', body({ jogadores: [{ campeonato_jogador_id: 'p', abates: 6 }] })), /excedem/)
await assert.rejects(salvarPontuacaoManual('champ', 'actor', body({ punicao_pontos: Number.NaN })), /Punição/)
assert.deepEqual(writes, [], 'invalid drafts must fail before any write')
const { normalizeScoring } = load('backend/src/dropzone/entities/championship-config.ts')
assert.equal(normalizeScoring({ sistema_pontuacao_tipo: 'personalizado', sistema_pontuacao_nome: '24 equipes', pontuacao_equipes_por_partida: '24', pontos_colocacao: Array.from({length:24}, (_,i) => 24-i), pontos_por_abate: 0 }).pontos_colocacao.length, 24)
console.log('OK: rascunhos parciais, zero explícito, FALT, IDs do jogo, colocação única, validação antes da escrita, preservação de detalhes e pontuação para 24 equipes.')

let gameStatuses
const gameDatabase = { from() {
  const query = { select() { return query }, eq() { return query }, order() { return query }, in(column, values) { if (column === 'status') gameStatuses = values; return query }, then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject) } }
  return query
} }
const scoring = fixtureLoader({ '@backend/shared/supabase-admin': { supabaseAdmin: gameDatabase }, '../estatisticas/estatisticas.service': {}, '../stream/transmission-state.service': {} })('backend/src/campeonatos/pontuador/pontuador.service.ts')
assert.deepEqual(await scoring.listarJogosPontuador('champ'), [])
assert.ok(gameStatuses.includes('agendado') && gameStatuses.includes('em_andamento'))
assert.ok(!gameStatuses.includes('cancelado'))
const games = fixtureLoader({ '@backend/shared/supabase-admin': { supabaseAdmin: gameDatabase } })('backend/src/campeonatos/jogos/jogos.service.ts')
await assert.rejects(games.criarJogo('champ', { numero_partidas: 49 }), /48 quedas/)
console.log('OK: jogos agendados entram no pontuador, cancelados ficam fora e o limite de 48 quedas é validado antes da consulta de mapas.')
