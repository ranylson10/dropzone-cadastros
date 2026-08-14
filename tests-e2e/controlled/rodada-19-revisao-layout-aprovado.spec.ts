import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 19 — revisão no layout aprovado', () => {
  test('revisão não usa cards brancos nem bordas por item', () => {
    const css = source('web/app/globals.css')
    const start = css.indexOf('.championship-review-grid{ display:grid')
    const end = css.indexOf('.structure-workspace{', start)
    const reviewCss = css.slice(start, end)

    expect(start).toBeGreaterThan(-1)
    expect(reviewCss).toContain('background:transparent')
    expect(reviewCss).toContain('border:0')
    expect(reviewCss).toContain('box-shadow:none')
    expect(reviewCss).not.toContain('background: #fff')
    expect(reviewCss).not.toContain('border: 1px solid #e4e7ec')
  })

  test('informações usam tipografia do sistema e divisórias leves', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.championship-review-grid small{ color:var(--ui-text-muted)')
    expect(css).toContain('.championship-review-grid strong{ min-width:0; color:var(--ui-text)')
    expect(css).toContain('border-top:1px solid var(--ui-line)')
  })

  test('aviso da revisão deixa de ser caixa tracejada', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.championship-review-card > .form-empty-note{ margin:12px 0 0; padding:0; border:0')
  })

  test('mobile vira lista vertical sem voltar aos cards', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.championship-review-grid{ grid-template-columns:1fr; column-gap:0')
    expect(css).toContain('.championship-review-grid > div:last-child{ border-bottom:0')
  })
})
