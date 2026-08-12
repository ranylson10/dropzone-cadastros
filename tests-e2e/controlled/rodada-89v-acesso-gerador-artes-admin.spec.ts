import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panel = fs.readFileSync(path.join(root, 'web/features/dropzone/panels/produtora/ProdutoraPanel.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('89V coloca acesso principal ao gerador de artes na gestão do campeonato', () => {
  expect(panel).toContain('champ-post-artworks-hero')
  expect(panel).toContain('Abrir gerador de imagens')
  expect(panel).toContain('Artes para postar')
  expect(panel).toContain('/artes-postagem`)')
})

test('89V também coloca Artes para postar entre os atalhos principais da visão geral', () => {
  expect(panel).toContain('className="is-post-artworks"')
  expect(panel).toContain('Tabelas, MVPs e carrosséis')
})

test('89V deixa o acesso visualmente destacado e responsivo', () => {
  expect(css).toContain('.champ-post-artworks-hero{')
  expect(css).toContain('border:1px solid #ff3556')
  expect(css).toContain('.champ-overview-flow button.is-post-artworks')
  expect(css).toContain('@media (max-width:860px)')
})
