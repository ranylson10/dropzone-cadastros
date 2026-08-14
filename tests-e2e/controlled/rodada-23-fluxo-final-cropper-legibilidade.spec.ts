import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 23 — fluxo, final, cropper e legibilidade', () => {
  test('Copa usa ordem gerais, vagas/prêmio, fases/grupos, final e revisão', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("{ id: 'operation', label: 'Vagas e prêmio' }")
    expect(form).toContain("{ id: 'format' as const, label: 'Fases e grupos' }")
    expect(form).toContain("{ id: 'matches' as const, label: 'Final' }")
  })

  test('Diário pula fases/grupos e vai para Quedas', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain("{ id: 'matches' as const, label: 'Quedas' }")
  })

  test('seleção Paga usa estado explícito e revela o valor', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('inscricao_paga?: boolean')
    expect(form).toContain('inscricao_paga: isPaid')
    expect(form).toContain("className={value.inscricao_paga ? 'active' : ''}")
    expect(form).toContain('{value.inscricao_paga ? (')
  })

  test('vagas vêm antes da configuração de grupos', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Quantas vagas terá a Copa?')
    expect(form).toContain('Vagas disponíveis')
  })

  test('Final da Copa tem dias, quedas por dia configuráveis, formato e observações', () => {
    const form = source('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(form).toContain('Dias de Final')
    expect(form).toContain('final_dias_config')
    expect(form).toContain('Quedas neste dia')
    expect(form).toContain('Formato da Final')
    expect(form).toContain('Champion Point')
    expect(form).toContain('Point Rush')
    expect(form).toContain('Observações da Final (opcional)')
  })

  test('cropper desktop tem barra lateral de zoom com slider e reset', () => {
    const field = source('web/features/dropzone/components/form-fields.tsx')
    const system = source('web/app/system.css')
    expect(field).toContain('cropper-side-controls')
    expect(field).toContain('cropper-zoom-slider')
    expect(field).toContain('type="range"')
    expect(field).toContain('RotateCcw')
    expect(system).toContain('grid-template-columns:minmax(0,1fr) 74px')
    expect(system).toContain('writing-mode:vertical-lr')
  })

  test('textos do assistente ficam maiores no desktop', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('body .championship-guided-copy > small{font-size:12px')
    expect(css).toContain('body .championship-guided-decision-copy small{font-size:12px')
  })
})
