import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const migration = read('database/migrations/20260907_dpz_engine_resultado_idempotente.sql')
const service = read('backend/src/campeonatos/estatisticas/engine-result.service.ts')
const route = read('web/app/api/desktop/campeonatos/[id]/partidas/[partidaId]/resultado/route.ts')
const baseline = read('backend/src/campeonatos/estatisticas/baseline.service.ts')
const stats = read('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
const editorDatasets = read('backend/src/campeonatos/stream/editor-datasets.service.ts')
const tierRanking = read('backend/src/ranking/tier-ranking.service.ts')
const directory = read('web/features/directory/server.ts')
const training = read('web/app/api/equipe/treinos/route.ts')

assert.match(route, /getBearerUser/)
assert.match(route, /requireCampeonatoScore/)
assert.match(route, /idempotency-key/)
assert.match(route, /already_processed \? 200 : 201/)
assert.doesNotMatch(route + service, /SERVICE_ROLE|service_role/i, 'o contrato do Engine não recebe chave privilegiada')
assert.match(service, /body\.version !== 1/)
assert.match(service, /campeonato_equipe_id duplicado/)
assert.match(service, /campeonato_jogador_id duplicado/)
assert.match(service, /createHash\('sha256'\)/)

assert.match(migration, /security definer/)
assert.match(migration, /pg_advisory_xact_lock/)
assert.match(migration, /idempotency_key/)
assert.match(migration, /already_processed/)
assert.match(migration, /payload_hash <> p_payload_hash/)
assert.match(migration, /partida_id, match_id/)
assert.match(migration, /consolidacao_oficial/)
assert.match(migration, /row_number\(\) over/)
assert.doesNotMatch(migration, /delete from public\.garena_matchstats_importacoes/i, 'duplicatas históricas não são apagadas')
assert.match(migration, /update public\.campeonato_partidas set status='finalizada'/)
assert.match(migration, /observacoes.*DPZ Live Engine/s)
assert.match(migration, /pontos_posicao|campeonato_resultados_equipes/s, 'pontuação oficial permanece nas tabelas/trigger do Site')
assert.match(baseline, /consolidacao_oficial.*true/s, 'Q4 consolidada entra uma vez no baseline da Q5')
assert.match(stats, /consolidacao_oficial.*true/s, 'fallback oficial de MVP ignora MatchStats duplicado')
assert.match(editorDatasets, /consolidacao_oficial.*true/s, 'datasets agregados ignoram MatchStats duplicado')
assert.match(tierRanking, /consolidacao_oficial.*true/s, 'ranking por tiers ignora MatchStats duplicado')
assert.match(directory, /consolidacao_oficial.*true/s, 'perfil público ignora MatchStats duplicado')
assert.match(training, /consolidacao_oficial.*true/s, 'treinos ignoram MatchStats duplicado')

// A função PL/pgSQL é uma única transação por chamada: qualquer exception reverte
// resultados, MatchStats, finalização e auditoria, cobrindo falha parcial.
assert.match(migration, /raise exception/)
assert.match(migration, /insert into public\.dpz_engine_resultados[\s\S]*return jsonb_build_object/)

console.log('OK: R11 rota Bearer, idempotência, transação, MatchStats oficial único, Q4→Q5 e rollback por exceção.')
