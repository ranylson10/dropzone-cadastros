import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const postcss = require('postcss')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const exists = name => fs.existsSync(path.join(root, name))
const hook = read('web/components/ui/useDisclosureFocus.ts')
const helper = read('web/components/ui/sheet-tab-order.ts')
const publicHeader = read('web/components/layout/StorefrontHeader.tsx')
const privateHeader = read('web/components/layout/AppHeader.tsx')
const focus = read('web/components/workspace/WorkspaceFocus.tsx')
const css = read('web/styles/redesign-qa-r24.css')
const layout = read('web/app/layout.tsx')
const pkg = JSON.parse(read('package.json'))
const workflow = read('.github/workflows/quality.yml')
const ast = postcss.parse(css, { from: 'redesign-qa-r24.css' })
let count = 0
function ok(name, test) { assert.ok(test, name); count++ }
for (const name of [
  'web/components/ui/sheet-tab-order.ts',
  'web/components/ui/useDisclosureFocus.ts',
  'web/components/layout/StorefrontHeader.tsx',
  'web/components/layout/AppHeader.tsx',
  'web/components/workspace/WorkspaceFocus.tsx',
  'web/app/layout.tsx',
]) {
  const kind = name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const tree = ts.createSourceFile(name, read(name), ts.ScriptTarget.Latest, true, kind)
  ok(`Sintaxe válida: ${name}`, tree.parseDiagnostics.length === 0)
}
ok('PostCSS: folha de QA processável', ast.nodes.length > 0)
ok('R24 carregado após as melhorias anteriores', layout.indexOf('redesign-qa-r24.css') > layout.indexOf('arena-motion-r23.css'))
ok('Trapa Tab opcional: popovers antigos não mudam', hook.includes('trapTab = false'))
ok('Tab com wrap usando helper testável', hook.includes('nextSheetTabTarget(controls'))
ok('Teclado Shift+Tab encaminhado', hook.includes('event.shiftKey'))
ok('Escape continua fechando', hook.includes("event.key !== 'Escape'"))
ok('Foco fora volta ao painel móvel', hook.includes('if (trapTab) focusDialog(panel)'))
ok('Scrim público restaura foco', publicHeader.includes('aria-label="Fechar menu de navegação" onClick={() => mobilePopup.close(true)}'))
ok('Scrim privado restaura foco', privateHeader.includes('aria-label="Fechar navegação"') && privateHeader.includes('onClick={() => mobilePopup.close(true)}'))
ok('Ambos usam contenção só para menu móvel', publicHeader.includes('useDisclosureFocus(mobileOpen, () => setMobileOpen(false), true, true)') && privateHeader.includes('useDisclosureFocus<HTMLElement>(mobileOpen, () => setMobileOpen(false), true, true)'))
ok('Menu público suporta foco de fallback', publicHeader.includes('className="store-home-mobile-menu" tabIndex={-1}'))
ok('Menu privado suporta foco de fallback', privateHeader.includes('tabIndex={-1} aria-label="Navegação principal"'))
const panelSwitcher = read('web/components/workspace/WorkspacePanelSwitcher.tsx')
ok('Seletor inferior preserva foco antes de abrir', panelSwitcher.includes('event.currentTarget.focus({ preventScroll: true })'))
ok('Dock público abre seletor próprio com estado acessível', publicHeader.includes('<WorkspacePanelSwitcher') && panelSwitcher.includes('aria-expanded={open}'))
ok('Dock privado abre o mesmo seletor de painéis', privateHeader.includes('<WorkspacePanelSwitcher') && panelSwitcher.includes('aria-label="Abrir meus painéis"'))
ok('Ações principais preservadas', focus.includes('actions.slice(0, 3)'))
ok('Navegação privada mantém seus 4 destinos', ['/campeonatos','/equipes','/jogadores'].every(href=>privateHeader.includes(`href="${href}"`)))
ok('Navegação pública mantém seus 4 destinos', ['Campeonatos','Equipes','Jogadores'].every(label => publicHeader.includes(`label: '${label}'`)))
// Verificação funcional do algoritmo de Tab, compilado e executado sem navegador.
const js = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const module = { exports: {} }; vm.runInNewContext(js, { module, exports: module.exports })
const { nextSheetTabTarget } = module.exports
const controls = ['primeiro','meio','ultimo']
for (const [name, current, shift, inside, result] of [
  ['Tab normal não interfere', 'primeiro', false, true, null],
  ['Tab no meio avança normalmente', 'meio', false, true, null],
  ['Tab no último volta ao primeiro', 'ultimo', false, true, 'primeiro'],
  ['Shift+Tab no primeiro volta ao último', 'primeiro', true, true, 'ultimo'],
  ['Shift+Tab no meio volta normalmente', 'meio', true, true, null],
  ['Entrada externa de Tab leva ao primeiro', 'externo', false, false, 'primeiro'],
  ['Entrada externa de Shift+Tab leva ao último', 'externo', true, false, 'ultimo'],
  ['Foco inicial no painel vai ao primeiro', null, false, false, 'primeiro'],
  ['Foco inicial no painel com Shift vai ao último', null, true, false, 'ultimo'],
]) ok(name, nextSheetTabTarget(controls, current, shift, inside) === result)
ok('Painel vazio retorna null sem travar evento', nextSheetTabTarget([], null, false, false) === null)
ok('Painel com um único botão cicla para si', nextSheetTabTarget(['unico'], 'unico', false, true) === 'unico')
const media = []
const rules = []
ast.walkAtRules('media', rule => media.push(rule.params))
ast.walkRules(rule => rules.push(rule))
function hasDecl(sel, prop, value) {
  return rules.some(r=>r.selector.includes(sel) && r.nodes.some(n=>n.type==='decl' && n.prop===prop && (value===undefined || n.value.includes(value))))
}
ok('Breakpoints de celular e telefone compacto', media.some(x=>x.includes('max-width:900px')) && media.some(x=>x.includes('max-width:380px')))
ok('Menu rolável no celular', hasDecl('.app-header .app-main-nav.is-open','touch-action','pan-y'))
ok('Área de toque mínima em fechar menu público', hasDecl('.store-home-header .dz-public-menu-heading > button','min-height','44px'))
ok('Navegação de 5 destinos sem overflow', hasDecl('.dz-public-bottom-nav :is(a,button)','max-width','100%'))
ok('Rótulos não estouram a dock', hasDecl('.app-mobile-dock :is(a,button) span','text-overflow','ellipsis'))
ok('Rótulos não quebram em duas linhas', hasDecl('.app-mobile-dock :is(a,button) span','white-space','nowrap'))
ok('Conteúdo quebra palavras longas', hasDecl('.dz-focus__action-copy :is(strong,small)','overflow-wrap','anywhere'))
ok('Modo de movimento reduzido preservado', media.some(x=>x.includes('prefers-reduced-motion:reduce')))
// Regression from the 768px Playwright failure: dock persists to 1023px,
// so Lili must be hidden over exactly the same mobile/tablet interval.
const storeCss = read('web/components/layout/storefront-header.css')
const liliCss = read('web/styles/redesign-qa-r24.css')
const smoke = read('tests-e2e/public/rodada-24-mobile-ux.spec.ts')
ok('Dock público permanece até 1023px', storeCss.includes('@media (max-width: 1023px)') && storeCss.includes('.dz-public-bottom-nav { position: fixed'))
ok('Lili escondida em toda a largura do dock público', liliCss.includes('@media (max-width: 1023px)') && /body#dropzone-app\s+\.lili-global-launcher\.lili-mobile-in-menu\s*\{\s*display:\s*none\s*!important/.test(liliCss))
ok('Lili continua disponível no menu', publicHeader.includes("{ label: 'Lili', href: '/lili'"))
ok('E2E verifica a sobreposição da Lili', smoke.includes("page.locator('.lili-global-launcher.lili-mobile-in-menu')).toBeHidden()"))
ok('E2E tolera primeira compilação lenta no Windows', smoke.includes('test.setTimeout(120_000)') && smoke.includes('timeout: 90_000'))

ok('Sem alterações de API e SQL nas verificações', !hook.includes('supabase.') && !css.includes('url(https:'))
ok('Teste E2E público somente leitura', exists('tests-e2e/public/rodada-24-mobile-ux.spec.ts') && !read('tests-e2e/public/rodada-24-mobile-ux.spec.ts').includes('request.post('))
ok('BAT R24 presente', exists('TESTAR_RODADA_24.bat'))
ok('BAT E2E R24 presente', exists('HOMOLOGAR_MOBILE_R24.bat'))
ok('Script NPM presente', pkg.scripts['test:round24'] === 'node scripts/testes/test-round24-redesign-final.mjs')
ok('R24 incluída no CI', workflow.includes('npm run test:round24'))
ok('Checklist manual e limitações documentados', exists('docs/redesign/RODADA_24_HOMOLOGACAO_REDESIGN.md'))
console.log(`R24: ${count} verificações aprovadas (contratos + algoritmo de navegação por teclado). Build completo, E2E e homologação com perfis reais são provas separadas.`)
