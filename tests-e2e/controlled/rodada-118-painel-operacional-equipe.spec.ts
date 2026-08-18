import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

test('painel de treino ganha filtros operacionais por evento mapa e período', async () => {
  const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
  expect(source).toContain('className="team-ops-filterbar"')
  expect(source).toContain('<span>Evento</span>')
  expect(source).toContain('<span>Mapa</span>')
  expect(source).toContain('<span>Período</span>')
  expect(source).toContain('trainingMapFilter')
  expect(source).toContain('filterTrainingByMap(scopeTrainingPeriod(training, trainingPerformancePeriod), trainingMapFilter)')
})

test('evento ativo abre automaticamente e mantém recorte do mapa isolado', async () => {
  const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
  expect(source).toContain('setTrainingExpanded(trainings[0].campeonato_equipe_id)')
  expect(source).toContain("setTrainingMapFilter('all')")
  expect(source).toContain('trainingMapOptions')
})

test('indicadores principais exibem métricas operacionais relevantes', async () => {
  const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
  expect(source).toContain('team-training-kpis team-ops-kpis')
  for (const metric of ['Quedas', 'Colocação média', 'Booyahs', 'Pontos', 'Abates', 'Dano', 'Assistências', 'Revives']) {
    expect(source).toContain(`<small>${metric}</small>`)
  }
})

test('gráficos principais ficam visíveis antes das análises avançadas', async () => {
  const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
  const charts = source.indexOf('className="team-ops-charts"')
  const advanced = source.indexOf('className="team-training-analytics team-training-advanced"')
  expect(charts).toBeGreaterThan(-1)
  expect(advanced).toBeGreaterThan(charts)
  expect(source).toContain('title="Colocação"')
  expect(source).toContain('title="Kills"')
  expect(source).toContain('title="Dano"')
})

test('layout operacional responde em desktop e mobile', async () => {
  const css = read('web/app/globals.css')
  expect(css).toContain('body .team-ops-filterbar{')
  expect(css).toContain('body .team-ops-kpis{')
  expect(css).toContain('body .team-ops-chart-grid{grid-template-columns:repeat(3,minmax(0,1fr))}')
  expect(css).toContain('@media(max-width:760px)')
})
