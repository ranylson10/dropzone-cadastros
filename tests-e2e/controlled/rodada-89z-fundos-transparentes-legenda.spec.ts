import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const workspacePath = path.join(process.cwd(), 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const typesPath = path.join(process.cwd(), 'web/features/campeonatos/artes-postagem/types/artwork.types.ts')

function read(file: string) {
  return fs.readFileSync(file, 'utf8')
}

test('89Z permite coluna sem fundo e imagem sem preto por baixo', () => {
  const workspace = read(workspacePath)
  const types = read(typesPath)
  expect(types).toContain("PostArtworkCellBackgroundType = 'color' | 'image' | 'none'")
  expect(workspace).toContain("if (column.backgroundType === 'color')")
  expect(workspace).toContain("else if (column.backgroundType === 'image' && column.backgroundUrl)")
  expect(workspace).toContain('<option value="none">Sem fundo</option>')
  expect(workspace).toContain("backgroundColor: column.backgroundType === 'color' ? column.backgroundColor : 'transparent'")
})

test('89Z permite fundo de imagem ou transparente na legenda', () => {
  const workspace = read(workspacePath)
  const types = read(typesPath)
  expect(types).toContain('headerBackgroundType: PostArtworkCellBackgroundType')
  expect(types).toContain('headerBackgroundUrl: string | null')
  expect(workspace).toContain('Fundo da legenda')
  expect(workspace).toContain('Upload da legenda')
  expect(workspace).toContain("openAssetLibrary('header')")
  expect(workspace).toContain("headerBackgroundType: event.target.value as 'color' | 'image' | 'none'")
})

test('89Z preview e export respeitam legenda transparente ou com imagem', () => {
  const workspace = read(workspacePath)
  expect(workspace).toContain("style.headerBackgroundType === 'image' && style.headerBackgroundUrl")
  expect(workspace).toContain("style.headerBackgroundType === 'color'")
  expect(workspace).toContain("backgroundColor: style.headerBackgroundType === 'color' ? style.headerBackgroundColor : 'transparent'")
  expect(workspace).toContain("backgroundSize: 'cover'")
})
