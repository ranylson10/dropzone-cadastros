import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')

test('91F todos os blocos dependentes de jogo entram na regra dinâmica', async () => {
  expect(workspace).toContain("const GAME_DATA_BLOCK_TYPES = new Set<PostArtworkBlock['type']>(['table_day', 'qualified_teams', 'booyahs_day', 'mvp_day', 'kills_leaders'])")
  expect(workspace).toContain('function projectRequiresGame(project?: PostArtworkProject | null)')
  expect(workspace).toContain('GAME_DATA_BLOCK_TYPES.has(block.type)')
})

test('91F central não permite baixar arte dinâmica sem escolher o jogo', async () => {
  expect(workspace.split('disabled={exporting || (projectRequiresGame(item) && !generationGame)}').length - 1).toBeGreaterThanOrEqual(2)
  expect(workspace).toContain("projectRequiresGame(item) && !generationGame ? 'Selecione o jogo' : 'Baixar'")
})

test('91F preview principal também exige jogo antes da exportação', async () => {
  expect(workspace.split('disabled={exporting || (projectRequiresGame(draft) && !generationGame)}').length - 1).toBeGreaterThanOrEqual(2)
  expect(workspace).toContain("projectRequiresGame(draft) && !generationGame ? 'Selecione o jogo'")
})

test('91F aviso da central lista todos os dados atualizados pelo jogo', async () => {
  expect(workspace).toContain('Tabela do Jogo, Classificados, MVP, Booyahs e Líderes de Abates atualizados.')
})
