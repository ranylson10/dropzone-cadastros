import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test('rodada 85L preserva histórico completo e filtros operacionais', async () => {
  const api = read('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
  const ui = read('web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx')
  expect(api).toContain("limit(500)")
  expect(api).toContain('alterado_por_nome')
  expect(ui).toContain('Histórico e logs das escolhas')
  expect(ui).toContain('exportChoiceHistoryCsv')
  expect(ui).toContain('choiceHistoryFilter')
  expect(ui).toContain('Anterior:')
  expect(ui).toContain('Responsável:')
})
