import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 26 — Diário com horários como grupos independentes', () => {
  test('Diário ganha Horários antes da Revisão', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("{ id: 'matches' as const, label: 'Quedas' }")
    expect(form).toContain("{ id: 'format' as const, label: 'Horários' }")
  })

  test('cada horário fica dentro da Fase 1 oculta', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("nome: 'Fase 1'")
    expect(form).toContain('oculta: true')
    expect(form).toContain('diario_horarios: schedules')
    expect(form).toContain('Adicionar horário')
  })

  test('capacidade é por horário e numero_vagas vira total comercial', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('diario_equipes_por_horario?: string')
    expect(form).toContain('const totalVacancies = capacity * schedules.length')
    expect(form).toContain('numero_vagas: String(totalVacancies)')
    expect(form).toContain('Equipes por horário')
  })

  test('estrutura cria grupos nomeados pelos horários', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("const isHiddenDailyPhase = form.tipo === 'diario' && index === 0")
    expect(panel).toContain('oculta: isHiddenDailyPhase')
    expect(panel).toContain('groupNameForSchedule')
  })

  test('API preserva horários e fase oculta', () => {
    const api = source('web/app/api/dropzone/route.ts')
    expect(api).toContain('diarioHorarios')
    expect(api).toContain("...((item as any)?.oculta === true ? { oculta: true } : {})")
    expect(api).toContain('{ diario_horarios: diarioHorarios }')
  })

  test('tela de grupos oculta o cabeçalho da Fase 1', () => {
    const structure = source('web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx')
    expect(structure).toContain('const phaseHidden = Boolean')
    expect(structure).toContain('Cada horário abaixo é um grupo independente')
  })

  test('horários duplicados não avançam', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Os horários do Diário não podem se repetir.')
  })
})
