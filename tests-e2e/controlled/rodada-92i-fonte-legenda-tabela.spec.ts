import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const workspace = fs.readFileSync(path.join(ROOT, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const types = fs.readFileSync(path.join(ROOT, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')

test('92I - tabela permite aumentar tamanho e peso da fonte da legenda', async () => {
  expect(types).toContain('headerFontSize: number')
  expect(types).toContain('headerFontWeight: number')
  expect(workspace).toContain('Tamanho da fonte da legenda')
  expect(workspace).toContain('Peso da fonte da legenda')
  expect(workspace).toContain('headerFontSize: Math.max(8, Math.min(120')
})

test('92I - tabela permite escolher a fonte da legenda', async () => {
  expect(types).toContain('headerFontFamily: string')
  expect(workspace).toContain('Fonte da legenda')
  expect(workspace).toContain('<option value="Impact">Impact</option>')
  expect(workspace).toContain('<option value="Verdana">Verdana</option>')
})

test('92I - preview e exportacao usam a configuracao da legenda', async () => {
  expect(workspace).toContain('ctx.font = `${style.headerFontWeight} ${style.headerFontSize}px ${style.headerFontFamily}`')
  expect(workspace).toContain('fontSize: Math.max(7, style.headerFontSize * previewScale)')
  expect(workspace).toContain('fontFamily: style.headerFontFamily')
})
