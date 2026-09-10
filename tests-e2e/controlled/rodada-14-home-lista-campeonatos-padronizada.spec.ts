import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 14 — Home padronizada com lista de Campeonatos', () => {
  test('remove os quatro contadores da Home', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const dropzone = read('web/features/dropzone/DropZoneHome.tsx')
    const css = read('web/features/home/authenticated-home.css')

    expect(home).not.toContain('authenticated-home-overview')
    expect(home).not.toContain('championshipsCount')
    expect(home).not.toContain('teamsCount')
    expect(home).not.toContain('registrationsCount')
    expect(dropzone).not.toContain('championshipsCount={championships.length}')
    expect(dropzone).not.toContain('teamsCount={teams.length}')
    expect(dropzone).not.toContain('registrationsCount={registrations.length}')
    expect(css).not.toContain('.authenticated-home-overview{')
  })

  test('Home reutiliza o renderer comercial da página de vagas', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const vacancies = read('web/app/vagas/page.tsx')

    expect(home).toContain("from '@/features/vacancies/VacancyCard'")
    expect(home).toContain('<VacancyCard')
    expect(vacancies).toContain('<VacancyCard')
  })

  test('remove o segundo sistema visual de cards da Home', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const css = read('web/features/home/authenticated-home.css')

    expect(home).not.toContain('authenticated-home-vacancy-card')
    expect(home).not.toContain('authenticated-home-vacancy-media')
    expect(css).not.toContain('.authenticated-home-vacancy-card{')
    expect(css).not.toContain('.authenticated-home-vacancy-grid{')
    expect(css).not.toContain('.authenticated-home-vacancy-media{')
  })

  test('preview da Home preserva largura do container e o mobile do catálogo', () => {
    const homeCss = read('web/features/home/authenticated-home.css')
    const vacancyCss = read('web/app/vagas/vagas.css')

    expect(homeCss).toContain('.authenticated-home-vacancies-surface .vacancies-grid{width:100%;margin:0}')
    expect(homeCss).toContain('.authenticated-home-vacancies-loading{grid-template-columns:1fr}')
    expect(vacancyCss).toContain('@media(max-width:900px){.vacancies-grid{grid-template-columns:1fr}')
  })
})
