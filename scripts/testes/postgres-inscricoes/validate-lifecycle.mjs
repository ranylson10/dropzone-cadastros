import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { sql, directory } from './docker-lab.mjs'
import { id, quote, service, seed, championship } from './fixtures.mjs'
import { fixtureLoader } from '../ts-fixture-loader.mjs'
import { createClient } from '@supabase/supabase-js'
import { match } from '../lib/postgrest-fixture.mjs'
if (directory !== 'relatorios-testes/lifecycle-transacao-2026-10-12' || !/^dropzone_(audit|validation_lifecycle_[a-z0-9_]+)$/.test(process.env.DROPZONE_FIXTURE_DB || '')) throw Error('Owned synthetic lifecycle DB required')
let next = Number(process.argv[2] || 15100000), key = next + 1000000
const results = [], json = async query => JSON.parse(await sql(query))
async function test(name, fn) { try { results.push({ name, passed: true, ...await fn() }); console.log('PASS ' + name) } catch (error) { results.push({ name, passed: false, error: error.message }); console.log('FAIL ' + name + ': ' + error.message) } }
async function fixture({ type = 'diario', final = false, count = 3, falls = 1 } = {}) {
 next += 1000; const f = await championship(next, Math.max(4, count))
 Object.assign(f, { n: next, franchise: id(next + 100), edition: id(next + 101), game: id(next + 102), stages: [id(next + 110), id(next + 111), id(next + 112)], divisions: [id(next + 120), id(next + 121)], parts: Array.from({ length: count }, (_, n) => id(next + 300 + n)), resultIds: [] })
 await sql(`set request.jwt.claim.role='service_role';
  update public.campeonatos set tipo=${quote(type)} where id='${f.camp}';
  insert into public.campeonato_franquias(id,nome,criado_por) values('${f.franchise}','Fixture franchise','${id(1)}');
  insert into public.campeonato_edicoes(id,franquia_id,campeonato_id,numero_edicao,status,data_fim,metadados) values('${f.edition}','${f.franchise}','${f.camp}',1,'ativa','2027-01-01','{"keep":"custom"}');
  insert into public.campeonato_etapas(id,edicao_id,nome,status,ordem) values('${f.stages[0]}','${f.edition}','Active','ativa',1),('${f.stages[1]}','${f.edition}','Already closed','encerrada',2),('${f.stages[2]}','${f.edition}','Cancelled','cancelada',3);
  insert into public.campeonato_divisoes(id,edicao_id,nome,status,ordem) values('${f.divisions[0]}','${f.edition}','Planned','planejada',1),('${f.divisions[1]}','${f.edition}','Cancelled','cancelada',2);
  ${final ? `update public.campeonato_fases set tipo='grande_final' where id='${f.phase}';` : ''}
  ${f.parts.map((part, n) => `insert into public.campeonato_equipes(id,campeonato_id,equipe_id,line_id,slot_id,grupo_id,status,nome_exibicao,criado_por,origem_entrada)
   values('${part}','${f.camp}','${id(100 + n)}','${id(200 + n)}','${f.slots[n]}','${f.group}','ativo','Team ${n + 1}','${id(1)}','manual');`).join('\n')}
  insert into public.campeonato_jogos(id,campeonato_id,fase_id,nome,numero_partidas,dia_final) values('${f.game}','${f.camp}','${f.phase}','Game',${falls},1);`)
 f.falls = await json(`select jsonb_agg(id order by numero_partida,id) from public.campeonato_partidas where jogo_id='${f.game}';`)
 await sql(`set request.jwt.claim.role='service_role';${f.falls.flatMap((fall, j) => f.parts.map((part, n) => {
  const result = id(next + 400 + j * 20 + n); f.resultIds.push(result)
  return `insert into public.campeonato_resultados_equipes(id,campeonato_id,fase_id,grupo_id,jogo_id,partida_id,campeonato_equipe_id,equipe_id,line_id,posicao,abates)
   values('${result}','${f.camp}','${f.phase}','${f.group}','${f.game}','${fall}','${part}','${id(100 + n)}','${id(200 + n)}',${n + 1},${count - n});`
 })).join('\n')}update public.campeonato_partidas set status='finalizada' where jogo_id='${f.game}';`)
 return f
}
const call = async (f, action, expected = {}, { request = id(++key), actor = 1, hold = 0, prefix = '' } = {}) => JSON.parse((await sql(service + 'begin;' + prefix + `select jsonb_build_object('pid',pg_backend_pid(),'data',public.fn_lifecycle_atomico('${id(actor)}','${request}','${f.camp}',${quote(action)},${quote(JSON.stringify(expected))}::jsonb));` + (hold ? `select pg_sleep(${hold});` : '') + 'commit;', { timeout: 20000 })).split('\n')[0])
const preview = async (f, closing = true) => (await call(f, closing ? 'preview_publish_final' : 'preview_reopen_final')).data.preview
const publish = async (f, p, options) => call(f, 'publish_final', p.fence, options)
const reopen = async (f, p, options) => call(f, 'reopen_final', p.fence, options)
const image = f => json(`select public.dz_lifecycle_image('${f.camp}');`)
const state = f => json(`select jsonb_build_object('image',public.dz_lifecycle_image('${f.camp}'),
 'falls',(select jsonb_agg(to_jsonb(x) order by id) from public.campeonato_partidas x where campeonato_id='${f.camp}'),
 'results',(select jsonb_agg(to_jsonb(x) order by id) from public.campeonato_resultados_equipes x where campeonato_id='${f.camp}'),
 'publications',(select jsonb_agg(to_jsonb(x) order by id) from public.lifecycle_publicacoes x where campeonato_id='${f.camp}'),
 'receipts',(select jsonb_agg(to_jsonb(x) order by actor_id,request_id) from public.lifecycle_recibos x where campeonato_id='${f.camp}'),
 'realtime',(select jsonb_agg(to_jsonb(x)) from realtime.fixture_events x));`)
