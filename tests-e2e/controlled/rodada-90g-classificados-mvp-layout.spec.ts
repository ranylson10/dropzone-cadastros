import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css'), 'utf8')

test('90G classificados vira composição de logos com grupos classificados e eliminados', () => {
  expect(types).toContain('PostArtworkQualifiedStyle')
  expect(workspace).toContain('Cards de classificados')
  expect(workspace).toContain("qualifiedTitle: 'CLASSIFICADOS'")
  expect(workspace).toContain("eliminatedTitle: 'ELIMINADOS'")
  expect(workspace).toContain('const qualifiedRows = rows.slice(0, limit)')
  expect(workspace).toContain('const eliminatedRows = rows.slice(limit)')
  expect(workspace).toContain('drawQualifiedCard')
  expect(css).toContain('.post-artworks-qualified-card')
})

test('90G classificados usa somente logo em card e top vem do jogo mata-mata', () => {
  expect(workspace).toContain("selectedBlock.type === 'qualified_teams'")
  expect(workspace).toContain('{ dataStart: 1, dataEnd: game.classificamQuantidade }')
  expect(workspace).toContain('row.logo ? <img')
  expect(workspace).toContain('Top que classifica')
  expect(workspace).toContain('Cards por linha')
  expect(workspace).toContain("openAssetLibrary('qualified')")
})

test('90G MVP Geral permite top 1 destacado mais tabela ou somente tabela', () => {
  expect(types).toContain("PostArtworkMvpLayoutMode = 'card_table' | 'table_only'")
  expect(workspace).toContain('Layout do MVP Geral')
  expect(workspace).toContain('Top 1 em card + tabela')
  expect(workspace).toContain('Somente tabela')
  expect(workspace).toContain("style.layoutMode === 'table_only'")
  expect(workspace).toContain('drawMvpTable')
  expect(workspace).toContain('rows.slice(1)')
})

test('90G MVP Geral trabalha com ranking até posição configurável e exporta o mesmo layout', () => {
  expect(workspace).toContain("dataEnd: type === 'mvp_general' ? 10 : 1")
  expect(workspace).toContain('Até posição')
  expect(workspace).toContain('playerRowsForBlock')
  expect(workspace).toContain("if (block.type === 'mvp_general')")
  expect(css).toContain('.post-artworks-mvp-ranking-table')
})
