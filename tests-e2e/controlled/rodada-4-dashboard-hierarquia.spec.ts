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
  test('home autenticada usa a fundação dark e superfícies consistentes', () => {
    const css = source('web/features/home/authenticated-home.css')

    expectRule(css, '.authenticated-home', [
      '--home-bg:var(--ui-bg,#0c0d0f)',
      '--home-surface:var(--ui-surface,#141518)',
      '--home-accent:var(--ui-accent,#c9b766)',
    ])
    expect(css).not.toMatch(/box-shadow:(?!none)/i)
    expect(css).toContain('border:1px solid var(--ui-line)')
    expect(css).not.toContain('nth-of-type')
  })

  test('catálogo aparece antes das áreas secundárias', () => {
    const home = source('web/features/home/AuthenticatedHomeFeed.tsx')
    const view = home.slice(home.indexOf('<div className="authenticated-home">'))

    const intro = view.indexOf('authenticated-home-primary-actions')
    const priority = view.indexOf('authenticated-home-priority-section')
    const areas = view.indexOf('id="meus-cadastros"')
    const opportunities = view.indexOf('<h2>Campeonatos com vagas abertas</h2>')

    expect(home).toContain("'Seu jogo começa aqui'")
    expect(home).toContain("'Seu campeonato em movimento'")
    expect(intro).toBeGreaterThan(0)
    expect(opportunities).toBeGreaterThan(intro)
    expect(priority).toBeGreaterThan(opportunities)
    expect(areas).toBeGreaterThan(priority)
  })

  test('áreas da conta ficam compactas e identificadas por perfil', () => {
    const home = source('web/features/home/AuthenticatedHomeFeed.tsx')
    const css = source('web/features/home/authenticated-home.css')

    expect(home).toContain('<h2>Meus cadastros</h2>')
    expect(home).toContain("'Minha equipe'")
    expect(home).toContain("'Perfil competitivo'")
    expect(home).toContain("'Minha produtora'")
    expect(home).toContain("'Afiliados'")
    expectRule(css, '.authenticated-home-area-card', [
      'border:1px solid var(--ui-line)',
      'background:var(--home-surface)',
    ])
  })

  test('oportunidades reutilizam o card comercial da página de vagas', () => {
    const home = source('web/features/home/AuthenticatedHomeFeed.tsx')
    const card = source('web/features/vacancies/VacancyCard.tsx')

    expect(home).toContain('<VacancyCard')
    expect(card).toContain('<article className="vacancy-catalog-card">')
    expect(home).not.toContain('authenticated-home-vacancy-card')
  })

  test('mobile prioriza fluxo de app, ocupa a largura e compacta a lista', () => {
    const css = source('web/features/home/authenticated-home.css')

    expect(css).toContain('.authenticated-home-intro-copy{display:none}')
    expect(css).toContain('.authenticated-home-intro{min-height:0;padding:6px 3px 0;border-radius:0;background:transparent;gap:0}')
    expect(css).toContain('.authenticated-home-action small{display:none}')
    expect(css).toContain('.authenticated-home-section{padding:0 3px;gap:10px}')
    expect(css).toContain('.authenticated-home-areas-grid{grid-template-columns:1fr;gap:6px}')
    expect(css).toContain('.authenticated-home-area-card{min-height:58px;padding:10px}')
    expect(css).toContain('.authenticated-home-vacancies-surface .vacancies-grid{width:100%;margin:0}')
  })
  test('mobile move menu para o topo, abre drawer lateral e usa perfil no dock', () => {
    const header = source('web/components/layout/AppHeader.tsx')
    const css = source('web/app/header.css')

    expect(header).toContain('className="app-mobile-toggle"')
    expect(header).toContain("className={`app-mobile-profile-switcher ${profileOpen ? 'active' : ''}`}")
    expect(header).toContain('<span>Conta</span>')
    expect(header).toContain("target?.closest('.app-mobile-profile-switcher')")
    expect(header).not.toContain('<span>Mais</span>')
    expect(css).toContain('grid-template-columns: 36px minmax(0, 1fr) 36px 36px')
    expect(css).toContain('width: min(70vw, 276px)')
    expect(css).toContain('top: 56px')
    expect(css).toContain('left: 0')
    expect(css).toContain('bottom: calc(62px + env(safe-area-inset-bottom))')
    expect(css).not.toContain('!important')
    expect(header).toContain('<strong aria-label="DropZone"><span>Drop</span><span>Zone</span></strong>')
    expect(css).toContain('grid-column: 1')
    expect(css).toContain('.app-nav-dropdown > .app-nav-parent')
    expect(css).toContain('.app-nav-submenu a::before')
  })

})
