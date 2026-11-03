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
const shell = fs.readFileSync('web/components/layout/AppShell.tsx', 'utf8')
const panel = fs.readFileSync('web/features/dropzone/DropZoneHome.tsx', 'utf8')
const directory = fs.readFileSync('web/features/directory/components/DirectoryPage.tsx', 'utf8')

console.log('Auditoria R199.1 — shell desktop sem overflow')
check('desktop mantém faixa superior de largura total', /\.app-header\s*\{\s*width:\s*100%;\s*height:\s*70px/.test(css))
check('main autenticado não reserva uma sidebar', /\.app-shell-main\.page-authenticated\s*\{[^}]*margin-left:\s*0/.test(css))
check('main autenticado utiliza toda a largura disponível', /\.app-shell-main\.page-authenticated\s*\{[^}]*width:\s*100%;\s*max-width:\s*none/.test(css))
check('main autenticado permite encolher', /min-width:\s*0/.test(css))
check('main autenticado usa box-sizing border-box', /box-sizing:\s*border-box/.test(css))
check('marketplace reseta para largura total', /marketplace-shell-page\) \+ \.app-shell-main\.marketplace-shell-page\{width:100%;max-width:none;/.test(css))
check('entidades continuam com min-width zero', /\.dz-entity-profile-hero[\s\S]*min-width:\s*0/.test(entityCss))
check('perfil público continua usando EntityProfileHero', /<EntityProfileHero/.test(profile))
check('painel e catálogo resolvem o mesmo cabeçalho pela navegação da plataforma', shell.includes("hasPublicDiscoveryNavigation(pathname) ? 'storefront' : headerVariant"))
check('painel e catálogo compartilham limite de conteúdo', panel.includes("workspaceMode === 'panel' ? PlatformPageBody") && directory.includes('<PlatformPageBody'))

if (checks.every(Boolean)) {
  console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
} else {
  console.error(`FALHA: ${checks.filter(Boolean).length}/${checks.length} verificações passaram.`)
  process.exitCode = 1
}
