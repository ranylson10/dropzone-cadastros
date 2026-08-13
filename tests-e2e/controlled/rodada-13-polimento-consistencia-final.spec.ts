import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 13 — polimento e consistência final', () => {
  test('home não mantém sombras ou blur decorativo nos cards e gate', () => {
    const css = read('web/features/home/authenticated-home.css')
    expect(css).not.toContain('box-shadow:0 14px 34px')
    expect(css).not.toContain('box-shadow:0 18px 44px')
    expect(css).not.toContain('backdrop-filter:blur(4px)')
    expect(css).not.toContain('background:#fff;border-top:3px solid')
    expect(css).toContain('background:var(--ui-surface,#141518)')
  })

  test('ação principal da oportunidade segue o dourado do sistema', () => {
    const css = read('web/features/home/authenticated-home.css')
    expect(css).toContain('background:var(--ui-primary,#c9b766);color:#111214')
  })

  test('calls abandona controles brancos e painéis cinza antigos', () => {
    const css = read('web/features/campeonatos/calls/components/calls.css')
    expect(css).toContain('background:var(--ui-surface,#141518)')
    expect(css).toContain('background:var(--ui-surface-elevated,#1a1b1f)')
    expect(css).not.toContain('border:1px solid #b8bdc4;background:#e7e9ec')
    expect(css).not.toContain('border:1px solid #858b93;background:#fff')
    expect(css).not.toContain('border:1px solid #b9bdc3;background:#fff')
  })

  test('calls mantém mapa e destaque operacional sem shadow ou glass', () => {
    const css = read('web/features/campeonatos/calls/components/calls.css')
    expect(css).toContain('.xt-map-svg{display:block')
    expect(css).toContain('outline:2px solid var(--ui-primary,#c9b766)')
    expect(css).not.toContain('box-shadow:')
    expect(css).not.toContain('backdrop-filter:')
  })
})
