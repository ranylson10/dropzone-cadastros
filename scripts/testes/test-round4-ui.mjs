import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Contratos estáticos: sem rede, login, SDK Supabase ou alteração de dados.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8')
const header = read('web/components/layout/AppHeader.tsx')
const publicHeader = read('web/components/layout/StorefrontHeader.tsx')
const headerCSS = read('web/components/layout/storefront-header.css')
const globals = read('web/app/globals.css')
const admin = read('web/app/admin/page.tsx')
const wallet = read('web/features/billing/WalletPanel.tsx')
const team = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
const home = read('web/features/dropzone/DropZoneHome.tsx')
let count = 0
function check(label, fn) {
  fn()
  console.log('PASS', label)
  count++
}

check('Equipe: quick-action Minha equipe opens team dashboard', () => {
  assert.match(header, /label: 'Minha equipe'[^\n]+section=dashboard/)
  assert.match(team, /section === 'dashboard'/)
})
check('Equipe: old incorrect competition target removed from Minha equipe', () => {
  assert.doesNotMatch(header, /label: 'Minha equipe'[^\n]+section=campeonatos/)
})
check('Equipe mobile dock activates on team directory and detail routes', () => {
  assert.match(header, /pathname === '\/equipes' \|\| pathname\?\.startsWith\('\/equipes\/'\)/)
})
check('Equipe panel still has its original competition subarea', () => {
  assert.match(team, /section === 'campeonatos'/)
  assert.match(team, /id: 'campeonatos', label: 'Competições'/)
})
check('My area account menu uses callback when supplied', () => {
  assert.match(publicHeader, /onAccountClick \? \(\s*<button[^>]+onClick=\{\(\) => \{ setAccountOpen\(false\); onAccountClick\(\) \}\}/)
})
check('My area falls back to link on internal public pages', () => {
  assert.match(publicHeader, /<Link href="\/\?painel=1" onClick=\{\(\) => setAccountOpen\(false\)\}>/)
  assert.match(home, /if \(next === 'panel'\) url\.searchParams\.set\('painel', '1'\)/)
})
check('Fallback account link uses same dimensions and hover as buttons', () => {
  assert.match(headerCSS, /\.store-home-account-menu > :is\(button,a\) \{[^}]+display: flex/)
  assert.match(headerCSS, /\.store-home-account-menu > :is\(button,a\):hover/)
})
check('Table cells remain native table-cell boxes', () => {
  assert.match(globals, /\.admin-table-wrap td:first-child\{ display: table-cell; vertical-align: middle/)
  assert.doesNotMatch(globals, /\.admin-table-wrap td:first-child\s*\{\s*display:\s*flex/)
})
check('Strong + small inside first cell remain stacked without changing td display', () => {
  assert.match(globals, /\.admin-table-wrap td:first-child > :is\(strong,small\)\{ display: block/)
})
check('Admin tables use accessible keyboard-scroll viewports', () => {
  assert.equal((admin.match(/<DataTableViewport className="admin-table-wrap" aria-label=/g) || []).length, 3)
  assert.equal((admin.match(/<\/DataTableViewport>/g) || []).length, 3)
})
check('Admin table wrappers preserve all existing tables', () => {
  assert.equal((admin.match(/<DataTable>/g) || []).length, 3)
  for (const label of ['Lista de produtoras', 'Tabela de preços do sistema', 'Moderação de contas']) {
    assert.ok(admin.includes(`aria-label="${label}"`), label)
  }
})
check('Admin account search has accessible label', () => {
  assert.match(admin, /aria-label="Pesquisar contas por nome, usuário ou tipo"/)
})
check('Wallet history uses an accessible keyboard-scroll viewport', () => {
  assert.match(wallet, /<DataTableViewport className="admin-table-wrap" aria-label="Histórico de movimentações da carteira">/)
  assert.equal((wallet.match(/<DataTableViewport/g) || []).length, (wallet.match(/<\/DataTableViewport>/g) || []).length)
})
check('Shared viewport supplies tabIndex 0 and region semantics', () => {
  const data = read('web/components/ui/DataTable.tsx')
  assert.match(data, /role="region"/)
  assert.match(data, /tabIndex=\{0\}/)
  const css = read('web/styles/data-display.css')
  assert.match(css, /\.dz-data-table-viewport\s*\{[^}]+overflow-x:\s*auto/s)
})
check('Round 1/2/3 regression scripts remain present', () => {
  for (const name of ['TESTAR_RODADA_01.bat','TESTAR_RODADA_02.bat','TESTAR_RODADA_03.bat']) {
    assert.ok(fs.existsSync(path.join(ROOT,name)))
  }
})
console.log(`Rodada 04: ${count} verificações estruturais aprovadas. Não são testes visuais E2E.`)
