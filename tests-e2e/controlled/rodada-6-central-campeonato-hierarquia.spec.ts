import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 6 — Central do Campeonato', () => {
  test('central prioriza operação e reduz métricas soltas', () => {
    const source = read('web/components/campeonatos/ChampionshipCentral.tsx')

    expect(source).toContain("import './championship-central.css'")
    expect(source).toContain("['Pendências', String(pendingTotal)")
    expect(source).toContain('O que precisa de atenção agora')
    expect(source).toContain('<h3>Alertas</h3>')
    expect(source).not.toContain('Alertas inteligentes</h3>')
    expect(source).not.toContain('championship-central-alert-dashboard')
  })

  test('filtros, histórico e logs ficam como informação progressiva', () => {
    const source = read('web/components/campeonatos/ChampionshipCentral.tsx')

    expect(source).toContain('<details className="championship-central-alert-more">')
    expect(source).toContain('<summary>Filtros</summary>')
    expect(source).toContain('<details className="championship-central-alert-history">')
    expect(source).toContain('<details className="championship-central-logs">')
  })

  test('estilos da Central foram consolidados fora do globals', () => {
    const globals = read('web/app/globals.css')
    const central = read('web/components/campeonatos/championship-central.css')

    expect(globals).not.toContain('.championship-central-header')
    expect(globals).not.toContain('.championship-choice-panel')
    expect(globals).not.toContain('.smart-alert-actions')
    expect(central).toContain('.championship-central-page')
    expect(central).toContain('.championship-central-grid')
    expect(central).toContain('.championship-choice-panel')
    expect(central).toContain('@media(max-width:820px)')
  })

  test('mobile usa quase toda a largura e mantém indicadores compactos', () => {
    const central = read('web/components/campeonatos/championship-central.css')

    expect(central).toContain('width:calc(100% - 6px)')
    expect(central).toContain('grid-template-columns:repeat(2,minmax(0,1fr))')
    expect(central).toContain('.smart-alert-actions')
    expect(central).toContain('grid-column:2')
  })
})
