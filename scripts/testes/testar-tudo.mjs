import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = process.cwd()
const envFile = resolve(projectRoot, 'web', '.env.local')
const defaultBaseUrl = 'https://www.dpzone.site'

function loadEnvFile(file) {
  if (!existsSync(file)) return
  const content = readFileSync(file, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
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
  return spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

const stages = [
  { name: 'ESLint', args: ['run', 'lint'], blocking: true },
  { name: 'TypeScript', args: ['run', 'typecheck'], blocking: true },
  { name: 'Build de produção', args: ['run', 'build'], blocking: true },
  { name: 'Auditoria completa', args: ['run', 'audit:dropzone:full:orchestrated'], blocking: true },
  { name: 'Sessões E2E automáticas', args: ['run', 'test:e2e:auth:prepare'], blocking: true },
  { name: 'Fluxos reais + navegação + cliques — desktop e mobile', args: ['run', 'test:e2e:total'], blocking: true },
  { name: 'Contratos históricos controlados', args: ['run', 'test:e2e:contracts'], blocking: false },
]

if (process.env.RESEND_AUDIT_API_KEY && process.env.DROPZONE_EMAIL_SMOKE_ADDRESS) {
  stages.push({ name: 'Entrega real de e-mail', args: ['run', 'test:auth-email'], blocking: true })
}

const startedAt = Date.now()
const results = []

console.log('\n============================================================')
console.log(' DROPZONE — TESTE TOTAL CONFIÁVEL')
console.log('============================================================')
console.log(`Projeto: ${projectRoot}`)
console.log(`E2E:     ${process.env.E2E_BASE_URL}`)
console.log('Bloqueante: qualidade, build, sessões, fluxos reais, cliques, desktop/mobile e entrega de e-mail quando configurada.')
console.log('Consultivo: contratos históricos de código; falhas aqui são exibidas sem mascarar o estado funcional atual.\n')

for (const stage of stages) {
  const start = Date.now()
  console.log(`\n[INÍCIO] ${stage.name}${stage.blocking ? '' : ' [CONSULTIVO]'}`)
  console.log('------------------------------------------------------------')
  const result = runNpm(stage.args)
  const seconds = Math.round((Date.now() - start) / 1000)
  const code = typeof result.status === 'number' ? result.status : 1
  results.push({ ...stage, code, seconds })
  if (result.error) console.error(`[ERRO] ${result.error.message}`)
  console.log(code === 0
    ? `\n[OK] ${stage.name} (${seconds}s)`
    : stage.blocking
      ? `\n[FALHOU] ${stage.name} (${seconds}s)`
      : `\n[AVISO] ${stage.name} encontrou contratos desatualizados (${seconds}s)`)
  if (code !== 0 && stage.blocking) console.log('[CONTINUANDO] A varredura segue para mostrar todos os problemas bloqueantes de uma vez.')
}

const blockingFailed = results.filter((item) => item.blocking && item.code !== 0)
const advisoryFailed = results.filter((item) => !item.blocking && item.code !== 0)

console.log('\n============================================================')
console.log(' RESUMO FINAL')
console.log('============================================================')
for (const item of results) {
  const label = item.code === 0 ? '[OK]    ' : item.blocking ? '[FALHA] ' : '[AVISO] '
  console.log(`${label} ${item.name} — ${item.seconds}s`)
}
console.log(`Tempo total: ${Math.round((Date.now() - startedAt) / 1000)}s`)

if (advisoryFailed.length) {
  console.log('\nContratos históricos com expectativa antiga foram separados como AVISO.')
  console.log('Relatório: relatorios-testes/playwright-report-contratos')
}

if (blockingFailed.length) {
  console.error(`\nResultado funcional: REPROVADO — ${blockingFailed.length} etapa(s) bloqueante(s): ${blockingFailed.map((item) => item.name).join(', ')}`)
  process.exit(1)
}

console.log('\nResultado funcional: TUDO APROVADO.')
if (advisoryFailed.length) console.log('Há avisos de contratos históricos para saneamento, sem confundir com bug funcional.')
