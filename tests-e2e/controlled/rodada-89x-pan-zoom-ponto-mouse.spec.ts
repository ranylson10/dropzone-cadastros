import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css'), 'utf8')

test('89X zoom preserva o ponto apontado pelo mouse', () => {
  expect(workspace).toContain('previewShellRef')
  expect(workspace).toContain('contentX = (shell.scrollLeft + anchorX)')
  expect(workspace).toContain('contentY = (shell.scrollTop + anchorY)')
  expect(workspace).toContain('event.clientX - rect.left')
  expect(workspace).toContain('event.clientY - rect.top')
})

test('89X permite arrastar o fundo para navegar pela área ampliada', () => {
  expect(workspace).toContain('beginPan')
  expect(workspace).toContain('panPreview')
  expect(workspace).toContain('endPan')
  expect(workspace).toContain("target.closest('.post-artworks-table-block,.post-artworks-mvp-block,.post-artworks-zoom-actions')")
  expect(css).toContain('.post-artworks-preview-shell.is-panning')
})

test('89X remove centralização flex que impedia alcançar bordas no zoom', () => {
  expect(css).toContain('display:block!important')
  expect(css).toContain('justify-content:initial!important')
  expect(workspace).toContain('Scroll dá zoom no ponto do mouse; arraste o fundo para mover a tela.')
})
