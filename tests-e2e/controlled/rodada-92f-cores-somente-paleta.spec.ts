import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function source(file: string) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

test('92F - editor prioriza cores oficiais da paleta', () => {
  const editor = source('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
  expect(editor).toContain('function PaletteColorField')
  expect(editor).toContain('CORES DO PROJETO')
  expect(editor).toContain('Usar cor livre')
  expect(editor).toContain('Cor fora da paleta:')
  expect(editor).toContain('Use apenas quando a cor realmente precisar ser uma exceção.')
})

test('92F - campos principais usam seletor da paleta', () => {
  const editor = source('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
  expect(editor).toContain('<PaletteColorField label="Cor base"')
  expect(editor).toContain('<PaletteColorField label="Cor da legenda"')
  expect(editor).toContain('<PaletteColorField label="Cor do título"')
  expect(editor).toContain('<PaletteColorField label="Cor do nome"')
  expect(editor).toContain('<PaletteColorField label="Cor dos números"')
})

test('92F - visual destaca cor oficial e exceção', () => {
  const css = source('web/features/campeonatos/artes-postagem/post-artworks.css')
  expect(css).toContain('.post-artworks-palette-field-swatches button.active')
  expect(css).toContain('.post-artworks-palette-field details.is-custom')
})
