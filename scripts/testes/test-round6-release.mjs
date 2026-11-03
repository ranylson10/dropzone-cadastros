// R06 - regressao acumulada + verificacao do pacote seguro, sem acesso ao banco.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { shouldPackage, assertNoSessionSecrets, generatePackage } from '../release/empacotar-fonte.mjs'
const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
let ts
try { ts = require('typescript') } catch { throw new Error('Instale as dependencias com npm ci antes da auditoria R06.') }
let checks = 0
for (const [round, script] of [
  ['R01', 'test-security-round1.mjs'],
  ['R02', 'test-round2-guards.mjs'],
  ['R03', 'test-round3-db-gates.mjs'],
  ['R04', 'test-round4-ui.mjs'],
  ['Engine', 'test-engine-result-r11.mjs'],
  ['R05', 'test-round5-integrations.mjs'],
]) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/testes', script)], {
    cwd: ROOT, env: process.env, encoding: 'utf8', timeout: 30000,
  })
  assert.equal(result.status, 0, `${round} falhou: ${result.error?.message || result.stderr || result.stdout}`)
  console.log(`PASS ${round}: regressao`); checks++
}
let parsed = 0, jsonCount = 0
const extensions = /\.(?:tsx?|jsx?|mts|cts)$/i
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'relatorios-testes', 'test-results', '.git', 'dist', '.expo'].includes(entry.name)) continue
      visit(name)
    } else if (entry.isFile()) {
      if (extensions.test(entry.name)) {
        const kind = /\.tsx$/i.test(entry.name) ? ts.ScriptKind.TSX : /\.jsx$/i.test(entry.name) ? ts.ScriptKind.JSX : ts.ScriptKind.TS
        const source = ts.createSourceFile(name, fs.readFileSync(name, 'utf8'), ts.ScriptTarget.Latest, true, kind)
        assert.equal(source.parseDiagnostics.length, 0, `Erro de parsing em ${path.relative(ROOT, name)}: ${source.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`)
        parsed++
      } else if (entry.name.endsWith('.json') && !name.split(path.sep).includes('.auth')) {
        JSON.parse(fs.readFileSync(name, 'utf8')); jsonCount++
      }
    }
  }
}
visit(ROOT)
assert.ok(parsed >= 1000 && jsonCount >= 25, 'Inventario de fontes inesperadamente reduzido')
console.log(`PASS parsing: ${parsed} arquivos TS/JS/JSX/TSX e ${jsonCount} JSON`); checks++
for (const filename of [
  'tests-e2e/.auth/admin.json', 'tests-e2e/.auth/produtora.json',
  'supabase/.temp/linked-project.json', 'database/supabase/.temp/linked-project.json',
  '.env', '.env.local', 'web/.env.local', 'desktop/dist/installer.exe',
  'node_modules/typescript/index.js', '.git/config',
]) assert.equal(shouldPackage(filename), false, `${filename} nao pode ir ao ZIP`)
for (const filename of ['README.md','package-lock.json','web/package.json','web/.env.example','.env.e2e.example']) {
  assert.equal(shouldPackage(filename), true, `${filename} deve ser preservado`)
}
assert.throws(() => assertNoSessionSecrets('simulado.json', Buffer.from('"refresh_token":"token-de-teste-comprido-nao-real"')), /credencial/)
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/quality.yml'), 'utf8')
assert.match(pkg.scripts['test:rounds'], /test-round6-release\.mjs/)
assert.match(workflow, /npm run test:rounds/)
console.log('PASS pacote: sessao, tokens, ambientes privados excluidos; pipeline CI cobre R01-R06'); checks++
const summary = generatePackage(path.join(ROOT, '..', 'R06-dry-run.zip'), { dryRun: true })
assert.ok(summary.included > 1500)
console.log(`PASS dry-run ZIP: ${summary.included} arquivos permitidos, ${summary.omitted} itens bloqueados`); checks++
console.log(`R06: ${checks} grupos de verificacao aprovados. Build/Next, PostgreSQL e visual E2E nao executados.`)
