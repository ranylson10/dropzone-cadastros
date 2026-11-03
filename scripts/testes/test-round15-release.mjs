import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { sourceFingerprint, assessment, EXTERNAL } from '../release/round14-evidence.mjs'

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dropzone-r15-fingerprint-'))
let checks=0
const write=(rel,content)=>{const f=path.join(tmp,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,content)}
try {
  write('package.json','{"name":"fixture"}')
  const baseline=sourceFingerprint(tmp)
  assert.equal(baseline.files,1)
  checks++
  // Regressao real: cada alteracao relevante precisa invalidar a evidencia.
  const paths = ['tests-e2e/functional/login.spec.ts','app/app.json',
    '.github/workflows/deploy.yml','docs/sql/candidato.sql',
    'playwright.config.ts','playwright.contracts.config.ts',
    'database/migrations/fixture.sql','supabase/migrations/fixture.sql',
    'app/index.ts','web/app/page.tsx','desktop/main.js']
  let previous=baseline.digest
  for(const [i,rel] of paths.entries()){
    write(rel,`fixture-${i}`)
    const current=sourceFingerprint(tmp)
    assert.notEqual(current.digest,previous,`${rel} nao entrou no hash`)
    previous=current.digest;checks++
  }
  const relevant=sourceFingerprint(tmp)
  write('tests-e2e/.auth/admin.json','{"access_token":"DADO-SIMULADO"}')
  write('web/.env.local','SECRETO=SIMULADO')
  write('relatorios-testes/round14-local-evidence.json','{}')
  assert.equal(sourceFingerprint(tmp).digest,relevant.digest,'Arquivos privados ou derivados nao podem alterar o hash')
  checks++
  const local=['regressoes_r01_r12','verificacao_r13','verificacao_r14','verificacao_r15','verificacao_r16','verificacao_r17','verificacao_r18','verificacao_r19',
    'seguranca_completa','typecheck','lint','build_next_compilacao','build_next_completo']
  const pass={source:relevant,checks:local.map(name=>({name,status:'PASSOU'}))}
  const proposed=assessment(pass,relevant)
  assert.equal(proposed.verdict,'BLOQUEADA')
  assert.equal(proposed.blocked.length,EXTERNAL.length)
  checks++
  const noBuild=assessment({...pass,checks:pass.checks.filter(c=>c.name!=='build_next_completo')},relevant)
  assert.ok(noBuild.blocked.includes('build_next_completo'), 'Compilacao nao certifica build integral')
  checks++
  const changed=assessment(pass,{...relevant,digest:'0'.repeat(64)})
  assert.ok(changed.blocked.includes('integridade_evidencia'))
  checks++
  const script=fs.readFileSync(new URL('../release/round14-evidence.mjs',import.meta.url),'utf8')
  assert.match(script,/build_next_completo/)
  assert.match(script,/\['run','build','--workspace','dropzone-web'\]/)
  checks++
  const lab=spawnSync(process.execPath,[fileURLToPath(new URL('../release/round15-lab-preflight.mjs',import.meta.url))],{
    cwd:tmp,encoding:'utf8',timeout:20000})
  assert.ok([0,2].includes(lab.status),`Preflight deve produzir diagnostico, nunca falhar por Docker ausente: status=${lab.status}, error=${lab.error?.message || 'nenhum'}, stderr=${(lab.stderr || '').slice(0,300)}`)
  const report=JSON.parse(lab.stdout)
  assert.equal(report.safe_for_production,false)
  assert.equal(report.mode,'somente-leitura')
  assert.equal(report.ready,lab.status===0)
  checks++
  console.log(`R15: ${checks} testes aprovados: fingerprint inclui E2E, app, CI, SQL e configs; build integral e gates externos nao podem ser simulados.`)
} finally {fs.rmSync(tmp,{recursive:true,force:true})}
