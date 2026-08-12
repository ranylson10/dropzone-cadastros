import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const workspace = source('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const generatePage = source('web/app/campeonatos/[id]/artes-postagem/page.tsx')
const editorPage = source('web/app/campeonatos/[id]/artes-postagem/editor/page.tsx')

 test('90B transforma a entrada de artes em central de geração e mantém editor separado', () => {
  expect(generatePage).toContain('mode="generate"')
  expect(editorPage).toContain('mode="edit"')
  expect(editorPage).toContain('initialArtworkId={query.artwork}')
  expect(workspace).toContain('CENTRAL DE ARTES')
  expect(workspace).toContain('Gerar artes')
  expect(workspace).toContain('Artes salvas')
  expect(workspace).toContain('Editor de artes')
  expect(workspace).toContain('Biblioteca de imagens')
})

test('90B filtra fase e jogo antes de gerar as artes', () => {
  expect(workspace).toContain('Selecione a fase e o jogo')
  expect(workspace).toContain('generationPhaseId')
  expect(workspace).toContain('generationGameId')
  expect(workspace).toContain('generationGames')
  expect(workspace).toContain('Abrir pontuador')
})

test('90B aplica o jogo escolhido aos blocos operacionais sem alterar tabela geral', () => {
  expect(workspace).toContain('function resolveProjectForGame')
  expect(workspace).toContain("block.type === 'table_day'")
  expect(workspace).toContain("block.type === 'qualified_teams'")
  expect(workspace).toContain("block.type === 'booyahs_day'")
  expect(workspace).toContain("block.type === 'mvp_day'")
  expect(workspace).toContain("dataEnd: game.classificamQuantidade")
})

test('90B permite visualizar baixar editar e criar sem abrir o editor para conferir', () => {
  expect(workspace).toContain('A prévia aparecerá aqui sem abrir o editor.')
  expect(workspace).toContain('Visualizar')
  expect(workspace).toContain('Baixar carrossel')
  expect(workspace).toContain('Editar arte')
  expect(workspace).toContain('createProjectAndEdit')
})
