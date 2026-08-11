import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const editor = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
const css = read('web/features/campeonatos/stream/stream.css')
const types = read('web/features/campeonatos/stream/types/stream-package.types.ts')

test('89B oferece formatos live, quadrado, vertical e story sem fixar o editor em 16:9', () => {
  expect(types).toContain("{ id: 'live-hd', label: 'Live HD · 16:9', width: 1920, height: 1080")
  expect(types).toContain("{ id: 'live-4k', label: 'Live 4K · 16:9', width: 3840, height: 2160")
  expect(types).toContain("{ id: 'square', label: 'Quadrado · 1:1', width: 1080, height: 1080")
  expect(types).toContain("{ id: 'portrait', label: 'Post vertical · 4:5', width: 1080, height: 1350")
  expect(types).toContain("{ id: 'story', label: 'Story/Reels · 9:16', width: 1080, height: 1920")
  expect(editor).toContain('STREAM_OUTPUT_PROFILES.map')
})

test('89B mantém Browser Source em 1920x1080 quando não recebe canvas alternativo', () => {
  expect(stage).toContain('canvasWidth?: number')
  expect(stage).toContain('canvasHeight?: number')
  expect(stage).toContain('props.canvasWidth || 1920')
  expect(stage).toContain('props.canvasHeight || 1080')
})

test('89B escala a composição base para o canvas escolhido sem duplicar renderer', () => {
  expect(stage).toContain('const designScale = Math.min(canvasWidth / 1920, canvasHeight / 1080)')
  expect(stage).toContain('stream-package-render-design')
  expect(editor).toContain('<StreamPackageStage')
  expect(editor).toContain('canvasWidth={canvasProfile.width}')
  expect(editor).toContain('canvasHeight={canvasProfile.height}')
})

test('89B workspace tem zoom por scroll, ajuste e pan sem alterar dados da overlay', () => {
  expect(editor).toContain('onWheel={handleWorkspaceWheel}')
  expect(editor).toContain('fitPreview')
  expect(editor).toContain('setZoom(1)')
  expect(editor).toContain('event.button !== 1')
  expect(editor).toContain('event.altKey')
})

test('89B permite transparência, fundo de conferência, grid e safe area', () => {
  expect(editor).toContain('<option value="transparent">Transparente</option>')
  expect(editor).toContain('showGrid')
  expect(editor).toContain('showSafeArea')
  expect(css).toContain('.stream-package-preview-workspace.bg-transparent')
  expect(css).toContain('.stream-package-preview-safe-area')
})

test('89B substitui preview responsivo espremido por área de trabalho real', () => {
  expect(css).toContain('.stream-package-preview-workspace{')
  expect(css).toContain('.stream-package-preview-canvas{')
  expect(css).not.toContain('.stream-package-preview-frame>.stream-package-render-root')
  expect(css).toContain('touch-action:none')
})
