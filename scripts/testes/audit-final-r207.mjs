import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')

const audits = [
  ['R190', 'audit-layout-pages.mjs', 'rotas e subáreas críticas'],
  ['R191', 'audit-layout-campeonatos.mjs', 'módulo Campeonatos'],
  ['R196', 'audit-ui-foundation.mjs', 'fundação UI'],
  ['R197', 'audit-championship-card.mjs', 'ChampionshipCard global'],
  ['R198', 'audit-entity-components.mjs', 'entidades compartilhadas'],
  ['R199', 'audit-workspace-components.mjs', 'workspaces compartilhados'],
  ['R199.1', 'audit-shell-overflow.mjs', 'shell sem overflow'],
  ['R200', 'audit-form-foundation.mjs', 'fundação de formulários'],
  ['R201', 'audit-form-migration.mjs', 'migração dos controles'],
  ['R201.3', 'audit-admin-home-integration.mjs', 'Admin > Página inicial'],
  ['R202', 'audit-data-display.mjs', 'tabelas e listas'],
  ['R203', 'audit-feedback-system.mjs', 'feedback global'],
  ['R204', 'audit-commerce-integration.mjs', 'commerce integrado'],
  ['R205', 'audit-token-flows.mjs', 'fluxos por token'],
  ['R206', 'audit-structural-cleanup.mjs', 'limpeza estrutural'],
]

const failures = []
console.log('AUDITORIA FINAL R207 — arquitetura compartilhada DropZone')
console.log(`Executando ${audits.length} auditorias acumuladas.\n`)

for (const [round, file, label] of audits) {
  const target = path.join(HERE, file)
  console.log(`===== ${round} — ${label} =====`)
  const result = spawnSync(process.execPath, [target], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.status !== 0) {
    failures.push(`${round} — ${label}`)
    console.error(`FALHA: ${round} terminou com código ${result.status ?? 'desconhecido'}.\n`)
  } else {
    console.log(`OK FINAL: ${round} — ${label}\n`)
  }
}

if (failures.length) {
  console.error('R207 NÃO FECHADA.')
  console.error(`Falharam ${failures.length}/${audits.length} auditorias:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`OK: R207 estática íntegra. ${audits.length}/${audits.length} auditorias acumuladas passaram.`)
console.log('Próximo passo obrigatório: typecheck + lint + build + audit:dropzone + Playwright R207 desktop/mobile.')
