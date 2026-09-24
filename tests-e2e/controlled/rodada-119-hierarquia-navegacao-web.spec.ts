import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 119 — hierarquia simples da navegação web', () => {
  test('menu global expõe somente cinco áreas principais', () => {
    const nav = read('web/components/layout/nav.ts')
    expect(nav).toContain("label: 'Início'")
    expect(nav).toContain("label: 'Competições'")
    expect(nav).toContain("label: 'Comunidade'")
    expect(nav).toContain("label: 'Carteira'")
    expect(nav).toContain("label: 'Mais'")
    expect(nav).toContain("{ label: 'Equipes', href: '/equipes' }")
    expect(nav).toContain("{ label: 'Jogadores', href: '/jogadores' }")
    expect(nav).toContain("{ label: 'Ranking', href: '/rank' }")
    expect(nav).toContain("{ label: 'Agenda', href: '/agenda' }")
  })

  test('rotas existentes são agrupadas sem quebrar URLs antigas', () => {
    const nav = read('web/components/layout/nav.ts')
    expect(nav).toContain("return 'Competições'")
    expect(nav).toContain("return 'Comunidade'")
    expect(nav).toContain("return 'Carteira'")
    expect(nav).toContain("return 'Mais'")
    for (const route of ['/campeonatos', '/vagas', '/equipes', '/jogadores', '/rank', '/produtoras', '/agenda', '/afiliados', '/lili']) {
      expect(nav).toContain(`'${route}'`)
    }
  })

  test('mobile usa dock com ação central e comunidade como hub', () => {
    const header = read('web/components/layout/AppHeader.tsx')
    const css = read('web/app/header.css')
    expect(header).toContain('aria-label="Navegação rápida"')
    expect(header).toContain('aria-label="Abrir ações rápidas"')
    expect(header).toContain('<span>Competições</span>')
    expect(header).toContain('<span>Comunidade</span>')
    expect(header).not.toContain('<span>Agenda</span>\n          </a>\n          <a href="/equipes"')
    expect(css).toContain('.app-mobile-quick-sheet')
    expect(css).toContain('.app-mobile-quick-icon')
  })

  test('ações rápidas mudam conforme o perfil sem criar app separado', () => {
    const header = read('web/components/layout/AppHeader.tsx')
    expect(header).toContain("activeProfileType === 'produtora'")
    expect(header).toContain("activeProfileType === 'equipe'")
    expect(header).toContain("activeProfileType === 'jogador'")
    expect(header).toContain("activeProfileType === 'manager'")
    expect(header).toContain("label: 'Criar campeonato'")
    expect(header).toContain("label: 'Minha equipe'")
    expect(header).toContain("label: 'Minha agenda'")
  })

  test('Home prioriza o que exige ação antes do catálogo de oportunidades', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    expect(home.indexOf('authenticated-home-priority-section')).toBeLessThan(home.indexOf('authenticated-home-catalog'))
    expect(home.indexOf('authenticated-home-command-center')).toBeLessThan(home.indexOf('authenticated-home-catalog'))
  })

  test('hub Comunidade é responsivo e concentra diretórios', () => {
    const page = read('web/app/comunidade/page.tsx')
    const css = read('web/app/comunidade/comunidade.css')
    expect(page).toContain('activeLabel="Comunidade"')
    expect(page).toContain("href: '/equipes'")
    expect(page).toContain("href: '/jogadores'")
    expect(page).toContain("href: '/rank'")
    expect(page).toContain("href: '/produtoras'")
    expect(css).toContain('@media(max-width:700px)')
    expect(css).toContain('grid-template-columns:1fr')
  })
})
