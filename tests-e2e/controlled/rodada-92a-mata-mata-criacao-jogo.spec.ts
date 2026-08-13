import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const produtora = fs.readFileSync(path.join(root, 'web/features/dropzone/panels/produtora/ProdutoraPanel.tsx'), 'utf8')
const home = fs.readFileSync(path.join(root, 'web/features/dropzone/DropZoneHome.tsx'), 'utf8')

test('92A - cadastro de jogo expõe formato competitivo e quantidade que avança', async () => {
  expect(produtora).toContain('Regra de classificação')
  expect(produtora).toContain('Formato competitivo')
  expect(produtora).toContain('Mata-mata / classificatório')
  expect(produtora).toContain('Quantas equipes passam')
  expect(produtora).toContain("mata_mata: e.target.value === 'mata_mata'")
  expect(produtora).toContain("classificam_quantidade: e.target.value === 'mata_mata' ? props.game.classificam_quantidade : ''")
})

test('92A - edição recupera a regra mata-mata salva no jogo', async () => {
  expect(produtora).toContain('mata_mata: Boolean(gameRow.data?.mata_mata)')
  expect(produtora).toContain("classificam_quantidade: gameRow.data?.classificam_quantidade == null ? '' : String(gameRow.data.classificam_quantidade)")
  expect(produtora).toContain('Mata-mata · Top ${gameRow.data?.classificam_quantidade')
})

test('92A - criação e atualização continuam enviando corte para a API', async () => {
  expect(home).toContain("if (game.tipo_jogo !== 'final' && game.mata_mata")
  expect(home).toContain("mata_mata: game.tipo_jogo === 'final' ? false : Boolean(game.mata_mata)")
  expect(home).toContain("classificam_quantidade: game.tipo_jogo !== 'final' && game.mata_mata ? Number(game.classificam_quantidade || 0) : null")
})
