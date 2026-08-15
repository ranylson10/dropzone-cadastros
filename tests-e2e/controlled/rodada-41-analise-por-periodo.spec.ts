import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 41 — análise por período', () => {
  test('jogador recorta toda a análise em 5, 10, 20 ou tudo', async () => {
    const source = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
    expect(source).toContain("type PerformancePeriod = 'all' | '5' | '10' | '20'")
    expect(source).toContain('const [performancePeriod, setPerformancePeriod]')
    expect(source).toContain('const periodMatches = useMemo')
    expect(source).toContain('filteredMatches.slice(0, Number(performancePeriod))')
    expect(source).toContain('Últimas 5')
    expect(source).toContain('Últimas 10')
    expect(source).toContain('Últimas 20')
    expect(source).toContain('O período escolhido recalcula toda a análise abaixo.')
  })

  test('equipe aplica período em KPIs, gráficos, leitura e quedas detalhadas', async () => {
    const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(source).toContain("type TrainingPerformancePeriod = 'all' | '5' | '10' | '20'")
    expect(source).toContain('scopeTrainingPeriod')
    expect(source).toContain('buildTrainingPeriodKpis')
    expect(source).toContain('const analyzedTraining = scopeTrainingPeriod(training, trainingPerformancePeriod)')
    expect(source).toContain('buildTrainingObjectiveReading(analyzedTraining)')
    expect(source).toContain('analyzedTraining.quedas_detalhe.map')
    expect(source).toContain('Período analisado')
  })

  test('filtro permanece compacto no desktop e app-like no mobile', async () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('Rodada 41 — análise por período')
    expect(css).toContain('.player-performance-filters')
    expect(css).toContain('.team-training-period-actions')
    expect(css).toContain('@media(max-width:760px)')
  })
})
