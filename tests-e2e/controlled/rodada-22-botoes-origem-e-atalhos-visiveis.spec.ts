import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 22 — botões mais visíveis no fluxo de criação e na lista', () => {
  test('os 3 botões de origem ficam centralizados e mais legíveis', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('body .championship-origin-option{')
    expect(css).toContain('justify-items: center;')
    expect(css).toContain('text-align: center;')
    expect(css).toContain('font-size: 16px;')
    expect(css).toContain('font-size: 11px;')
  })

  test('o bloco Novo / Filtrar ganha altura, centralização e destaque no botão principal', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('body .page-authenticated:has(.producer-layout-ref) .producer-layout-ref .producer-catalog-actions .button{')
    expect(css).toContain('min-height: 80px;')
    expect(css).toContain('place-items: center;')
    expect(css).toContain('.producer-catalog-actions .button:first-child{')
    expect(css).toContain('background: var(--ui-accent);')
  })
})
