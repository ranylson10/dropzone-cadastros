import assert from 'node:assert/strict'
import { sourceFingerprint, assessment, EXTERNAL } from '../release/round14-evidence.mjs'
const fp=sourceFingerprint()
assert.match(fp.digest,/^[0-9a-f]{64}$/)
assert.ok(fp.files>800)
const names=['regressoes_r01_r12','verificacao_r13','verificacao_r14','verificacao_r15','verificacao_r16','verificacao_r17','verificacao_r18','verificacao_r19','seguranca_completa','typecheck','lint','build_next_compilacao','build_next_completo']
const pass={source:fp,checks:names.map(name=>({name,status:'PASSOU'}))}
const ready=assessment(pass,fp)
assert.equal(ready.verdict,'BLOQUEADA','Nem todas as verificacoes locais permitem publicar')
assert.equal(ready.blocked.length,EXTERNAL.length)
assert.ok(ready.blocked.includes('postgres_concorrencia'))
assert.ok(ready.blocked.includes('rollback_restauracao'))
const stale=assessment(pass,{...fp,digest:'0'.repeat(64)})
assert.equal(stale.verdict,'BLOQUEADA')
assert.ok(stale.blocked.includes('integridade_evidencia'))
const bad=assessment({...pass,checks:pass.checks.filter(x=>x.name!=='build_next_compilacao')},fp)
assert.ok(bad.blocked.includes('build_next_compilacao'))
const fail=assessment({...pass,checks:pass.checks.map(x=>x.name==='typecheck'?{...x,status:'FALHOU'}:x)},fp)
assert.ok(fail.blocked.includes('typecheck'))
const missing=assessment(null,fp)
assert.equal(missing.verdict,'BLOQUEADA')
assert.ok(missing.blocked.includes('integridade_evidencia'))
console.log('R14: 8 verificacoes de fonte, evidencia obsoleta, falha local e gate externo aprovadas. Publicacao permanece bloqueada.')
