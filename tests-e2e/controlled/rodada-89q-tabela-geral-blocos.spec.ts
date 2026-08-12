import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')
const data = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css'), 'utf8')

test('89Q cria Tabela Geral como bloco próprio da arte sem importar overlay da live', async () => {
  expect(workspace).toContain("type: 'table_general'")
  expect(workspace).toContain('function createGeneralTableBlock')
  expect(workspace).toContain('Tabela Geral')
  expect(workspace).not.toContain("from '../../stream/components")
  expect(workspace).not.toContain('StreamPackageStage')
})

test('89Q busca classificação pela API de estatísticas do campeonato e não por layout de transmissão', async () => {
  expect(data).toContain('/estatisticas/equipes')
  expect(data).toContain('pontos_total')
  expect(data).toContain('booyahs')
  expect(data).not.toContain('/stream/data')
})

test('89Q tabela geral usa faixa independente do item inicial ao final', async () => {
  expect(workspace).toContain('function sliceRows')
  expect(workspace).toContain('(block.dataStart || 1) - 1')
  expect(workspace).toContain('block.dataEnd || block.dataStart || 1')
  expect(workspace).toContain('Do item')
  expect(workspace).toContain('Até')
})

test('89Q duplicar tabela avança automaticamente a faixa mantendo o mesmo tamanho', async () => {
  expect(workspace).toContain("const nextStart = (block.dataEnd || 12) + 1")
  expect(workspace).toContain("const count = Math.max(1, (block.dataEnd || 12) - (block.dataStart || 1) + 1)")
  expect(workspace).toContain('dataEnd: nextStart + count - 1')
})

test('89Q tabela tem colunas próprias com largura, visibilidade e fundo por célula', async () => {
  for (const key of ['rank', 'logo', 'name', 'drops', 'booyah', 'kills', 'points']) expect(types).toContain(`'${key}'`)
  expect(types).toContain('backgroundUrl: string | null')
  expect(workspace).toContain('Largura')
  expect(workspace).toContain('Exibir coluna')
  expect(workspace).toContain('Upload do fundo')
  expect(workspace).toContain("openAssetLibrary('column')")
})

test('89Q permite altura das linhas, gaps e legenda sem duas colunas automáticas', async () => {
  expect(workspace).toContain('Altura da linha')
  expect(workspace).toContain('Espaço entre linhas')
  expect(workspace).toContain('Gap entre células')
  expect(workspace).toContain('Exibir legenda')
  expect(workspace).toContain('Uma coluna de ranking por bloco.')
  expect(workspace).not.toContain('Duas colunas')
})

test('89Q bloco é livre para X/Y e pode ser arrastado na área de trabalho', async () => {
  expect(workspace).toContain('function beginDrag')
  expect(workspace).toContain('function drag')
  expect(workspace).toContain("x: Math.round(current.x + (event.clientX - current.startX) / previewScale)")
  expect(css).toContain('.post-artworks-table-block{position:absolute')
})

test('89Q exporta imagem única ou carrossel usando os dados mais recentes', async () => {
  expect(workspace).toContain('async function exportArtwork')
  expect(workspace).toContain('loadPostArtworkGeneralStandings(campeonatoId), loadPostArtworkGeneralMvp(campeonatoId)')
  expect(workspace).toContain("new JSZip()")
  expect(workspace).toContain('Baixar carrossel')
  expect(workspace).toContain('Baixar imagem')
})
