import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')

test('91H template remove fontes de jogo antes de salvar', async () => {
  expect(workspace).toContain('function stripDynamicGameSources(project: PostArtworkProject): PostArtworkProject')
  expect(workspace).toContain("? { ...block, source: {}, ...(block.type === 'qualified_teams' ? { dataStart: 1, dataEnd: 0 } : {}) }")
  expect(workspace).toContain('body: JSON.stringify(stripDynamicGameSources(draft))')
})

test('91H editor usa somente jogo global de referencia ao criar blocos dinamicos', async () => {
  expect(workspace).toContain('const game = editorReferenceGame || undefined')
  expect(workspace).toContain("createMvpBlock('mvp_day', draft.blocks.filter((item) => item.type === 'mvp_day').length, editorReferenceGame || undefined)")
  expect(workspace).toContain("createQualifiedTeamsBlock(draft.blocks.filter((item) => item.type === 'qualified_teams').length, editorReferenceGame || undefined)")
  expect(workspace).not.toContain('games[games.length - 1]')
})

test('91H painel deixa claro que jogo nao fica preso ao template', async () => {
  expect(workspace).toContain('<strong>Jogo dinâmico</strong>')
  expect(workspace).toContain('Na geração, o jogo escolhido substitui a referência sem ficar preso ao template.')
  expect(workspace).toContain('O jogo não fica preso ao template.')
})

test('91H central lista todos os blocos alimentados pelo jogo escolhido', async () => {
  expect(workspace).toContain('Tabela do Jogo, Classificados, MVP, Booyahs e Líderes de Abates.')
})
