import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Regressão — Home aprovada da Rodada 4', () => {
  test('home usa tokens dark/gold e não o tema vermelho/branco antigo', () => {
    const css = read('web/features/home/authenticated-home.css')

    expect(css).toContain('--home-bg:var(--ui-bg,#0c0d0f)')
    expect(css).toContain('--home-surface:var(--ui-surface,#141518)')
    expect(css).toContain('--home-accent:var(--ui-accent,#c9b766)')
    expect(css).not.toContain('--home-accent:#ef3340')
    expect(css).not.toContain('--home-card:#fff')
    expect(css).not.toContain('--home-paper:#f3f1ec')
  })

  test('métricas e atalhos permanecem leves, sem caixas brancas', () => {
    const css = read('web/features/home/authenticated-home.css')

    expect(css).toContain('.authenticated-home-overview{')
    expect(css).toContain('gap:28px')
    expect(css).toContain('.authenticated-home-access-grid{')
    expect(css).toContain('grid-template-columns:repeat(5,minmax(0,1fr))')
    expect(css).toContain('background:transparent')
    expect(css).not.toContain('background:var(--home-card)')
  })

  test('oportunidades preservam cards escuros aprovados', () => {
    const css = read('web/features/home/authenticated-home.css')

    expect(css).toContain('background:var(--home-surface)')
    expect(css).toContain('box-shadow:none')
    expect(css).toContain('background:var(--home-accent)')
    expect(css).not.toContain('linear-gradient(90deg,var(--home-accent),var(--home-gold),var(--home-purple))')
  })

  test('mobile preserva o fluxo compacto aprovado', () => {
    const css = read('web/features/home/authenticated-home.css')

    expect(css).toContain('.authenticated-home-intro-copy{display:none}')
    expect(css).toContain('.authenticated-home-section{padding:0 3px;gap:10px}')
    expect(css).toContain('.authenticated-home-overview{display:none}')
    expect(css).toContain('grid-template-columns:92px minmax(0,1fr)')
    expect(css).toContain('min-height:128px')
  })
})
