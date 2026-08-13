import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ruleBodies = (css: string, selector: string) => {
  const matcher = new RegExp(`${escaped(selector)}\\s*\\{([^}]*)\\}`, 'g')
  return [...css.matchAll(matcher)].map((match) => match[1].replace(/\s+/g, ' ').trim())
}
const expectRule = (css: string, selector: string, declarations: string[]) => {
  const bodies = ruleBodies(css, selector)
  expect(bodies.length, `regra ${selector} não encontrada`).toBeGreaterThan(0)
  expect(
    bodies.some((body) => declarations.every((declaration) => body.includes(declaration))),
    `nenhuma regra ${selector} contém: ${declarations.join(', ')}`,
  ).toBeTruthy()
}

test.describe('Rodada 4 — dashboard com hierarquia de produto', () => {
  test('home autenticada usa a fundação dark sem bordas, sombras ou opacidades decorativas', () => {
    const css = source('web/features/home/authenticated-home.css')

    expectRule(css, '.authenticated-home', [
      '--home-bg:var(--ui-bg,#0c0d0f)',
      '--home-surface:var(--ui-surface,#141518)',
      '--home-accent:var(--ui-accent,#c9b766)',
    ])
    expect(css).not.toMatch(/border:\s*1px/i)
    expect(css).not.toMatch(/box-shadow:(?!none)/i)
    expect(css).not.toContain('rgba(')
    expect(css).not.toContain('nth-of-type')
  })

  test('ação principal aparece antes dos atalhos e oportunidades', () => {
    const home = source('web/features/home/AuthenticatedHomeFeed.tsx')

    const intro = home.indexOf('authenticated-home-primary-actions')
    const shortcuts = home.indexOf('authenticated-home-access-section')
    const opportunities = home.indexOf('Campeonatos com vagas abertas')

    expect(home).toContain('<h1>O que você quer fazer?</h1>')
    expect(home).toContain('Escolha a próxima ação. O restante aparece quando você precisar.')
    expect(intro).toBeGreaterThan(0)
    expect(shortcuts).toBeGreaterThan(intro)
    expect(opportunities).toBeGreaterThan(shortcuts)
  })

  test('atalhos deixam de ser cards com descrições longas', () => {
    const home = source('web/features/home/AuthenticatedHomeFeed.tsx')
    const css = source('web/features/home/authenticated-home.css')

    expect(home).toContain('<h2>Seus atalhos</h2>')
    expect(home).toContain('<strong>Painel</strong>')
    expect(home).toContain('<strong>Equipe</strong>')
    expect(home).toContain('<strong>Campeonatos</strong>')
    expect(home).toContain('<strong>Carteira</strong>')
    expect(home).toContain('<strong>Rank</strong>')
    expect(home).not.toContain('<strong>Agenda</strong>')
    expectRule(css, '.authenticated-home-access-card', [
      'border:0',
      'background:transparent',
      'box-shadow',
    ].filter((item) => item !== 'box-shadow'))
  })

  test('oportunidades reutilizam a mesma lista visual da aba Campeonatos', () => {
    const home = source('web/features/home/AuthenticatedHomeFeed.tsx')
    const directory = source('web/features/directory/components/DirectoryListClient.tsx')

    expect(home).toContain('<DirectoryListClient items={championshipItems} cardsOnly />')
    expect(home).toContain("import '@/features/directory/components/championship-directory.css'")
    expect(directory).toContain('cardsOnly = false')
    expect(directory).toContain('const isChampionshipDirectory = cardsOnly ||')
    expect(home).not.toContain('authenticated-home-vacancy-card')
  })

  test('mobile prioriza fluxo de app, ocupa a largura e compacta a lista', () => {
    const css = source('web/features/home/authenticated-home.css')

    expect(css).toContain('.authenticated-home-intro-copy{display:none}')
    expect(css).toContain('.authenticated-home-intro{min-height:0;padding:6px 3px 0;border-radius:0;background:transparent;gap:0}')
    expect(css).toContain('.authenticated-home-action small{display:none}')
    expect(css).toContain('.authenticated-home-section{padding:0 3px;gap:10px}')
    expect(css).toContain('.authenticated-home-access-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:0;padding:0;overflow:visible}')
    expect(css).toContain('.authenticated-home-access-card small{display:none}')
    expect(css).toContain('.authenticated-home-directory-preview .directory-champ-card-grid{width:100%}')
  })
  test('mobile move menu para o topo, abre drawer lateral e usa perfil no dock', () => {
    const header = source('web/components/layout/AppHeader.tsx')
    const css = source('web/app/header.css')

    expect(header).toContain('className="app-mobile-toggle"')
    expect(header).toContain("className={`app-mobile-profile-switcher ${profileOpen ? 'active' : ''}`}")
    expect(header).toContain('<span>Perfil</span>')
    expect(header).toContain("target?.closest('.app-mobile-profile-switcher')")
    expect(header).not.toContain('<span>Mais</span>')
    expect(css).toContain('grid-template-columns: 36px minmax(0, 1fr) 36px 36px')
    expect(css).toContain('width: min(70vw, 276px)')
    expect(css).toContain('top: 56px')
    expect(css).toContain('left: 0')
    expect(css).toContain('bottom: calc(62px + env(safe-area-inset-bottom)) !important')
    expect(header).toContain('<strong>DropZone</strong>')
    expect(css).toContain('grid-column: 1')
    expect(css).toContain('.app-nav-dropdown > .app-nav-parent')
    expect(css).toContain('.app-nav-submenu a::before')
  })

})
