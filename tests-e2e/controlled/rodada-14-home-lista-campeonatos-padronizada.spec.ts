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

  test('Home reutiliza o mesmo renderer de cards da aba Campeonatos', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const directory = read('web/features/directory/components/DirectoryListClient.tsx')

    expect(home).toContain("import { DirectoryListClient } from '@/features/directory/components/DirectoryListClient'")
    expect(home).toContain("import '@/features/directory/components/championship-directory.css'")
    expect(home).toContain('<DirectoryListClient items={championshipItems} cardsOnly />')
    expect(directory).toContain('cardsOnly = false')
    expect(directory).toContain('const isChampionshipDirectory = cardsOnly ||')
    expect(directory).toContain('directory-champ-card-grid')
    expect(directory).toContain('directory-champ-card')
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

  test('preview da Home preserva largura do container e o mobile do diretório', () => {
    const homeCss = read('web/features/home/authenticated-home.css')
    const directoryCss = read('web/features/directory/components/championship-directory.css')

    expect(homeCss).toContain('.authenticated-home-directory-preview .directory-champ-card-grid{')
    expect(homeCss).toContain('width:100%')
    expect(directoryCss).toContain('.directory-champ-card-grid{grid-template-columns:1fr;gap:7px;width:calc(100% - 20px)}')
    expect(directoryCss).toContain('.directory-champ-card{display:grid;grid-template-columns:96px minmax(0,1fr);min-height:126px;border-radius:8px}')
  })
})