const unchanged = async (f, fn) => { const before = await state(f); await assert.rejects(fn); assert.deepEqual(await state(f), before); return { fullRollback: true } }
async function failAfter(table, event, f, body) {
 const condition = table === 'campeonato_etapas' ? `NEW.id='${f.stages[0]}'` : table === 'campeonato_divisoes' ? `NEW.id='${f.divisions[0]}'` : table === 'campeonato_edicoes' ? `NEW.id='${f.edition}'` : `NEW.campeonato_id='${f.camp}'`
 await sql(`create function public.fixture_lifecycle_fail() returns trigger language plpgsql as $fixture$begin if ${condition} then raise exception 'Synthetic late failure';end if;return NEW;end;$fixture$;create trigger fixture_lifecycle_fail after ${event} on public.${table} for each row execute function public.fixture_lifecycle_fail();`)
 try { return await body() } finally { await sql(`drop trigger fixture_lifecycle_fail on public.${table};drop function public.fixture_lifecycle_fail();`) }
}
if (Number(await sql('select count(*) from auth.users;')) === 0) await seed()
await test('authoritative preview is read only, ranked and scoped', async () => {
 const f = await fixture(), before = await state(f), p = await preview(f)
 assert.equal(p.plan.falls, 1); assert.equal(p.plan.total_equipes, 3); assert.equal(p.plan.champion_id, f.parts[0]); assert.equal(p.plan.ranking[0].campeonato_equipe_id, f.parts[0]); assert.equal(p.fence.edition_id, f.edition); assert.match(p.fence.plan_hash, /^[a-f0-9]{64}$/); assert.deepEqual(await state(f), before)
})
if (!results[0].passed) { fs.writeFileSync(directory + '/native-first-error.json', JSON.stringify(results, null, 2)); throw Error('Basic preview must pass before negative tests') }
await test('publish closes all intended rows and registrations, preserves cancelled/previously closed rows', async () => {
 const f = await fixture(), before = await image(f), response = (await publish(f, await preview(f))).data, after = await image(f)
 assert.equal(response.operation_confirmed, true); assert.equal(response.edition.status, 'encerrada'); assert.equal(response.registrations_open, false)
 assert.equal(after.config.aceita_novas_inscricoes_equipes, false); assert.equal(after.edition.metadados.keep, 'custom'); assert.equal(after.edition.metadados.final_total_equipes, 3)
 assert.equal(after.stages[0].status, 'encerrada'); assert.deepEqual(after.stages[1], before.stages[1]); assert.deepEqual(after.stages[2], before.stages[2]); assert.deepEqual(after.divisions[1], before.divisions[1]); assert.ok(after.revision > before.revision)
 const s = await state(f); assert.equal(s.receipts.length, 1); assert.equal(s.publications.length, 1); assert.deepEqual(s.publications[0].anterior, before); assert.deepEqual(s.publications[0].posterior, after)
})
if (!results[1].passed) { fs.writeFileSync(directory + '/native-first-error.json', JSON.stringify(results, null, 2)); throw Error('Basic publish must pass before negative tests') }
await test('reopen activates ALL closed rows, preserves cancelled/other metadata, registrations stay closed', async () => {
 const f = await fixture(), before = await image(f); await publish(f, await preview(f)); const r = (await reopen(f, await preview(f, false))).data, after = await image(f)
 assert.equal(r.edition.status, 'ativa'); assert.equal(after.edition.data_fim, null); assert.equal(after.config.aceita_novas_inscricoes_equipes, false)
 assert.deepEqual(after.stages.map(s => s.status), ['ativa','ativa','cancelada']); assert.deepEqual(after.divisions.map(s => s.status), ['ativa','cancelada']); assert.equal(after.edition.metadados.keep, 'custom')
 assert.deepEqual(after.stages[2], before.stages[2]); assert.deepEqual(after.divisions[1], before.divisions[1])
 for (const name of ['final_publicado_em','final_publicado_por','final_publicacao_id','final_total_equipes','final_campeao_campeonato_equipe_id']) assert.equal(after.edition.metadados[name], null)
 assert.equal((await state(f)).publications[0].reaberta, true)
})
await test('publication/reopen original receipt replay cannot repeat or overwrite newer data', async () => {
 const f = await fixture(), p = await preview(f), pubKey = id(++key); await publish(f, p, { request: pubKey }); const undo = await preview(f, false), undoKey = id(++key); await reopen(f, undo, { request: undoKey })
 const before = await state(f); assert.equal((await publish(f, p, { request: pubKey })).data.repetida, true); assert.equal((await reopen(f, undo, { request: undoKey })).data.repetida, true); assert.deepEqual(await state(f), before)
})
await test('same UUID with another intent is refused', async () => { const f = await fixture(), p = await preview(f), request = id(++key); await publish(f, p, { request }); return unchanged(f, () => publish(f, { fence: { ...p.fence, revision: p.fence.revision + 1 } }, { request })) })
await test('new unfinished fall invalidates approved preview without partial state', async () => {
 const f = await fixture(), p = await preview(f); await sql(`insert into public.campeonato_partidas(campeonato_id,fase_id,jogo_id,numero_partida) values('${f.camp}','${f.phase}','${f.game}',2);`); return unchanged(f, () => publish(f, p))
})
for (const change of ['result','group','stage','configuration','edition','phase','bonus','game']) await test('ordinary ' + change + ' update invalidates preview', async () => {
 const f = await fixture(), p = await preview(f)
 const queries = { result: `update public.campeonato_resultados_equipes set abates=50 where id='${f.resultIds[0]}';`, group: `update public.campeonato_grupos set nome='Changed' where id='${f.group}';`, stage: `update public.campeonato_etapas set nome='Changed' where id='${f.stages[0]}';`, configuration: `update public.campeonato_configuracoes set numero_vagas=20 where campeonato_id='${f.camp}';`, edition: `update public.campeonato_edicoes set titulo_publico='Changed' where id='${f.edition}';`, phase: `update public.campeonato_fases set nome='Changed' where id='${f.phase}';`, bonus: `insert into public.campeonato_fases_bonus_equipes(campeonato_id,fase_id,campeonato_equipe_id,posicao_origem,pontos_bonus) values('${f.camp}','${f.phase}','${f.parts[0]}',1,3);`, game: `update public.campeonato_jogos set nome='Changed' where id='${f.game}';` }
 await sql(queries[change]); return unchanged(f, () => publish(f, p))
})
await test('ABA within the same transaction and equal timestamps still invalidates revision', async () => {
 const f = await fixture(), p = await preview(f), stamp = (await image(f)).stages[0].updated_at
 await sql(`begin;update public.campeonato_etapas set nome='Temporary' where id='${f.stages[0]}';update public.campeonato_etapas set nome='Active',updated_at=${quote(stamp)} where id='${f.stages[0]}';commit;`)
 return unchanged(f, () => publish(f, p))
})
for (const table of ['campeonato_etapas','campeonato_divisoes','campeonato_edicoes','campeonato_configuracoes','lifecycle_publicacoes','lifecycle_recibos']) await test('publish late ' + table + ' failure rolls back all rows/revision/audit/receipt/realtime', async () => {
 const f = await fixture(), p = await preview(f); return failAfter(table, table.startsWith('lifecycle_') ? 'insert' : 'update', f, () => unchanged(f, () => publish(f, p)))
})
for (const table of ['campeonato_etapas','campeonato_divisoes','campeonato_edicoes','lifecycle_publicacoes','lifecycle_recibos']) await test('reopen late ' + table + ' failure rolls back everything', async () => {
 const f = await fixture(); await publish(f, await preview(f)); const p = await preview(f, false); return failAfter(table, table === 'lifecycle_recibos' ? 'insert' : 'update', f, () => unchanged(f, () => reopen(f, p)))
})
await test('post-receipt result mutation causes complete publication rollback', async () => {
 const f = await fixture(), p = await preview(f)
 await sql(`create function public.fixture_lifecycle_post() returns trigger language plpgsql as $post$begin update public.campeonato_resultados_equipes set abates=99 where id='${f.resultIds[0]}';return NEW;end;$post$;create trigger fixture_lifecycle_post after insert on public.lifecycle_recibos for each row execute function public.fixture_lifecycle_post();`)
 try { return await unchanged(f, () => publish(f, p)) } finally { await sql('drop trigger fixture_lifecycle_post on public.lifecycle_recibos;drop function public.fixture_lifecycle_post();') }
})
await test('changed result after publication refuses reopen', async () => { const f = await fixture(); await publish(f, await preview(f)); await sql(`update public.campeonato_resultados_equipes set abates=50 where id='${f.resultIds[0]}';`); return unchanged(f, () => preview(f, false)) })
await test('historical closed edition without private before image refuses reopen', async () => { const f = await fixture(); await sql(`update public.campeonato_edicoes set status='encerrada' where id='${f.edition}';`); return unchanged(f, () => preview(f, false)) })
await test('cancelled edition cannot be published', async () => { const f = await fixture(); await sql(`update public.campeonato_edicoes set status='cancelada' where id='${f.edition}';`); return unchanged(f, () => preview(f)) })
await test('foreign actor cannot publish or read preview', async () => { const f = await fixture(), p = await preview(f); return unchanged(f, () => publish(f, p, { actor: 2 })) })
await test('replay rechecks current management permission', async () => {
 const f = await fixture(), p = await preview(f), request = id(++key); await publish(f, p, { request }); await sql(`insert into public.produtoras(id,auth_user_id,username,nome) values('${id(f.n + 900)}','${id(2)}','foreign-${f.n}','Foreign') on conflict(auth_user_id) do nothing;update public.campeonatos set criado_por='${id(2)}',produtora_id=(select id from public.produtoras where auth_user_id='${id(2)}') where id='${f.camp}';`); return unchanged(f, () => publish(f, p, { request }))
})
await test('exact ties match stable JS result-id order', async () => {
 const f = await fixture(); await sql(`update public.campeonato_resultados_equipes set posicao=2,abates=1 where campeonato_id='${f.camp}';`); const p = await preview(f); assert.deepEqual(p.plan.ranking.map(r => r.campeonato_equipe_id), f.parts)
})
await test('League requires all groups to have ranking; absent second-group results refuse', async () => {
 const f = await fixture({ type: 'liga' }); await sql(`insert into public.campeonato_grupos(id,campeonato_id,fase_id,nome,slots) values('${id(f.n + 160)}','${f.camp}','${f.phase}','Other',4);`); return unchanged(f, () => preview(f))
})
await test('League grouped ranking has no global champion and counts every group', async () => { const f = await fixture({ type: 'liga' }), p = await preview(f); assert.equal(p.plan.groups.length, 1); assert.equal(p.plan.total_equipes, 3); assert.equal(p.plan.champion_id, null); assert.equal((await publish(f, p)).data.champion_id, null) })
await test('Point Rush uses decisive-game scores plus initial bonus', async () => {
 const f = await fixture({ final: true }); await sql(`update public.campeonato_fases_configuracoes set modo_acumulacao='bonus_por_ranking',jogo_decisivo_id='${f.game}' where fase_id='${f.phase}';insert into public.campeonato_fases_bonus_equipes(campeonato_id,fase_id,campeonato_equipe_id,posicao_origem,pontos_bonus) values('${f.camp}','${f.phase}','${f.parts[1]}',1,100);`)
 assert.equal((await preview(f)).plan.champion_id, f.parts[1])
})
await test('Golden Booyah tests prior accumulated points, not points earned in winning fall', async () => {
 const f = await fixture({ final: true, falls: 2 }); await sql(`update public.campeonato_fases_configuracoes set modo_decisao='booyah_ouro',booyah_ouro_pontos_limite=10 where fase_id='${f.phase}';`)
 const p = await preview(f); assert.equal(p.plan.gold_reached, true); assert.equal(p.plan.winner_fall_id, f.falls[1]); assert.equal(p.plan.champion_id, f.parts[0])
})
for (const patch of ["booyah_ouro_queda_minima=3", "booyah_ouro_desempate_final='decisao_manual'"]) await test('unsupported Golden Booyah configuration is refused instead of silently ignored', async () => { const f = await fixture({ final: true }); await sql(`update public.campeonato_fases_configuracoes set modo_decisao='booyah_ouro',booyah_ouro_pontos_limite=10,${patch} where fase_id='${f.phase}';`); return unchanged(f, () => preview(f)) })
for (const mode of ['normal','point-rush','gold','gold-fallback','rush-gold']) await test('native champion/ranking matches real JS statistics service: ' + mode, async () => {
 const f = await fixture({ final: true, falls: 2 })
 if (mode !== 'normal') await sql(`update public.campeonato_fases_configuracoes set modo_acumulacao=${quote(mode.includes('rush') ? 'bonus_por_ranking' : 'acumulado')},jogo_decisivo_id=${mode.includes('rush') ? quote(f.game) : 'null'},modo_decisao=${quote(mode.includes('gold') ? 'booyah_ouro' : 'pontuacao_normal')},booyah_ouro_pontos_limite=${mode === 'gold-fallback' ? 10000 : 10} where fase_id='${f.phase}';`)
 if (mode.includes('rush')) await sql(`insert into public.campeonato_fases_bonus_equipes(campeonato_id,fase_id,campeonato_equipe_id,posicao_origem,pontos_bonus) values('${f.camp}','${f.phase}','${f.parts[1]}',1,100);`)
 if (mode === 'rush-gold') await sql(`update public.campeonato_resultados_equipes set posicao=1 where campeonato_id='${f.camp}' and campeonato_equipe_id='${f.parts[1]}';`)
 const tables = {}
 for (const table of ['campeonato_fases','campeonato_jogos','campeonato_partidas','campeonato_fases_configuracoes','campeonato_fases_bonus_equipes','campeonato_estatisticas_equipes_detalhe','campeonato_estatisticas_mvp_detalhe']) tables[table] = await json(`select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.${table} x where campeonato_id='${f.camp}';`)
 tables.equipe_lines = await json(`select jsonb_agg(jsonb_build_object('id',id,'public_id',public_id)) from public.equipe_lines where id in('${id(200)}','${id(201)}','${id(202)}');`)
 const client = createClient('https://native-parity-fixture.supabase.co','fixture-key',{ auth:{ persistSession:false },global:{ fetch:async(input,options={})=>{
  assert.equal(options.method || 'GET','GET'); const url = new URL(input), name = url.pathname.split('/').at(-1)
  let rows = [...tables[name] || []].filter(row=>[...url.searchParams].every(([key,value])=>['select','order','offset','limit'].includes(key) || match(row,`${key}.${value}`)))
  const orders = (url.searchParams.get('order') || '').split(',').map(value=>value.split('.'))
  rows.sort((a,b)=>{ for(const [key,direction] of orders) { const diff = String(a[key] ?? '').localeCompare(String(b[key] ?? '')); if(diff) return direction === 'desc' ? -diff : diff } return 0 })
  rows = rows.slice(Number(url.searchParams.get('offset') || 0),Number(url.searchParams.get('offset') || 0)+Math.min(1,Number(url.searchParams.get('limit') || 1000)))
  return Response.json(new Headers(options.headers).get('accept')?.includes('vnd.pgrst.object') ? rows[0] || null : rows)
 } } })
 // Single-row maybeSingle is not subjected to artificial list truncation for unique final/config.
 const stats = fixtureLoader({ '@backend/shared/supabase-admin':{ supabaseAdmin:client } })('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
 const summary = await stats.carregarResumoCampeao(f.camp), p = await preview(f)
 assert.equal(summary.campeao?.campeonato_equipe_id,p.plan.champion_id)
 const ranking = await stats.listarEstatisticasEquipes(f.camp,mode.includes('rush') ? { jogoId:f.game } : { faseId:f.phase })
 const bonus = mode.includes('rush') ? new Map([[f.parts[1],100]]) : new Map()
 const expected = ranking.map(row=>({ ...row,pontos_total:row.pontos_total+(bonus.get(row.campeonato_equipe_id) || 0) }))
  .sort((a,b)=>b.pontos_total-a.pontos_total || b.booyahs-a.booyahs || b.abates-a.abates || a.melhor_posicao-b.melhor_posicao).map((row,n)=>({ ...row,colocacao:n+1 }))
 for(let n=0;n<expected.length;n++) for(const field of ['campeonato_equipe_id','quedas','booyahs','abates','pontos_total','melhor_posicao','colocacao']) assert.equal(p.plan.ranking[n][field],expected[n][field],field)
 return { realJsChampionParity:true,capOne:true }
})
for (const role of ['anon','authenticated']) await test(role + ' cannot execute RPC/helpers or read private tables', async () => {
 for (const command of ["select public.fn_lifecycle_atomico(null,null,null,'publish_final');", "select public.dz_lifecycle_image(null);", 'select * from public.lifecycle_recibos;', 'select * from public.lifecycle_publicacoes;', 'select * from public.lifecycle_versoes;']) await assert.rejects(() => sql('set role ' + role + ';' + command))
})
await test('service cannot directly mutate private image/receipt/revision or call helpers', async () => {
 for (const command of ['delete from public.lifecycle_recibos;', 'delete from public.lifecycle_publicacoes;', 'delete from public.lifecycle_versoes;', 'select public.dz_lifecycle_image(null);']) await assert.rejects(() => sql(service + command))
})
await test('six native sessions same UUID: one publish and five receipt replays', async () => {
 const f = await fixture(), p = await preview(f), request = id(++key), runs = await Promise.all(Array.from({ length: 6 }, () => publish(f, p, { request, hold: .1 })))
 assert.equal(runs.filter(r => r.data.repetida).length, 5); assert.equal(new Set(runs.map(r => r.pid)).size, 6); assert.equal((await state(f)).receipts.length, 1)
})
await test('different UUIDs from same review: one publish and one refusal', async () => {
 const f = await fixture(), p = await preview(f), runs = await Promise.allSettled([publish(f, p, { hold: .3 }), publish(f, p)])
 assert.equal(runs.filter(r => r.status === 'fulfilled').length, 1); assert.equal((await state(f)).publications.length, 1)
})
for (const writer of ['new-fall','result']) await test('ordinary ' + writer + ' writer demonstrably waits on lifecycle coordination', async () => {
 const f = await fixture(), p = await preview(f), tag = 'fixture-lifecycle-' + f.n
 const wait = async (name, predicate) => { for (let n = 0; n < 35; n++) { const rows = await json(`select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'wait',wait_event,'type',wait_event_type)),'[]') from pg_stat_activity where application_name='${tag}-${name}';`); if (rows.some(predicate)) return rows; await new Promise(resolve => setTimeout(resolve, 40)) } throw Error('Native lock wait not observed') }
 const holder = publish(f, p, { hold: 3, prefix: `set application_name='${tag}-holder';` }); await wait('holder', row => row.wait === 'PgSleep')
 const command = writer === 'new-fall' ? `insert into public.campeonato_partidas(campeonato_id,fase_id,jogo_id,numero_partida) values('${f.camp}','${f.phase}','${f.game}',2);` : `update public.campeonato_resultados_equipes set abates=30 where id='${f.resultIds[0]}';`
 const other = sql(`set application_name='${tag}-writer';` + command)
 try { const observed = await wait('writer', row => row.type === 'Lock' && row.wait === 'advisory'); await Promise.all([holder, other]); assert.equal((await image(f)).edition.status, 'encerrada'); return { observed } } catch (error) { await Promise.allSettled([holder, other]); throw error }
})
const candidate = 'docs/sql/20261012_lifecycle_candidate.sql', summary = { generatedAt: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, candidate: { file: candidate, sha256: createHash('sha256').update(fs.readFileSync(candidate)).digest('hex') }, restoration: 'Confirmed user rule: activate all closed stages/divisions; preserve cancelled; registrations stay closed. Not activated.', scope: 'Owned isolated PG17.6/current saved public catalog with synthetic Auth/Realtime, no real project access/data. Writers can change after commit; revision then prevents reopening over newer changes.' }
fs.writeFileSync(directory + '/native-lifecycle.json', JSON.stringify(summary, null, 2) + '\n'); console.log(`Native lifecycle: ${summary.passed} passed / ${summary.failed} failed.`); if (summary.failed) process.exitCode = 1
