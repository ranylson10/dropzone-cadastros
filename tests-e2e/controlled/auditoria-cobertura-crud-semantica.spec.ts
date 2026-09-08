import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const modulePath = path.join(root, 'scripts/testes/modulos/13-cobertura-crud.mjs')
const reportPath = path.join(root, 'relatorios-testes/matriz-cobertura-crud.json')

test('auditoria CRUD separa ações, tokens e recursos imutáveis de cadastros incompletos', async () => {
  const auditModule = await import(pathToFileURL(modulePath).href)
  await auditModule.executar()

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  expect(report.priority).toEqual([])

  const byFamily = new Map(report.families.map((item: any) => [item.family, item]))
  expect(byFamily.get('api/admin/garena')?.actionOnly).toBe(true)
  expect(byFamily.get('api/desktop/campeonatos/[id]/partidas/[id]')?.actionOnly).toBe(true)
  expect(byFamily.get('api/equipes/reivindicacao/[id]')?.tokenWorkflow).toBe(true)
  expect(byFamily.get('api/vendas/[id]')?.tokenWorkflow).toBe(true)
  expect(byFamily.get('api/me/commerce/wishlist')?.immutable).toBe(true)
  expect(byFamily.get('api/vendedores/[id]/vendas')?.immutable).toBe(true)
})
