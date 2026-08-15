import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../..')
const routePath = path.join(repoRoot, 'web/app/api/equipe/treinos/route.ts')

function readRoute() {
  return fs.readFileSync(routePath, 'utf8')
}

test('treinos nao consulta colunas de data inexistentes em campeonatos', async () => {
  const source = readRoute()
  expect(source).toContain(".select('id,nome,tipo,logo_url,status,created_at')")
  expect(source).not.toContain("status,data_inicio,data_fim")
  expect(source).not.toContain('campeonato?.data_inicio')
  expect(source).not.toContain('campeonato?.data_fim')
})

test('treinos ordena campeonatos pelo created_at existente', async () => {
  const source = readRoute()
  expect(source).toContain('b.created_at || b.nome')
  expect(source).toContain('a.created_at || a.nome')
})
