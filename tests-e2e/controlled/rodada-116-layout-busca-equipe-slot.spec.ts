import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

test('busca de equipe no modal ocupa a largura sem faixa clara vazia', async () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.staff-search-results{ display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));')
  expect(css).toContain('.staff-search-results{ display: grid;')
  expect(css).toContain('.staff-search-card{ display: grid; gap: 2px;')
})

test('seleção da equipe usa o destaque visual do sistema', async () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.staff-search-card.selected{ border-color: #12b76a; background: #e8f7ee;')
  expect(css).toContain('body .page-authenticated:has(.team-dashboard) .team-dashboard .staff-search-card.selected{background:rgba(201,183,102,.12)')
})

test('linha de busca permanece responsiva e sem estourar o modal', async () => {
  const css = read('web/app/globals.css')

  expect(css).toContain('.staff-search-row{ display: flex; gap: 8px;')
  expect(css).toContain('.staff-search-row input{ flex: 1;')
})
