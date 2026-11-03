import fs from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const file=relative=>fs.readFileSync(path.join(root,relative),'utf8')
const sql=file('docs/sql/20261021_round3_readonly_audit.sql')
const indexSql=file('docs/sql/20261021_round3_index_candidates.sql')
const verifySql=file('docs/sql/20261021_round3_verify_candidates.sql')
const snapshot=JSON.parse(file('docs/RODADA_03_SNAPSHOT_PUBLICO.json'))
const stripComments=s=>s.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'')
let ok=0
const test=(description,callback)=>{callback();console.log('PASS',description);ok++}
test('R03 scripts SELECT-only never alter the database',()=>{
 for(const [name,script] of [['audit',sql],['verify',verifySql]]){
  const source=stripComments(script)
  assert.match(source,/\bselect\b/i, name)
  assert.doesNotMatch(source,/\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|call|copy|execute|do)\s+/i,name)
 }
})
test('R03 audit includes critical permissions, migration and slot counters',()=>{
 for(const field of ['tables_with_rls','tables_without_policy','policies_total','migrations_total',
 'public_callable_security_definers','invalid_slot_groups','occupied_mirror_mismatches',
 'duplicate_active_or_pending_lines','atomic_enrollment_rpc_present','legacy_line_index_present']){
  assert.ok(sql.includes(field),field)
 }
})
test('Live migration names match the 28 SQL migrations in the repository',()=>{
 const dir=path.join(root,'supabase/migrations')
 const local=fs.readdirSync(dir).filter(x=>/^\d{14}_.+\.sql$/.test(x)).map(x=>x.replace(/\.sql$/,'')).sort()
 assert.deepEqual(local,snapshot.applied_migrations.sort())
})
test('R03 SQL DDL candidates remain OUTSIDE the automatic migration directory',()=>{
 const migrations=fs.readdirSync(path.join(root,'supabase/migrations'))
 assert.ok(migrations.every(name=>!name.includes('20261021_')), 'Premature deployable migration')
 assert.match(indexSql,/NAO EXECUTAR NA PRODUCAO/i)
 assert.match(indexSql,/create index concurrently/ig)
 assert.doesNotMatch(stripComments(indexSql),/\bbegin\s*;/i)
})
test('R03 index candidates cover exactly the reviewed keys, with manual rollback',()=>{
 for(const x of ['campeonato_jogadores_jogo_id_r03_idx',
   'campeonato_slots_line_id_r03_idx','sistema_auditoria_administrador_r03_idx']){
   assert.ok(indexSql.includes('create index concurrently '+x),x)
   assert.ok(indexSql.includes('drop index concurrently public.'+x),x)
   assert.ok(verifySql.includes(x),x)
 }
})
test('No RLS policies or privilege grants added indiscriminately',()=>{
 const candidates=stripComments(indexSql)
 assert.doesNotMatch(candidates,/\b(create policy|grant|revoke|alter table|disable row level security)\b/i)
 assert.match(verifySql,/\bindisvalid\b/)
 assert.match(verifySql,/\bindisready\b/)
})
test('R01 and R02 regression check remains available',()=>{
 for(const x of ['TESTAR_RODADA_01.bat','TESTAR_RODADA_02.bat','scripts/testes/test-round2-guards.mjs']){
  assert.ok(fs.existsSync(path.join(root,x)),x)
 }
})
console.log(`Rodada 03: ${ok} verificacoes estruturais aprovadas (NAO equivalem a testes PostgreSQL nativos).`)
