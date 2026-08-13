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
    expect(css).toContain('.authenticated-home-access-grid{')
    expect(css).toContain('grid-template-columns:repeat(5,minmax(0,1fr))')
    expect(css).toContain('background:transparent')
  })

  test('oportunidades usam a mesma estrutura da aba Campeonatos', () => {
    const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
    const directory = read('web/features/directory/components/DirectoryListClient.tsx')

    expect(home).toContain('<DirectoryListClient items={championshipItems} cardsOnly />')
    expect(home).not.toContain('authenticated-home-vacancy-card')
    expect(directory).toContain('directory-champ-card-grid')
    expect(directory).toContain('directory-champ-card')
  })

  test('mobile preserva o fluxo compacto aprovado', () => {
    const css = read('web/features/home/authenticated-home.css')

    expect(css).toContain('.authenticated-home-intro-copy{display:none}')
    expect(css).toContain('.authenticated-home-section{padding:0 3px;gap:10px}')
    expect(css).toContain('.authenticated-home-directory-preview .directory-champ-card-grid{width:100%}')
  })
})
