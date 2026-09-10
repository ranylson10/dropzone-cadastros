import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (file: string) => readFileSync(resolve(root, file), 'utf8')

test.describe('Rodada 133 — catálogo de vagas unificado', () => {
  test('home, vagas e afiliado compartilham um único card comercial', () => {
    const card = read('web/features/vacancies/VacancyCard.tsx')
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const vacancies = read('web/app/vagas/page.tsx')
    const affiliate = read('web/app/vendedores/[managerId]/page.tsx')

    expect(card).toContain('<article className="vacancy-catalog-card">')
    expect(card).toContain('vacancy-catalog-cover')
    expect(card).toContain('vacancy-catalog-facts')
    expect(card).toContain('vacancy-catalog-actions')
    for (const consumer of [home, vacancies, affiliate]) {
      expect(consumer).toContain('<VacancyCard')
      expect(consumer).not.toContain('<article className="vacancy-catalog-card">')
    }
  })

  test('catálogo vem antes de agenda, token e cadastros na home', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const catalog = home.indexOf('authenticated-home-catalog')
    const priority = home.indexOf('authenticated-home-priority-section')
    const token = home.indexOf('authenticated-home-token')
    const accounts = home.indexOf('id="meus-cadastros"')

    expect(catalog).toBeGreaterThan(0)
    expect(priority).toBeGreaterThan(catalog)
    expect(token).toBeGreaterThan(priority)
    expect(accounts).toBeGreaterThan(token)
  })

  test('landing e card público legados não continuam como alternativas', () => {
    expect(existsSync(resolve(root, 'web/features/home/PublicChampionshipHome.tsx'))).toBeFalsy()
    expect(read('web/features/home/AuthenticatedHomeFeed.tsx')).not.toContain('home-champ-card')
  })
})
