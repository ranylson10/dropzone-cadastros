import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css'), 'utf8')

test('89W aumenta campos numéricos e adiciona stepper visual', () => {
  expect(workspace).toContain('post-artworks-number-input')
  expect(workspace).toContain('Aumentar valor')
  expect(workspace).toContain('Diminuir valor')
  expect(css).toContain('.post-artworks-number-input>input')
  expect(css).toContain('font-size:20px')
})

test('89W adiciona zoom por scroll e botões rápidos na área de trabalho', () => {
  expect(workspace).toContain('handlePreviewWheel')
  expect(workspace).toContain('Scroll dá zoom no ponto do mouse; arraste o fundo para mover a tela.')
  expect(workspace).toContain('post-artworks-zoom-actions')
  expect(workspace).toContain('Ajustar')
  expect(workspace).toContain('100%')
})

test('89W mantém upload e biblioteca juntos para fundo de células', () => {
  expect(workspace).toContain('Upload do fundo')
  expect(workspace).toContain("openAssetLibrary('column')")
  expect(workspace).toContain('post-artworks-inline-actions')
})
