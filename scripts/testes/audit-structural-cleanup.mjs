import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name)
  return entry.isDirectory() ? walk(full) : [full]
})
const checks = []
const ok = (label, condition) => checks.push({ label, condition: Boolean(condition) })

const legacyNavTokens = [
  'team-primary-nav',
  'team-secondary-nav',
  'player-primary-nav',
  'producer-hub-nav-primary',
  'producer-hub-subnav',
  'manager-mode-nav',
  'manager-mode-chip',
  'manager-subnav',
]

const cssFiles = walk(path.join(root, 'web')).filter((file) => file.endsWith('.css'))
const cssSources = cssFiles.map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }))
const legacyNavHits = cssSources.flatMap(({ file, source }) => legacyNavTokens
  .filter((token) => source.includes(token))
  .map((token) => `${path.relative(root, file)}:${token}`))

ok('CSS antigo das navegações de workspace foi removido', legacyNavHits.length === 0)

const homeCss = read('web/features/home/authenticated-home.css')
ok('Home não mantém CSS do championship-poster-card legado', !homeCss.includes('championship-poster-card'))

const directoryLegacyHits = cssSources.flatMap(({ file, source }) => [...new Set(source.match(/\.directory-champ-[A-Za-z0-9_-]+/g) || [])]
  .filter((name) => name !== '.directory-champ-card-grid')
  .map((name) => `${path.relative(root, file)}:${name}`))
ok('CSS global mantém só o grid e remove estilos do card antigo', directoryLegacyHits.length === 0)

const directory = read('web/features/directory/components/DirectoryListClient.tsx')
ok('/campeonatos continua usando ChampionshipListRow canônico', directory.includes('<ChampionshipListRow'))
ok('/campeonatos não recriou card próprio', !directory.includes('<ChampionshipCard') && !directory.includes('className="directory-champ-card"'))

const workspace = read('web/components/workspace/WorkspaceShell.tsx')
const workspaceCss = read('web/styles/workspace.css')
ok('WorkspaceShell canônico permanece ativo', workspace.includes("'dz-workspace-nav'") && workspace.includes('<nav'))
ok('CSS canônico de workspace permanece ativo', workspaceCss.includes('.dz-workspace-nav{') && workspaceCss.includes('.dz-workspace-subnav{'))

const championshipCss = read('web/styles/championship-card.css')
ok('CSS canônico de ChampionshipCard permanece ativo', championshipCss.includes('.dz-champ-card{') && championshipCss.includes('.dz-champ-card-caption'))

const cascadeAudit = read('scripts/testes/modulos/14-css-cascata.mjs')
ok('baseline CSS não protege mais seletores do card legado', !cascadeAudit.includes("'.directory-market-page .directory-champ-card',") && !cascadeAudit.includes("'.directory-market-page .directory-champ-body',"))

console.log('Auditoria R206 — limpeza estrutural')
for (const check of checks) console.log(`${check.condition ? 'OK ' : 'ERRO'} ${check.label}`)
const failed = checks.filter((check) => !check.condition)
if (failed.length) {
  if (legacyNavHits.length) console.error(`Resíduos de navegação: ${legacyNavHits.join(', ')}`)
  if (directoryLegacyHits.length) console.error(`Resíduos de card: ${directoryLegacyHits.join(', ')}`)
  console.error(`ERRO: ${failed.length} verificação(ões) falharam.`)
  process.exit(1)
}
console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
