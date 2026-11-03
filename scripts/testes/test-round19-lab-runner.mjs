// R19: offline contract. Actual PostgreSQL evidence requires HOMOLOGAR_POSTGRES_R19.bat.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { runLab,verifyLocalCatalog,verifyLabInspection,verifyLocalDockerEndpoint,assertNoRemoteDbTarget,reportStatus } from '../release/round19-laboratorio.mjs'
import {safeBuildEnvironment,webPlan} from '../release/round19-web-check.mjs'
import { ROOT, sourceFingerprint, assessment, EXTERNAL } from '../release/round14-evidence.mjs'
let checks=0
const ok=(cond,msg)=>{assert.ok(cond,msg);checks++}
const fail=(fn,regex)=>{assert.throws(fn,regex);checks++}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dzp-r19-'))
try {
  const catalog={generated_at:'2026-10-11T12:00:00Z',tables:Array.from({length:120},(_,i)=>({table_schema:'public',table_type:'BASE TABLE',table_name:'t'+i}))}
  for(const field of ['columns','indexes','functions','constraints','triggers','policies','rls'])catalog[field]=[{}]
  const file=path.join(tmp,'catalog.json');fs.writeFileSync(file,JSON.stringify(catalog))
  ok(verifyLocalCatalog(file).base_tables===120,'historical catalog recognized')
  for(const field of ['columns','functions','policies']){
    const bad={...catalog,[field]:[]};fs.writeFileSync(file,JSON.stringify(bad))
    fail(()=>verifyLocalCatalog(file),/insuficiente/)
  }
  fs.writeFileSync(file,'not-json');fail(()=>verifyLocalCatalog(file),/Unexpected token|not valid JSON/)
  const plan=runLab({runTag:'20261027_010203_abcdef'})
  ok(plan.mode==='plano_sem_execucao','plan mode explicitly non-executing')
  ok(plan.steps.some(s=>s.name==='transacoes_concorrentes_nativas'),'plan names real native test')
  ok(plan.steps.some(s=>s.name==='docker_endpoint'),'plan verifies local Docker')
  const withZip=runLab({runTag:'20261027_010203_abcdef',zipPath:'sample.zip'})
  ok(withZip.steps[0].name==='importar_catalogo_original','catalog imported only when zip explicitly supplied')
  fail(()=>runLab({runTag:'arbitrary;delete'}),/invalido/)
  const env=assertNoRemoteDbTarget({SUPABASE_SERVICE_ROLE_KEY:'secret',DATABASE_URL:'postgres://db',DOCKER_HOST:'tcp://example:2375',PGHOST:'db',HOME:'safe'})
  ok(!('SUPABASE_SERVICE_ROLE_KEY' in env)&&!('DATABASE_URL' in env)&&!('DOCKER_HOST' in env)&&env.HOME==='safe','child env cannot inherit production secrets or remote Docker overrides')
  ok(env.DROPZONE_FIXTURE_DB==='dropzone_audit','child forces fixture database')
  const id='a'.repeat(64), labels=JSON.stringify({'dropzone.audit':'inscricoes-20261011'})
  ok(verifyLabInspection(`${labels}|none|running|postgres:17.6|${id}`)===id,'lab identity accepted')
  fail(()=>verifyLabInspection(`${labels}|bridge|running|postgres:17.6|${id}`),/Only the labeled/)
  for(const endpoint of ['npipe:////./pipe/docker_engine','npipe:////./pipe/dockerDesktopLinuxEngine','unix:///var/run/docker.sock','unix:///run/user/1000/docker.sock']){
    ok(verifyLocalDockerEndpoint(endpoint)===endpoint,'local endpoint '+endpoint)
  }
  for(const endpoint of ['tcp://127.0.0.1:2375','ssh://root@host','tcp://remote:2375','', 'unix:///tmp/shared.sock'])fail(()=>verifyLocalDockerEndpoint(endpoint),/remoto|desconhecido/)
  ok(reportStatus([{status:'PASSOU'}])==='TESTES_NATIVOS_APROVADOS_EM_FIXTURE','native pass does not claim production certified')
  ok(reportStatus([{status:'FALHOU'}])==='LABORATORIO_NAO_HOMOLOGADO','native failure blocks')
  const fp=sourceFingerprint()
  const local=['regressoes_r01_r12','verificacao_r13','verificacao_r14','verificacao_r15','verificacao_r16','verificacao_r17','verificacao_r18','verificacao_r19','seguranca_completa','typecheck','lint','build_next_compilacao','build_next_completo']
  const gate=assessment({source:fp,checks:local.map(name=>({name,status:'PASSOU'}))},fp)
  ok(gate.blocked.length===EXTERNAL.length && gate.verdict==='BLOQUEADA','R19 still blocks production')
  const missing=assessment({source:fp,checks:local.filter(n=>n!=='verificacao_r19').map(name=>({name,status:'PASSOU'}))},fp)
  ok(missing.blocked.includes('verificacao_r19'),'R19 actually required in gate')
  const bat=fs.readFileSync(path.join(ROOT,'HOMOLOGAR_POSTGRES_R19.bat'),'utf8')
  ok(bat.includes('round19-laboratorio.mjs --execute'),'user can run real native validation')
  ok(bat.includes('DROPZONE_CATALOGO_LAB_PRIVADO.zip'),'user can supply the validated private catalog-only ZIP without downloading entire original archive')
  const web=fs.readFileSync(path.join(ROOT,'HOMOLOGAR_WEB_R19.bat'),'utf8')
  ok(/node\s+scripts[\\/]release[\\/]round19-web-check\.mjs\s+--execute\b/i.test(web),'web runner launches sanitized build')
  // Teste sem arquivos de ambiente: segredos herdados nao sao encaminhados.
  // No Windows pode existir .env.local real na raiz. O teste nao deve depender
  // desses arquivos nem interpretar placeholders seguros como credenciais vazadas.
  const safeRoot=path.join(tmp,'web-safe-env')
  fs.mkdirSync(safeRoot)
  const raw={SUPABASE_SERVICE_ROLE_KEY:'real',DATABASE_URL:'postgres://real',STRIPE_SECRET_KEY:'secret',PGHOST:'remote',NEXT_PUBLIC_SUPABASE_URL:'https://real.supabase.co',HOME:'safe'}
  const safe=safeBuildEnvironment(raw,safeRoot)
  ok(!Object.hasOwn(safe,'SUPABASE_SERVICE_ROLE_KEY')&&!Object.hasOwn(safe,'DATABASE_URL')&&!Object.hasOwn(safe,'STRIPE_SECRET_KEY')&&!Object.hasOwn(safe,'PGHOST')&&safe.HOME==='safe','web runner strips inherited credentials without .env files')
  ok(safe.NEXT_PUBLIC_SUPABASE_URL==='https://build-placeholder.supabase.co','web build does not use production public URL')
  // Teste com .env.local: Next.js carrega os nomes presentes nesse arquivo,
  // por isso o build precisa substitui-los por placeholders em process.env.
  fs.mkdirSync(path.join(safeRoot,'web'))
  fs.writeFileSync(path.join(safeRoot,'web','.env.local'),'SUPABASE_SERVICE_ROLE_KEY=private\nDATABASE_URL=postgresql://private\nSTRIPE_SECRET_KEY=private\nNEXT_PUBLIC_SUPABASE_URL=https://private.supabase.co\n')
  const withEnv=safeBuildEnvironment(raw,safeRoot)
  ok(withEnv.SUPABASE_SERVICE_ROLE_KEY==='build-placeholder-disabled'&&withEnv.STRIPE_SECRET_KEY==='build-placeholder-disabled','web runner replaces credentials sourced from .env.local')
  ok(withEnv.DATABASE_URL==='postgresql://disabled:disabled@127.0.0.1:1/disabled','web runner prevents local env database connection')
  ok(withEnv.NEXT_PUBLIC_SUPABASE_URL==='https://build-placeholder.supabase.co','web runner replaces local env Supabase URL')
  ok(!Object.values(withEnv).some(v=>['real','secret','postgres://real','https://real.supabase.co'].includes(v)),'web runner never retains inherited secret values')
  ok(webPlan().steps.some(x=>x.name==='build_integral'),'web runner checks entire Next.js build')
  const cli=spawnSync(process.execPath,['scripts/release/round19-laboratorio.mjs'],{encoding:'utf8',timeout:15000})
  ok(cli.status===0&&JSON.parse(cli.stdout).mode==='plano_sem_execucao','CLI plan mode does not touch Docker')
  // We never execute a native query in offline tests.
  console.log(`R19: ${checks} verificacoes offline de laboratorio, isolamento e gate de publicacao aprovadas.`)
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
