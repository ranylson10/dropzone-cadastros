import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('89A mantém Transmissão como aba principal do campeonato', () => {
  const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
  const tabs = read('web/features/dropzone/panels/produtora/producer-tabs.ts')
  expect(panel).toContain("const mainTabs: ProducerTab[] = ['visao', 'equipes', 'grupos', 'jogos', 'estatisticas', 'stream']")
  expect(tabs).toContain("id: 'stream'")
  expect(tabs).toContain("label: 'Transmissão'")
})

test('89A não deixa Transmissão dependente de Mais ferramentas', () => {
  const panel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
  expect(panel).toContain('producerTabs.filter((item) => mainTabs.includes(item.id))')
  expect(panel).toContain('!mainTabs.includes(item.id)')
})

test('89A menu secundário tem rolagem própria e limite de altura', () => {
  const css = read('web/app/globals.css')
  expect(css).toContain('max-height:min(62vh,420px)')
  expect(css).toContain('overflow-y:auto')
  expect(css).toContain('overscroll-behavior:contain')
})
