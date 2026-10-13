import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(root, rel))
const checks = []
const ok = (label, condition) => checks.push({ label, condition: Boolean(condition) })

const files = [
  'web/components/entities/EntityAvatar.tsx',
  'web/components/entities/EntityListRow.tsx',
  'web/components/entities/EntityProfileHero.tsx',
  'web/components/entities/index.ts',
  'web/styles/entity-components.css',
]
for (const file of files) ok(`existe ${file}`, exists(file))

const avatar = read('web/components/entities/EntityAvatar.tsx')
const row = read('web/components/entities/EntityListRow.tsx')
const hero = read('web/components/entities/EntityProfileHero.tsx')
const directory = read('web/features/directory/components/DirectoryListClient.tsx')
const profile = read('web/features/directory/components/DirectoryProfilePage.tsx')
const layout = read('web/app/layout.tsx')

ok('EntityAvatar é compartilhado', avatar.includes('export function EntityAvatar') && avatar.includes('entityInitials'))
ok('EntityListRow usa EntityAvatar', row.includes('<EntityAvatar') && row.includes('data-entity-kind'))
ok('EntityProfileHero usa EntityAvatar', hero.includes('<EntityAvatar') && hero.includes('data-entity-profile-kind'))
ok('diretório usa EntityListRow', directory.includes('<EntityListRow'))
ok('diretório não desenha linha manualmente', !directory.includes('<a className={`directory-list-row directory-list-row-${item.kind}`}'))
ok('perfil usa EntityProfileHero', profile.includes('<EntityProfileHero'))
ok('perfil não desenha hero manualmente', !profile.includes('<section className={`profile-command-hero theme-${kind}`}'))
ok('CSS compartilhado carregado no layout', layout.includes("@/styles/entity-components.css"))

for (const kind of ['equipes', 'jogadores', 'produtoras', 'managers']) {
  const listPage = read(`web/app/${kind}/page.tsx`)
  const profilePage = read(`web/app/${kind}/[id]/page.tsx`)
  ok(`${kind}: lista usa DirectoryPage compartilhada`, listPage.includes('<DirectoryPage'))
  ok(`${kind}: perfil usa DirectoryProfilePage compartilhada`, profilePage.includes('<DirectoryProfilePage'))
}

console.log('Auditoria R198 — entidades compartilhadas')
for (const check of checks) console.log(`${check.condition ? 'OK ' : 'ERRO'} ${check.label}`)
const failed = checks.filter((check) => !check.condition)
if (failed.length) {
  console.error(`ERRO: ${failed.length} verificação(ões) falharam.`)
  process.exit(1)
}
console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
