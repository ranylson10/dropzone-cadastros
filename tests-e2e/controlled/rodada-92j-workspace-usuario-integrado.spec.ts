import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const home = fs.readFileSync(path.join(root, 'web/features/dropzone/DropZoneHome.tsx'), 'utf8')
const panel = fs.readFileSync(path.join(root, 'web/features/dropzone/panels/produtora/ProdutoraPanel.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('92J - cabeçalho da conta usa hero integrado com avatar', async () => {
  expect(home).toContain('account-workspace-hero')
  expect(home).toContain('account-workspace-avatar')
  expect(home).toContain("dataText(account, 'logo_url') || dataText(account, 'avatar_url')")
  expect(css).toContain('.panel-workspace-shell .account-workspace-hero')
})

test('92J - workspace fica colado abaixo da barra superior', async () => {
  expect(css).toContain('.page-authenticated:has(.panel-workspace-shell)')
  expect(css).toContain('padding-top:64px')
  expect(css).toContain('> .shell.panel-workspace-shell')
  expect(css).toContain('max-width:none')
})

test('92J - todas as ferramentas ficam expostas na barra sem menu mais ferramentas', async () => {
  expect(panel).toContain('champ-subtabs-all')
  expect(panel).toContain('{producerTabs')
  expect(panel).not.toContain('<summary>Mais ferramentas</summary>')
  expect(panel).not.toContain('As ferramentas avançadas continuam em “Mais ferramentas”.')
  expect(panel).toContain('Use as abas acima para acessar todas as ferramentas do campeonato.')
})

test('92J - calls continua aparecendo somente em x-treino', async () => {
  expect(panel).toContain("item.id !== 'calls' || String(dataText(props.selectedChamp, 'tipo')).toLowerCase() === 'xtreino'")
})
