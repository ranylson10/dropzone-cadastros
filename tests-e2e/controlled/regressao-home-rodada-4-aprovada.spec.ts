import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Regressão — Home acumulada após padronização de Campeonatos', () => {
  test('home usa tokens dark/gold e não o tema vermelho/branco antigo', () => {
    const css = read('web/features/home/authenticated-home.css')

    expect(css).toContain('--home-bg:var(--ui-bg,#0c0d0f)')
    expect(css).toContain('--home-surface:var(--ui-surface,#141518)')
    expect(css).toContain('--home-accent:var(--ui-accent,#c9b766)')
    expect(css).not.toContain('--home-accent:#ef3340')
    expect(css).not.toContain('--home-card:#fff')
    expect(css).not.toContain('--home-paper:#f3f1ec')
  })

  test('contadores foram removidos e atalhos permanecem leves', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const css = read('web/features/home/authenticated-home.css')

    expect(home).not.toContain('authenticated-home-overview')
    expect(home).not.toContain('championshipsCount')
    expect(home).not.toContain('registrationsCount')
    expect(css).not.toContain('.authenticated-home-overview{')
    expect(css).toContain('.authenticated-home-primary-actions{')
    expect(css).toContain('grid-template-columns:1fr 1fr')
    expect(css).toContain('background:transparent')
  })

  test('oportunidades usam o card comercial canônico da página de vagas', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const vacancyCard = read('web/features/vacancies/VacancyCard.tsx')

    expect(home).toContain('<VacancyCard')
    expect(home).not.toContain('authenticated-home-vacancy-card')
    expect(vacancyCard).toContain('<article className="vacancy-catalog-card">')
  })

  test('mobile preserva o fluxo compacto aprovado', () => {
    const css = read('web/features/home/authenticated-home.css')

    expect(css).toContain('.authenticated-home-intro-copy{display:none}')
    expect(css).toContain('.authenticated-home-section{padding:0 3px;gap:10px}')
    expect(css).toContain('.authenticated-home-vacancies-surface .vacancies-grid{width:100%;margin:0}')
  })
})
