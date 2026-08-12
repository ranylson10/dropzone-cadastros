import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')

test('89Y renderiza exportação internamente em até 2x sem mudar o tamanho final', () => {
  expect(workspace).toContain('resolveExportRenderScale')
  expect(workspace).toContain('Math.min(2, safeScale)')
  expect(workspace).toContain('ctx.scale(renderScale, renderScale)')
  expect(workspace).toContain('createDownsampledCanvas(board, project.width, project.height)')
})

test('89Y força smoothing alto no render e no downsample', () => {
  expect(workspace.match(/imageSmoothingQuality = 'high'/g)?.length || 0).toBeGreaterThanOrEqual(2)
  expect(workspace).toContain('imageSmoothingEnabled = true')
})

test('89Y mantém fatias no tamanho configurado e usa origem em alta resolução', () => {
  expect(workspace).toContain("* renderScale")
  expect(workspace).toContain('createDownsampledCanvas(board, project.slice_width, project.slice_height, sx, sy, sw, sh)')
})

test('89Y aumenta qualidade do JPG sem alterar PNG', () => {
  expect(workspace).toContain("format === 'jpg' ? .98 : undefined")
})
