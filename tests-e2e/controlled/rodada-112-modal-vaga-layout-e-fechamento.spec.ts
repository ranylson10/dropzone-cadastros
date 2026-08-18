import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('modal fecha pelo X, backdrop e tecla Escape', () => {
  const source = read('web/features/billing/BuyVacancyModal.tsx')

  expect(source).toContain('const closeModal = useCallback(() => {')
  expect(source).toContain("if (event.key !== 'Escape') return")
  expect(source).toContain("window.addEventListener('keydown', onKeyDown)")
  expect(source).toContain('className="report-modal-backdrop vacancy-buy-backdrop"')
  expect(source).toContain('className="vacancy-buy-close"')
  expect(source).toContain('event.stopPropagation(); closeModal()')
})

test('rota vagas remove comprar da URL ao fechar e não reabre o modal', () => {
  const source = read('web/app/vagas/page.tsx')

  expect(source).toContain('function closeBuyModal()')
  expect(source).toContain("url.searchParams.delete('comprar')")
  expect(source).toContain("window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)")
  expect(source).toContain('onClose={closeBuyModal}')
})

test('modal usa superfícies escuras e tokens do sistema', () => {
  const css = read('web/app/vagas/vagas.css')

  expect(css).toContain('.vacancy-buy-modal{width:min(620px,100%);')
  expect(css).toContain('background:var(--ui-surface,var(--surface))')
  expect(css).toContain('.vacancy-buy-option-pix,.vacancy-buy-option-card,.vacancy-buy-option-paypal{border-color:var(--ui-line,var(--line));background:var(--ui-surface-raised,#191b20);box-shadow:none}')
  expect(css).not.toContain('linear-gradient(135deg,#f7fdf9 0%,#eefaf3 100%)')
})

test('contatos WhatsApp ficam em linhas simples sem cartões brancos', () => {
  const css = read('web/app/vagas/vagas.css')

  expect(css).toContain('.whatsapp-seller-list{display:grid;gap:0;border-top:1px solid var(--ui-line,var(--line))}')
  expect(css).toContain('background:transparent;color:var(--ui-text,var(--text));text-decoration:none')
  expect(css).toContain('.whatsapp-seller-wa-icon{display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;')
})
