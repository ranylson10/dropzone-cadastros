// R14: evidencias LOCAIS obtidas por processos realmente executados.
// Nao faz deploy, nao roda SQL, nao acessa producao e nao afirma homologacao final.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OMIT = new Set(['node_modules', '.next', '.git', '.auth', '.expo', '.vercel', 'relatorios-testes', 'test-results', 'coverage', 'dist', 'build', '.temp', '.cache'])
// R15: o hash precisa cobrir TODO codigo que sera compilado/testado e seus
// arquivos de configuracao. Antes, alteracoes em app.json, Playwright ou E2E
// nao invalidavam uma evidencia R14 aparentemente atual.
const FILES = ['package.json', 'package-lock.json', '.gitignore', '.vercelignore']
const ROOT_LAUNCHER = /\.(?:bat|ps1)$/i // R19: entrypoints are release-critical code too
const DIRECTORIES = ['.github/workflows', 'web', 'backend', 'app', 'desktop',
  'tests-e2e', 'database/migrations', 'supabase/migrations', 'docs/sql', 'scripts']
const CONFIG_FILE = /^(?:playwright(?:\.[a-z0-9_-]+)?\.config\.[cm]?[jt]s|tsconfig(?:\.[a-z0-9_-]+)?\.json|eslint\.config\.[cm]?[jt]s)$/i

export function sourceFingerprint(root = ROOT) {
  const list = []
  const visit = (dir, relative) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes:true }).sort((a,b)=>a.name.localeCompare(b.name))) {
      if (OMIT.has(entry.name) || entry.name.startsWith('.env') || entry.name === '.npmrc') continue
      const rel = relative ? `${relative}/${entry.name}` : entry.name
      const abs = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) visit(abs, rel)
      else if (entry.isFile()) list.push(rel)
    }
  }
  for (const rel of FILES) if (fs.existsSync(path.join(root, rel))) list.push(rel)
  for (const entry of fs.readdirSync(root, { withFileTypes:true })) {
    if (entry.isFile() && (CONFIG_FILE.test(entry.name) || ROOT_LAUNCHER.test(entry.name))) list.push(entry.name)
  }
  for (const rel of DIRECTORIES) if (fs.existsSync(path.join(root, rel))) visit(path.join(root, rel), rel)
  const hash = crypto.createHash('sha256')
  for (const rel of [...new Set(list)].sort()) {
    hash.update(rel); hash.update('\0'); hash.update(fs.readFileSync(path.join(root, rel))); hash.update('\0')
  }
  return { algorithm:'sha256', digest:hash.digest('hex'), files:[...new Set(list)].length }
}

export const EXTERNAL = Object.freeze([
  ['postgres_concorrencia', 'Duas conexoes em PostgreSQL 17 isolado, com falhas injetadas e locks reais'],
  ['migrations_e_acls', 'Comparacao de schema, grants, RLS e migrations no staging restaurado'],
  ['e2e_autenticado', 'Login, equipe, inscricao, permissao e pagamento em ambiente de homologacao'],
  ['rollback_restauracao', 'Restauracao testada de backup, SQL de reversao e comprovacao de integridade'],
  ['integracoes_reais', 'MatchStats, SPEC, Engine, OBS e Electron validados com sistemas reais'],
])

export function assessment(evidence, fingerprint) {
  const result = []
  const local = ['regressoes_r01_r12', 'verificacao_r13', 'verificacao_r14', 'verificacao_r15', 'verificacao_r16', 'verificacao_r17', 'verificacao_r18', 'verificacao_r19',
    'seguranca_completa', 'typecheck', 'lint', 'build_next_compilacao', 'build_next_completo']
  const byName = new Map((evidence?.checks || []).map(item => [item.name, item]))
  for (const name of local) {
    const entry = byName.get(name)
    result.push({ name, status:entry?.status === 'PASSOU' ? 'PASSOU' : (entry?.status || 'NAO_EXECUTADO') })
  }
  for (const [name] of EXTERNAL) result.push({ name, status:'PENDENTE_DE_HOMOLOGACAO' })
  if (!fingerprint || evidence?.source?.digest !== fingerprint.digest || evidence?.source?.files !== fingerprint.files) result.push({ name:'integridade_evidencia', status:'OBSOLETA' })
  else result.push({ name:'integridade_evidencia', status:'PASSOU' })
  return { verdict:result.every(c=>c.status==='PASSOU')?'PRONTA_PARA_REVISAO_HUMANA':'BLOQUEADA', checks:result, blocked:result.filter(c=>c.status!=='PASSOU').map(c=>c.name) }
}

