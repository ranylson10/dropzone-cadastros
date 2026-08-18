import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

test('busca de equipe no modal ocupa a largura sem faixa clara vazia', async () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.staff-search-results{ display: grid; grid-template-columns: 1fr; gap: 6px;')
  expect(css).toContain('background: transparent; box-shadow: none;')
  expect(css).toContain('.staff-search-card{ width: 100%; min-width: 0;')
})

test('seleção da equipe usa o destaque visual do sistema', async () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.staff-search-card.selected{ border-color: var(--ui-accent,var(--brand)); background: rgba(201,183,102,.10);')
  expect(css).toContain('box-shadow: inset 2px 0 0 var(--ui-accent,var(--brand));')
  expect(css).not.toContain('.staff-search-card.selected{ border-color: #12b76a; background: #e8f7ee;')
})

test('linha de busca permanece responsiva e sem estourar o modal', async () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.staff-search-row{ display: grid; grid-template-columns: minmax(0,1fr) auto;')
  expect(css).toContain('.staff-search-row input{ min-width: 0;')
})
