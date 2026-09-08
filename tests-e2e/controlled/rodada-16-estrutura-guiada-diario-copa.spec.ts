import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 16 — estrutura guiada de Diário e Copa', () => {
  test('Diário pede apenas equipes e fixa grupo/jogo único', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain('function updateGuidedDaily')
    expect(form).toContain('diario_horarios')
    expect(form).toContain("nome: 'Fase 1'")
    expect(form).toContain("grupos: '1'")
    expect(form).toContain("format: 'Grupo único / jogo único'")
    expect(form).toContain('Cada horário funciona como um grupo independente.')
  })

  test('Copa pergunta entrada, tamanho do grupo e classificados', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain('Como começa esta Copa?')
    expect(form).toContain('Equipes inscritas')
    expect(form).toContain('Equipes por grupo')
    expect(form).toContain('Avançam por grupo')
    expect(form).toContain('guidedCupPlan')
  })

  test('Copa monta progressão automaticamente até a final', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("nome: 'Final'")
    expect(form).toContain('const qualified = groups * advance')
    expect(form).toContain('championship-guided-flow')
    expect(form).toContain('classificadas')
  })

  test('criação guiada não mostra editor técnico de fases para Copa ou Diário', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')

    expect(form).toContain("mode === 'create' && (value.tipo === 'diario' || value.tipo === 'copa')")
    expect(form).toContain("hidden={!pageVisible('format')}")
    expect(form).toContain("hidden={!pageVisible('matches')}")
    expect(form).toContain("As fases iniciais serão criadas automaticamente.")
  })

  test('layout da nova etapa continua compacto no mobile', () => {
    const css = source('web/app/globals.css')

    expect(css).toContain('.championship-guided-question-grid{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px')
    expect(css).toContain('.championship-guided-flow-step{ position:relative; display:grid')
    expect(css).toContain('.championship-guided-question-grid{ grid-template-columns:1fr')
  })
})
