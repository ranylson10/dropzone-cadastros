import fs from 'node:fs'

const checks = []
function check(label, condition) {
  if (!condition) {
    console.error(`ERRO ${label}`)
    process.exitCode = 1
  } else {
    console.log(`OK  ${label}`)
  }
  checks.push(Boolean(condition))
}

const css = fs.readFileSync('web/app/header.css', 'utf8')
const entityCss = fs.readFileSync('web/styles/entity-components.css', 'utf8')
const profile = fs.readFileSync('web/features/directory/components/DirectoryProfilePage.tsx', 'utf8')

console.log('Auditoria R199.1 — shell desktop sem overflow')
check('sidebar desktop continua com 232px', /width:\s*232px/.test(css))
check('main autenticado desconta a sidebar', /width:\s*calc\(100%\s*-\s*232px\)/.test(css))
check('main autenticado limita max-width ao espaço restante', /max-width:\s*calc\(100%\s*-\s*232px\)/.test(css))
check('main autenticado permite encolher', /min-width:\s*0/.test(css))
check('main autenticado usa box-sizing border-box', /box-sizing:\s*border-box/.test(css))
check('marketplace reseta para largura total', /marketplace-shell-page\) \+ \.app-shell-main\.marketplace-shell-page\{width:100%;max-width:none;/.test(css))
check('entidades continuam com min-width zero', /\.dz-entity-profile-hero[\s\S]*min-width:\s*0/.test(entityCss))
check('perfil público continua usando EntityProfileHero', /<EntityProfileHero/.test(profile))

if (checks.every(Boolean)) {
  console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
} else {
  console.error(`FALHA: ${checks.filter(Boolean).length}/${checks.length} verificações passaram.`)
  process.exitCode = 1
}
