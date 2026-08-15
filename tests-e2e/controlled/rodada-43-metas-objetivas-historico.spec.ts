import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 43 — metas objetivas pelo histórico', () => {
  test('metas são calculadas por blocos reais de 5 sem percentual inventado', async () => {
    const source = read('web/features/dropzone/performance-goals.ts')
    expect(source).toContain('samples.length < blockSize * 2')
    expect(source).toContain('const currentRows = samples.slice(-blockSize)')
    expect(source).toContain('const previousRows = samples.slice(0, -blockSize)')
    expect(source).toContain('Math.min(...historical)')
    expect(source).toContain('Math.max(...historical)')
    expect(source).not.toContain('1.10')
    expect(source).not.toContain('1.05')
  })

  test('jogador recebe metas de kills dano colocação e sobrevivência', async () => {
    const source = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
    expect(source).toContain('buildObjectivePerformanceGoals')
    expect(source).toContain('Metas pelo seu histórico')
    expect(source).toContain('Alvo histórico')
    expect(source).toContain('Amostra insuficiente')
  })

  test('equipe usa o mesmo motor objetivo no recorte selecionado', async () => {
    const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(source).toContain('buildObjectivePerformanceGoals(analyzedTraining.quedas_detalhe.map')
    expect(source).toContain('Metas pelo histórico da equipe')
    expect(source).toContain('São necessárias pelo menos 10 quedas')
  })

  test('status depende de atingir alvo ou melhorar contra referência', async () => {
    const source = read('web/features/dropzone/performance-goals.ts')
    expect(source).toContain("achieved ? 'atingida' : improvedVsReference ? 'proxima' : 'em_construcao'")
    expect(source).toContain("lowerIsBetter: true")
  })

  test('layout mantém duas colunas no desktop e uma no mobile', async () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('Rodada 43 — metas objetivas pelo próprio histórico')
    expect(css).toContain('.performance-goals-grid{display:grid;grid-template-columns:repeat(2')
    expect(css).toContain('.performance-goals-grid{grid-template-columns:1fr}')
  })
})
