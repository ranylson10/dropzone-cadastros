import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = process.cwd()
const envFile = resolve(projectRoot, 'web', '.env.local')
const defaultBaseUrl = 'https://dropzone-cadastros.vercel.app'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(envFile)
process.env.E2E_BASE_URL ||= defaultBaseUrl

const npmCli = process.env.npm_execpath
const useNpmCli = Boolean(npmCli && existsSync(npmCli))

function runNpm(args) {
  if (useNpmCli) {
    return spawnSync(process.execPath, [npmCli, ...args], {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
      shell: false,
    })
  }

  // Fallback para execução direta fora do `npm run`, inclusive no Windows.
  return spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}
const stages = [
  ['ESLint', ['run', 'lint']],
  ['TypeScript', ['run', 'typecheck']],
  ['Build de produção', ['run', 'build']],
  ['Auditoria completa', ['run', 'audit:dropzone:full:orchestrated']],
  ['Sessões E2E automáticas', ['run', 'test:e2e:auth:prepare']],
  ['Playwright completo', ['run', 'test:e2e:all']],
]

function printAuditFailures() {
  const reportPath = resolve(projectRoot, 'relatorios-testes', 'ultimo-relatorio.json')
  if (!existsSync(reportPath)) return
  try {
    const payload = JSON.parse(readFileSync(reportPath, 'utf8'))
    const errors = Array.isArray(payload?.results)
      ? payload.results.filter((item) => item?.status === 'ERRO')
      : []
    if (errors.length === 0) return
    console.error('\n[DETALHES DOS ERROS DA AUDITORIA]')
    for (const [index, item] of errors.entries()) {
      console.error(`\n${index + 1}. ${item.area || 'Auditoria'} — ${item.title || 'Erro'}`)
      if (item.details) console.error(`   Detalhes: ${item.details}`)
      if (item.recommendation) console.error(`   Correção: ${item.recommendation}`)
    }
  } catch (error) {
    console.error(`\n[AVISO] Não foi possível ler o relatório detalhado: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const startedAt = Date.now()
const results = []

console.log('\n============================================================')
console.log(' DROPZONE — TESTE COMPLETO AUTOMÁTICO')
console.log('============================================================')
console.log(`Projeto: ${projectRoot}`)
console.log(`E2E:     ${process.env.E2E_BASE_URL}`)
console.log('O processo executará todas as etapas e encerrará sozinho.\n')

for (const [name, args] of stages) {
  const stageStartedAt = Date.now()
  console.log(`\n[INÍCIO] ${name}`)
  console.log('------------------------------------------------------------')

  const result = runNpm(args)

  const durationSeconds = Math.round((Date.now() - stageStartedAt) / 1000)
  const code = typeof result.status === 'number' ? result.status : 1
  results.push({ name, code, durationSeconds })

  if (result.error) console.error(`\n[ERRO] ${result.error.message}`)

  if (code !== 0) {
    console.error(`\n[FALHOU] ${name} (${durationSeconds}s)`)
    if (name === 'Auditoria completa') printAuditFailures()
    console.error('[CONTINUANDO] As próximas etapas ainda serão executadas para concluir a varredura completa.')
  } else {
    console.log(`\n[OK] ${name} (${durationSeconds}s)`)
  }
}

const totalSeconds = Math.round((Date.now() - startedAt) / 1000)
const failedStages = results.filter((item) => item.code !== 0)

console.log('\n============================================================')
console.log(' RESUMO FINAL')
console.log('============================================================')
for (const result of results) {
  console.log(`${result.code === 0 ? '[OK]    ' : '[FALHA] '} ${result.name} — ${result.durationSeconds}s`)
}
console.log(`Tempo total: ${totalSeconds}s`)

if (results.length !== stages.length) {
  console.error('\nResultado: INCOMPLETO.')
  process.exit(1)
}

if (failedStages.length > 0) {
  console.error(`\nResultado: VARREDURA CONCLUÍDA com ${failedStages.length} etapa(s) reprovada(s).`)
  console.error(`Etapas com falha: ${failedStages.map((item) => item.name).join(', ')}`)
  process.exit(1)
}

console.log('\nResultado: TUDO APROVADO.')
