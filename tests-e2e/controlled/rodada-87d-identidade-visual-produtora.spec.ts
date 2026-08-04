import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

function source(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test.describe('Rodada 87D — identidade visual única da produtora', () => {
  test('usa cinza médio, ouro e grafite sem sombras no painel operacional', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('RODADA 87D — PAINEL DA PRODUTORA')
    expect(css).toContain('--producer-bg: #c9cdd2')
    expect(css).toContain('--producer-gold: #c9a227')
    expect(css).toContain('--producer-ink: #17191d')
    expect(css).toContain('.producer-layout-ref .panel,')
    expect(css).toContain('box-shadow: none')
  })

  test('mantém lista isolada, ações fixas e filtros compactos', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('grid-template-rows: auto auto minmax(0, 1fr) auto auto')
    expect(css).toContain('overscroll-behavior: contain')
    expect(css).toContain('.producer-layout-ref .statistics-filters')
    expect(css).toContain('flex: 0 0 160px')
    expect(css).toContain('.producer-layout-ref .championship-admin-actions .icon-action-button')
    expect(css).toContain('font-size: 0')
  })
})
