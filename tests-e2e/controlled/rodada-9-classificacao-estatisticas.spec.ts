import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 9 — classificação e estatísticas', () => {
  test('prioriza resumo, classificação e MVP', () => {
    const source = read('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')
    expect(source).toContain('Classificação e estatísticas')
    expect(source).toContain('champ-stats-summary')
    expect(source).toContain('<small>equipes</small>')
    expect(source).toContain('<small>quedas</small>')
    expect(source).toContain('<small>pts líder</small>')
    expect(source).toContain('<small>kills MVP</small>')
  })

  test('filtros e compartilhamento ficam progressivos', () => {
    const source = read('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')
    expect(source).toContain('<details className="champ-stats-filters">')
    expect(source).toContain('<details className="champ-stats-share">')
    expect(source).toContain('Compartilhar resultado')
  })

  test('classificação usa linhas operacionais em vez da tabela antiga', () => {
    const source = read('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')
    expect(source).toContain('champ-stats-ranking-row')
    expect(source).toContain('champ-stats-points')
    expect(source).not.toContain('statistics-table statistics-table-compact statistics-table-ranking')
    expect(source).not.toContain('statistics-table statistics-table-compact statistics-table-mvp')
  })

  test('mobile mantém classificação e MVP compactos', () => {
    const css = read('web/features/campeonatos/estatisticas/campeonato-estatisticas.css')
    expect(css).toContain('@media(max-width:760px)')
    expect(css).toContain('min-height:54px')
    expect(css).toContain('grid-template-columns:42px minmax(0,1fr) 32px 32px 34px 46px')
    expect(css).toContain('grid-template-columns:42px minmax(0,1fr) 38px 44px 48px')
    expect(css).not.toContain('box-shadow:')
    expect(css).not.toContain('backdrop-filter:')
  })
})
