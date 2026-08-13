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

  test('campeonato continua sendo unidade visual, mas sem card elevado ou divisões internas', () => {
    const css = source('web/features/home/authenticated-home.css')

    expectRule(css, '.authenticated-home-vacancy-card', [
      'border:0',
      'background:var(--home-surface)',
      'box-shadow:none',
    ])
    expectRule(css, '.authenticated-home-vacancy-status', [
      'display:flex',
      'color:var(--home-muted)',
    ])
    expect(css).not.toContain('authenticated-home-vacancy-card:hover{transform:translateY')
  })

  test('mobile prioriza fluxo de app, ocupa a largura e compacta a lista', () => {
    const css = source('web/features/home/authenticated-home.css')

    expect(css).toContain('.authenticated-home-intro-copy{display:none}')
    expect(css).toContain('.authenticated-home-action small{display:none}')
    expect(css).toContain('.authenticated-home-overview{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:0 8px;overflow:visible}')
    expect(css).toContain('.authenticated-home-section{padding:0 8px;gap:10px}')
    expect(css).toContain('.authenticated-home-access-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:0;padding:0;overflow:visible}')
    expect(css).toContain('.authenticated-home-access-card small{display:none}')
    expect(css).toContain('.authenticated-home-vacancy-grid{grid-template-columns:1fr;gap:7px}')
    expect(css).toContain('.authenticated-home-vacancy-card{display:grid;grid-template-columns:92px minmax(0,1fr);grid-template-rows:1fr auto;min-height:128px}')
    expect(css).toContain('.authenticated-home-vacancy-card footer{grid-column:2;grid-row:2;gap:8px;padding:3px 10px 9px}')
  })
})
