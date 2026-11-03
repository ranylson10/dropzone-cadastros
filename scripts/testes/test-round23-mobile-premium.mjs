// Mobile contracts follow the active identity, including intentional menu redesigns.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript'), postcss = require('postcss')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const css = read('web/styles/dropzone-identity.css')
const ast = postcss.parse(css)
const publicHeader = read('web/components/layout/StorefrontHeader.tsx')
const privateHeader = read('web/components/layout/AppHeader.tsx')
const focus = read('web/components/workspace/WorkspaceFocus.tsx')
const layout = read('web/app/layout.tsx')
const rules = [], media = []
ast.walkRules(rule => rules.push(rule))
ast.walkAtRules('media', rule => media.push(rule.params))
let count = 0
function ok(name, value) { assert.ok(value, name); count++ }
function declared(selector, property, value) {
  return rules.some(rule => rule.selector.includes(selector) && rule.nodes.some(node => node.type === 'decl' && node.prop === property && (value === undefined || node.value.includes(value))))
}

for (const file of ['web/components/layout/StorefrontHeader.tsx', 'web/components/layout/AppHeader.tsx', 'web/components/workspace/WorkspaceFocus.tsx', 'web/app/layout.tsx']) {
  ok(`TSX válido: ${file}`, ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length === 0)
}
ok('Identidade ativa carregada após o workspace', layout.indexOf('dropzone-identity.css') > layout.indexOf('workspace-r22.css'))
ok('Tema mobile paralelo retirado', !layout.includes('arena-motion-r23.css') && !layout.includes('mobile-ui.css'))
for (const label of ['Início', 'Campeonatos', 'Equipes', 'Jogadores']) ok(`Destino direto: ${label}`, publicHeader.includes(`label: '${label}'`) && privateHeader.includes(`<span>${label}</span>`))
ok('Menu público é diálogo acessível', publicHeader.includes('role="dialog" aria-modal="true" aria-label="Menu completo do DropZone"'))
ok('Menu público contém foco', publicHeader.includes('useDisclosureFocus(mobileOpen, () => setMobileOpen(false), true, true)'))
ok('Menu privado contém foco', privateHeader.includes('useDisclosureFocus<HTMLElement>(mobileOpen, () => setMobileOpen(false), true, true)'))
ok('Fechamento público restaura foco', publicHeader.includes('mobilePopup.close(true)'))
ok('Fechamento privado restaura foco', privateHeader.includes('mobilePopup.close(true)'))
ok('Busca do menu preservada', publicHeader.includes('<Form action="/campeonatos" role="search"'))
ok('Destinos secundários preservados', publicHeader.includes('SECONDARY_NAV.map'))
ok('Minha área preservada', publicHeader.includes('className="dz-menu-account-entry"') && publicHeader.includes('href={profileHref}'))
ok('Lili disponível no menu', publicHeader.includes("{ label: 'Lili', href: '/lili'"))
ok('Menu com posição fixa', declared('.store-home-mobile-menu', 'position', 'fixed'))
ok('Menu limitado pela tela', declared('.store-home-mobile-menu', 'max-height', '100dvh'))
ok('Rolagem contida no menu', declared('.store-home-mobile-menu', 'overscroll-behavior', 'contain'))
ok('Área de toque para fechar', declared('.dz-public-menu-heading > button', 'height', '44px'))
ok('Links com área de toque', declared('.store-home-mobile-menu nav a', 'min-height', '48px'))
ok('Menu usa superfície compartilhada', declared('.store-home-mobile-menu', 'background', 'var(--dz-paper)'))
ok('Menu usa texto compartilhado', declared('.store-home-mobile-menu', 'color', 'var(--dz-ink)'))
ok('Dock permanece até tablet', media.some(query => query.includes('max-width:1023px')))
ok('Dock fixo com cinco destinos', declared('.dz-public-bottom-nav', 'position', 'fixed') && declared('.dz-public-bottom-nav', 'grid-template-columns', 'repeat(5'))
ok('Safe area preservada', css.includes('env(safe-area-inset-bottom)'))
ok('Foco visível compartilhado', declared(':focus-visible', 'outline', 'var(--dz-rust)'))
ok('Movimento reduzido respeitado', media.some(query => query.includes('prefers-reduced-motion:reduce')) && css.includes('animation: none !important'))
ok('Movimento de hover condicionado', media.some(query => query.includes('prefers-reduced-motion:no-preference')))
ok('Listas têm densidade compartilhada', css.includes('--dz-list-row-h: 54px') && css.includes('min-height:var(--dz-list-row-h)'))
ok('Listas alternam superfície', declared('[data-dz-list-item]:nth-child(even)', 'background', 'var(--dz-list-stripe)'))
ok('Ações principais continuam limitadas a três', focus.includes('actions.slice(0, 3)'))
ok('Ações respeitam disponibilidade', focus.includes('action.href && !action.disabled') && focus.includes('onClick={action.onClick}'))
ok('Links das ações usam navegação Next', focus.includes("import Link from 'next/link'") && focus.includes('<Link key={action.id}'))
ok('Menu não grava dados de negócio', !publicHeader.includes('supabase.from(') && !focus.includes('supabase.from('))
console.log(`R23/Circuito: ${count} contratos estáticos aprovados. Renderização, contraste e teclado são verificados separadamente por E2E.`)
