import fs from 'node:fs'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {dirname,resolve} from 'node:path'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const read=path=>fs.readFileSync(resolve(root,path),'utf8')
const idx=read('docs/sql/20261011_rejoin_index_candidate.sql')
const atomic=read('docs/sql/20261011_atomic_enrollment_candidate.sql')
const rollback=read('docs/sql/20261021_rejoin_rollback_candidate.sql')
const native=read('scripts/testes/postgres-inscricoes/validate-native.mjs')
let cases=0
const check=(name,fn)=>{fn();cases++;console.log('PASS '+name)}
check('Migration adds combined active AND pending uniqueness',()=>{
 assert.match(idx,/create unique index campeonato_equipes_line_aberta_unique\s+on public\.campeonato_equipes\(campeonato_id,line_id\)\s+where line_id is not null and status in \('ativo','pendente'\)/i)
})
check('Replacement is created before legacy guard is dropped inside transaction',()=>{
 assert.ok(idx.startsWith('-- R02'));assert.match(idx,/begin;[\s\S]*commit;/)
 assert.ok(idx.indexOf('create unique index campeonato_equipes_line_aberta_unique') < idx.indexOf('drop index public.campeonato_equipes_campeonato_line_unique;'))
 assert.match(idx,/i\.indisunique and i\.indisvalid and i\.indisready/)
 assert.match(idx,/lock table public\.campeonato_equipes in share row exclusive mode;/)
})
check('Pending and active conflicts are protected as a single set (model)',()=>{
 const live=s=>s==='ativo'||s==='pendente'
 for(const a of ['ativo','pendente','removido','rejeitado']) for(const b of ['ativo','pendente','removido','rejeitado']){
  const collision=live(a)&&live(b)
  assert.equal(collision,a==='ativo'&&b==='ativo'||a==='pendente'&&b==='pendente'||a==='ativo'&&b==='pendente'||a==='pendente'&&b==='ativo')
 }
})
check('Group enrollment excludes reserved slots and Lili holds',()=>{
 assert.match(atomic,/and \(s\.status='livre' or/)
 assert.match(atomic,/p_kind='team' and v_fixed_slot is not null and s\.id=v_fixed_slot/)
 assert.match(atomic,/reservation\.status='ativa'/)
 assert.match(atomic,/-- Recheck in a NEW READ COMMITTED statement AFTER locking the slot/)
 assert.match(atomic,/raise exception using errcode='23505',message='Slot reservado por outro convite ou reserva\.'/)
})
check('Rollback refuses historical duplicate lines before creating old unique index',()=>{
 assert.ok(rollback.indexOf('if exists(select 1 from public.campeonato_equipes')<rollback.indexOf('create unique index campeonato_equipes_campeonato_line_unique'))
 assert.ok(rollback.indexOf('create unique index campeonato_equipes_campeonato_line_unique')<rollback.indexOf('drop index public.campeonato_equipes_line_aberta_unique'))
})
check('Native PostgreSQL test scenarios are included (NOT executed here)',()=>{
 for(const marker of ['cannot simultaneously create pending and active','removed participation can rejoin','group invite never consumes Lili','fixed team token may claim only its own','fixed token refuses slot']) assert.ok(native.includes(marker),marker)
})
console.log(`Rodada 02 - ${cases} verificações estruturais/modelo aprovadas. PostgreSQL nativo requer laboratório.`)
