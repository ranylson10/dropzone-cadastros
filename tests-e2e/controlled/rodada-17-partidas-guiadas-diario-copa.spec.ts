import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 17 — partidas guiadas de Diário e Copa', () => {
  test('adiciona Partidas entre Estrutura e Operação para Diário e Copa', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("{ id: 'matches' as const, label: 'Final' }")
    expect(form).toContain("{ id: 'matches' as const, label: 'Quedas' }")
    expect(form).toContain("{ id: 'format' as const, label: 'Fases e grupos' }")
    expect(form).toContain("{ id: 'format' as const, label: 'Horários' }")
    expect(form).toContain("{ id: 'operation', label: 'Vagas e prêmio' }")
  })

  test('Diário pergunta somente quantas partidas terá o jogo', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Quantas quedas terá este jogo?')
    expect(form).toContain('Quedas no jogo')
    expect(form).toContain("value={value.partidas_por_jogo || '4'}")
    expect(form).toContain('1 jogo · {value.partidas_por_jogo')
  })

  test('Copa separa partidas padrão e partidas da Final', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('partidas_por_jogo?: string')
    expect(form).toContain('partidas_final?: string')
    expect(form).toContain("partidas_por_jogo: type === 'diario' || type === 'copa' || type === 'xtreino'")
    expect(form).toContain('${value.partidas_por_jogo || \'—\'} quedas por jogo nas fases')
    expect(form).toContain("{(value.final_dias_config || []).map((day) => `Dia ${day.dia}: ${day.quedas} quedas`)")
  })

  test('Copa calcula jogos e total de partidas a partir da estrutura', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('function guidedCupPlan')
    expect(form).toContain('const groups = Math.max(1, Math.ceil(teams / perGroup))')
    expect(form).toContain('const qualified = groups * advance')
    expect(form).toContain('guidedCupPlan(total, perGroup, advance)')
    expect(form).toContain('aria-label="Progressão calculada da Copa"')
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
