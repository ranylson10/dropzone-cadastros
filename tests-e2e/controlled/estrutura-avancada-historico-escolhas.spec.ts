import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test('preserva histórico limitado paginado e filtros operacionais', async () => {
  const api = read('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
  const loader = read('backend/src/campeonatos/advanced-structure-read.ts')
  const ui = read('web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx')
  expect(api).toContain('loadAdvancedStructure(id)')
  expect(loader).toContain('readLimitedRows<Row>')
  expect(loader).toContain('), 500)')
  expect(loader).toContain('alterado_por_nome')
  expect(ui).toContain('Histórico e logs das escolhas')
  expect(ui).toContain('exportChoiceHistoryCsv')
  expect(ui).toContain('choiceHistoryFilter')
  expect(ui).toContain('Anterior:')
  expect(ui).toContain('Responsável:')
})
