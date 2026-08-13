import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css'), 'utf8')

test('92P - controles rolam dentro do proprio painel', async () => {
  expect(css).toContain('.post-artworks-list-panel,.post-artworks-controls,.post-artworks-blocks-panel{overflow-y:auto')
  expect(css).toContain('overscroll-behavior:contain')
  expect(css).toContain('max-height:calc(100vh - 24px)')
})

test('92P - area de trabalho permanece visivel enquanto usuario ajusta ferramentas', async () => {
  expect(css).toContain('.post-artworks-preview-panel{display:flex;flex-direction:column;overflow:hidden}')
  expect(css).toContain('.post-artworks-preview-shell{flex:1 1 auto;min-height:0;height:calc(100vh - 92px)}')
  expect(css).toContain('position:sticky;top:12px')
})

test('92P - acoes principais ficam acessiveis no rodape dos controles', async () => {
  expect(css).toContain('.post-artworks-controls .post-artworks-actions{position:sticky;bottom:0')
})
