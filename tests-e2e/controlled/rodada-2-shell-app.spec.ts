import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 2 — shell global e navegação mobile', () => {
  test('shell usa a nova fundação visual sem bordas ou sombras decorativas', () => {
    const css = read('web/app/header.css')

    expect(css).toContain('background: var(--ui-bg, #0c0d0f)')
    expect(css).toContain('color: var(--ui-accent-strong, #dfcf85)')
    expect(css).toContain('box-shadow: none')
    expect(css).toContain('border: 0')
    expect(css).not.toContain('linear-gradient')
    expect(css).not.toContain('backdrop-filter')
  })

  test('mobile possui dock de navegação em vez de comprimir o menu desktop', () => {
    const header = read('web/components/layout/AppHeader.tsx')
    const css = read('web/app/header.css')

    expect(header).toContain('className="app-mobile-dock"')
    expect(header).toContain('<span>Início</span>')
    expect(header).toContain('<span>Campeonatos</span>')
    expect(header).toContain('<span>Agenda</span>')
    expect(header).toContain('<span>Equipes</span>')
    expect(header).toContain('<span>Mais</span>')
    expect(header).toContain('className="app-mobile-nav-backdrop"')
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))')
    expect(css).toContain('bottom: 0')
    expect(css).toContain('border-radius: 0')
  })

  test('conteúdo do shell reserva a área da navegação móvel', () => {
    const shell = read('web/components/layout/AppShell.tsx')
    const css = read('web/app/header.css')

    expect(shell).toContain("const parts = ['app-shell-main', mainClassName]")
    expect(css).toContain('padding-bottom: calc(58px + env(safe-area-inset-bottom))')
  })

  test('shell sticky remove offsets antigos e Lili respeita a navegação mobile', () => {
    const globalCss = read('web/app/globals.css')

    expect(globalCss).toContain('.page-authenticated{ padding-top: 0;')
    expect(globalCss).not.toContain('.page-authenticated{ padding-top: 88px;')
    expect(globalCss).not.toContain('.page-authenticated{ padding-top: 96px;')
    expect(globalCss).toContain('bottom: calc(66px + env(safe-area-inset-bottom))')
  })

})
