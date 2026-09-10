import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('Home — token e pendências usam dados reais da conta', () => {
  const home = read('web/features/home/AuthenticatedHomeFeed.tsx')

  expect(home).toContain('/api/convites/resolver/')
  expect(home).toContain("fetch('/api/equipe/escalacoes'")
  expect(home).toContain("fetch('/api/notificacoes?limit=12'")
  expect(home).toContain('Completar escalação')
  expect(home).toContain('Próximas ações')
  expect(home).toContain('Tem token ou link?')
  expect(home).toContain('Token ou link de inscrição')
})