function launch(name, command, args, opts={}) {
  if (opts.blocked) return { name,status:'BLOQUEADO',reason:opts.blocked }
  const start = Date.now()
  const completed = spawnSync(command, args, { cwd:ROOT, encoding:'utf8', timeout:opts.timeout||180000, maxBuffer:8*1024*1024, shell:false, env:process.env })
  return { name, status:completed.status===0 && !completed.error?'PASSOU':'FALHOU', exit_code: completed.status,
    duration_ms:Date.now()-start, reason:completed.error?.code || (completed.signal?`sinal_${completed.signal}`:undefined) }
}

function run() {
  const full = process.argv.includes('--full')
  const available = fs.existsSync(path.join(ROOT,'node_modules/typescript/package.json'))
  const next = fs.existsSync(path.join(ROOT,'node_modules/next/package.json'))
  const fingerprint = sourceFingerprint()
  const checks = [
    launch('regressoes_r01_r12','npm',['run','test:rounds'],{ blocked:!available?'TypeScript nao instalado (execute npm ci)':null }),
    launch('verificacao_r13','npm',['run','test:round13']),
    launch('verificacao_r14','npm',['run','test:round14']),
    launch('verificacao_r15','npm',['run','test:round15']),
    launch('verificacao_r16','npm',['run','test:round16']),
    launch('verificacao_r17','npm',['run','test:round17']),
    launch('verificacao_r18','npm',['run','test:round18']),
    launch('verificacao_r19','npm',['run','test:round19']),
  ]
  const unavailable = full ? (!next?'Next.js nao instalado (execute npm ci)':null) : 'Use --full com dependencias instaladas'
  checks.push(launch('seguranca_completa','npm',['run','test:security'],{blocked:unavailable,timeout:240000}))
  checks.push(launch('typecheck','npm',['run','typecheck'],{blocked:unavailable,timeout:240000}))
  checks.push(launch('lint','npm',['run','lint'],{blocked:unavailable,timeout:240000}))
  checks.push(launch('build_next_compilacao','npm',['run','build','--workspace','dropzone-web','--','--experimental-build-mode','compile'],{blocked:unavailable,timeout:300000}))
  // O build de compilacao nao prerenderiza; precisa-se tambem do build real.
  checks.push(launch('build_next_completo','npm',['run','build','--workspace','dropzone-web'],{blocked:unavailable,timeout:300000}))
  const report={ kind:'dropzone-round14-local-evidence',created_at:new Date().toISOString(), source:fingerprint,
    mode:full?'full':'quick', node:process.version, checks,
    limits:['Testes locais nao provam rollback nem concorrencia real.','Dados e credenciais de producao nao foram usados.','Verificacoes externas exigem homologacao separada.'] }
  report.release = assessment(report,fingerprint)
  const output = path.join(ROOT,'relatorios-testes','round14-local-evidence.json')
  fs.mkdirSync(path.dirname(output), {recursive:true})
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify({ output:path.relative(ROOT,output), source:fingerprint, checks:checks.map(c=>({name:c.name,status:c.status,reason:c.reason})),release:report.release },null,2))
  if (checks.some(c=>c.status==='FALHOU')) process.exitCode=1
  else if (report.release.verdict!=='PRONTA_PARA_REVISAO_HUMANA') process.exitCode=2
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) run()
