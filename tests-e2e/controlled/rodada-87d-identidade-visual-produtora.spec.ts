import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

function source(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test.describe('Identidade LEALT atual da produtora', () => {
  test('usa a paleta LEALT, superfícies retas e sem sombras no painel operacional', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('--producer-bg: #e4e7ea')
    expect(css).toContain('--producer-gold: var(--dz-accent)')
    expect(css).toContain('--producer-ink: #1c2026')
    expect(css).toContain('.producer-layout-ref .panel,')
    expect(css).toContain('border-radius: 0')
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
