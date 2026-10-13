/** Static safety test for DropZone UI rounds R01+R02. No DB or network access. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import postcss from 'postcss'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const header = read('web/components/layout/StorefrontHeader.tsx')
const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const tokens = read('web/styles/dz-layout-tokens.css')
const navigation = read('web/components/layout/storefront-header.css')
const density = read('web/features/home/home-density-v1.css')
const rootLayout = read('web/app/layout.tsx')
const check = (name, result) => { if (!result) throw Error(`FAIL: ${name}`); console.log(`PASS: ${name}`) }

for (const filename of ['web/components/layout/StorefrontHeader.tsx', 'web/features/home/AuthenticatedHomeFeed.tsx', 'web/app/layout.tsx']) {
  const content = read(filename)
  const result = ts.transpileModule(content, { fileName: filename, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } })
  const errors = (result.diagnostics || []).filter((entry) => entry.category === ts.DiagnosticCategory.Error)
  check(`JSX/TS sintaticamente válido: ${filename}`, errors.length === 0)
}
for (const [label, css] of [['tokens',tokens],['header',navigation],['home',density]]) {
  postcss.parse(css)
  check(`CSS válido: ${label}`, true)
}
check('Sidebar restrita a rotas de exploração', header.includes('isDiscoveryPage(pathname)') && header.includes('pathname === \'/\'') && header.includes('campeonatos|equipes|jogadores|produtoras|managers'))
check('Rotas operacionais preservadas', !header.includes("pathname.includes('/pontuador')") && !header.includes("pathname.includes('/broadcast')"))
check('Layout responsivo e rodapé mobile', navigation.includes('.dz-public-bottom-nav') && navigation.includes('@media (max-width: 1023px)'))
check('Sidebar expansível e preferência persistida', header.includes('dz_discovery_sidebar_collapsed') && navigation.includes('data-collapsed="true"'))
check('Busca funcional usa rota existente', header.includes('action="/campeonatos"'))
check('Acesso a painel autenticado preservado', header.includes('onAccountClick') && header.includes('profileHref'))
check('Nenhum novo MAIN duplicado na home', !/<main[\s>]/.test(home) && home.includes('className="store-home-body"'))
check('Tokens adicionados à raiz', rootLayout.includes("import '@/styles/dz-layout-tokens.css'"))
check('Home importa novo layout, sem alterar API', home.includes("import './home-density-v1.css'") && home.includes("fetch('/api/vagas'") && home.includes("fetch('/api/site/home'"))
check('Card existente reutilizado', home.includes('<ChampionshipCard') && density.includes('.dz-champ-card'))
console.log('\nAuditoria UI R01/R02: aprovada (inspeção estática).')
