import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 17 — partidas guiadas de Diário e Copa', () => {
  test('adiciona Partidas entre Estrutura e Operação para Diário e Copa', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("{ id: 'matches' as const, label: 'Partidas' }")
    const createWizard = form.slice(
      form.indexOf(": [\n        { id: 'origin', label: 'Início' }"),
      form.indexOf("const currentPageIndex"),
    )
    expect(createWizard.indexOf("label: 'Estrutura'")).toBeLessThan(createWizard.indexOf("label: 'Partidas'"))
    expect(createWizard.indexOf("label: 'Partidas'")).toBeLessThan(createWizard.indexOf("label: 'Operação'"))
  })

  test('Diário pergunta somente quantas partidas terá o jogo', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Quantas partidas terá este jogo?')
    expect(form).toContain('Partidas no jogo')
    expect(form).toContain("value={value.partidas_por_jogo || '4'}")
    expect(form).toContain('1 jogo · {value.partidas_por_jogo')
  })

  test('Copa separa partidas padrão e partidas da Final', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Quantas partidas terá cada jogo da Copa?')
    expect(form).toContain('Partidas por jogo nas fases')
    expect(form).toContain('Partidas na Final')
    expect(form).toContain('value.partidas_final')
  })

  test('Copa calcula jogos e total de partidas a partir da estrutura', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('championship-guided-match-flow')
    expect(form).toContain('const games = Math.max(1, Number(phase.grupos || 1))')
    expect(form).toContain('games * matches')
    expect(form).toContain('Total previsto')
  })

  test('modelo e season reaproveitam configuração de partidas quando existir', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("'partidas_por_jogo', 'partidas_final'")
    expect(form).toContain('partidas_por_jogo?: string')
    expect(form).toContain('partidas_final?: string')
  })

  test('mobile empilha os campos e mantém resumo compacto', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.championship-guided-question-grid.two{ grid-template-columns:1fr')
    expect(css).toContain('.championship-guided-match-row{ grid-template-columns:minmax(0,1fr) auto')
    expect(css).toContain('.championship-guided-match-flow{ display:grid')
  })
})
