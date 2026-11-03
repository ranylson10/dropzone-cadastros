// R13: invariantes de release verificaveis sem rede, credenciais ou banco.
// NAO substitui build Next.js, Postgres nativo, Playwright ou homologacao.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { shouldPackage, assertNoSessionSecrets } from '../release/empacotar-fonte.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const json = rel => JSON.parse(read(rel))
let checks = 0
const check = (name, assertion) => { assertion(); checks++; console.log(`PASS R13: ${name}`) }
const pkg = json('package.json')
const web = json('web/package.json')
const lock = json('package-lock.json')
const baseline = json('docs/RODADA_03_SNAPSHOT_PUBLICO.json')
const config = read('web/.env.example')
const migrations = fs.readdirSync(path.join(ROOT, 'supabase/migrations'))
  .filter(x => /^\d{14}_.+\.sql$/.test(x)).map(x => x.slice(0, -4)).sort()
const candidates = [
  'docs/sql/20261011_atomic_enrollment_candidate.sql',
  'docs/sql/20261011_rejoin_index_candidate.sql',
  'docs/sql/20261011_group_choice_candidate.sql',
  'docs/sql/20261011_slot_transfer_candidate.sql',
  'docs/sql/20261026_round10_lili_writer_candidate.sql',
  'docs/sql/20261026_round10_block_writer_candidate.sql',
  'docs/sql/20261026_round11_invite_writer_candidate.sql',
  'docs/sql/20261026_round11_scoped_expiry_candidate.sql',
]
check('Migrations automáticas correspondem ao snapshot de produção conhecido', () => {
  assert.deepEqual(migrations, baseline.applied_migrations.toSorted())
})
check('Nenhum SQL candidato foi promovido automaticamente a migrations', () => {
  for (const file of candidates) {
    assert.ok(fs.statSync(path.join(ROOT, file)).isFile(), file)
    assert.equal(migrations.some(name => file.includes(name)), false, file)
  }
  assert.ok(migrations.every(name => !name.includes('round10') && !name.includes('round11')))
})
check('Nenhum modo transacional foi ativado no modelo de configuração', () => {
  const flags = [...config.matchAll(/^([A-Z0-9_]+_(?:WRITE_)?MODE|INVITE_ENROLLMENT_MODE)=(.+)$/gm)]
  assert.ok(flags.length >= 8, 'Flags esperadas ausentes do modelo web')
  for (const [, key, value] of flags) assert.equal(value, 'legacy', `${key} nao pode vir ligado`)
})
check('Travas de SQL mantêm prontidão false mesmo com índices presentes', () => {
  for (const name of ['docs/sql/20261026_round10_readiness_readonly.sql', 'docs/sql/20261026_round11_readiness_readonly.sql']) {
    assert.match(read(name), /'ready_to_enable'\s*,\s*false/i, name)
    assert.match(read(name), /\bread only\b/i, name)
  }
})
check('Dependências críticas coerentes com o lockfile', () => {
  for (const name of ['next', 'typescript', 'react']) {
    const expected = web.dependencies?.[name] || web.devDependencies?.[name]
    assert.ok(expected, name)
    assert.equal(lock.packages[`node_modules/${name}`]?.version, expected, name)
  }
  assert.equal(lock.packages.web.dependencies.next, web.dependencies.next)
})
check('Pipeline realiza build de compilação e as regressões anteriores', () => {
  const workflow = read('.github/workflows/quality.yml')
  assert.match(workflow, /npm run test:rounds/)
  assert.match(workflow, /npm run typecheck/)
  assert.match(workflow, /npm run lint/)
  assert.match(workflow, /experimental-build-mode compile/)
  assert.match(workflow, /npm run test:round13/)
})
check('Pipeline nao diz executar teste PostgreSQL nativo sem laboratório', () => {
  assert.doesNotMatch(read('.github/workflows/quality.yml'), /validate-native\.mjs/)
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/testes/postgres-inscricoes/validate-native.mjs')))
})
check('Arquivos de sessão e configs privadas são bloqueados na exportação', () => {
  for (const filename of ['tests-e2e/.auth/admin.json', 'web/.env.local', '.env', 'node_modules/typescript/index.js']) {
    assert.equal(shouldPackage(filename), false, filename)
  }
  assert.throws(() => assertNoSessionSecrets('credentials.json', Buffer.from('{"refresh_token":"faketoken123456789000000"}')), /credencial/)
})
check('R13 distingue os testes offline de homologação real', () => {
  const doc = read('docs/RODADA_13_HOMOLOGACAO_2026-10-26.md')
  for (const phrase of ['npm ci', 'PostgreSQL', 'build', 'produção', 'bloqueada']) {
    assert.ok(doc.includes(phrase), phrase)
  }
})
console.log(`R13: ${checks} grupos de verificações estáticas aprovados. Não autoriza implantação.`)
