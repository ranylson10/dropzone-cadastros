import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')

test('91D bloco de classificados nasce sem Top fixo quando não há jogo classificatório', async () => {
  expect(workspace).toContain("const limit = game?.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0")
  expect(workspace).not.toContain("const limit = game?.mataMata && game.classificamQuantidade ? game.classificamQuantidade : 12")
  expect(workspace).toContain("'Definido pelo jogo'")
  expect(workspace).toContain("'Quantidade definida pelo jogo'")
})

test('91D jogo selecionado redefine sempre o corte de classificados', async () => {
  expect(workspace).toContain("block.type === 'qualified_teams' ? { dataStart: 1, dataEnd: game.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0 } : {}")
  expect(workspace).toContain("selectedBlock.type === 'qualified_teams' ? { dataStart: 1, dataEnd: game?.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0 } : {}")
})

test('91D preview e exportação dividem classificados e eliminados pelo corte do jogo', async () => {
  const dynamicSplit = "const limit = Math.max(0, Number(block.dataEnd || 0))"
  expect(workspace.split(dynamicSplit).length - 1).toBeGreaterThanOrEqual(2)
  expect(workspace.split("const qualifiedRows = limit > 0 ? rows.slice(0, limit) : []").length - 1).toBeGreaterThanOrEqual(2)
  expect(workspace.split("const eliminatedRows = limit > 0 ? rows.slice(limit) : []").length - 1).toBeGreaterThanOrEqual(2)
})
