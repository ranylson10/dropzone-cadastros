import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 36 — gráficos privados do XTreino', () => {
  test('painel calcula evolução diretamente das quedas privadas', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('buildTrainingAnalytics')
    expect(panel).toContain('drop.jogadores_detalhados')
    expect(panel).toContain('sobrevivencia_segundos')
    expect(panel).toContain('Evolução do treino')
  })

  test('mostra gráficos de colocação kills dano e sobrevivência', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('title="Colocação"')
    expect(panel).toContain('title="Kills"')
    expect(panel).toContain('title="Dano"')
    expect(panel).toContain('title="Sobrevivência"')
    expect(panel).toContain('lowerIsBetter')
  })

  test('comparativos usam mapa e call anotada da própria equipe', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain("mapas: summarize((drop) => drop.mapa_codigo")
    expect(panel).toContain("calls: summarize((drop) => drop.call_nome")
    expect(panel).toContain('Por mapa')
    expect(panel).toContain('Por call')
    expect(panel).toContain('Somente calls anotadas pela própria equipe.')
  })

  test('gráfico não precisa de biblioteca externa ou nova consulta pública', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('<svg viewBox=')
    expect(panel).toContain('team-training-chart-line')
    expect(panel).not.toContain("from 'recharts'")
  })

  test('mobile empilha gráficos e reduz comparativo', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.team-training-chart-grid{display:grid;grid-template-columns:repeat(2')
    expect(css).toContain('.team-training-chart-grid{grid-template-columns:1fr}')
    expect(css).toContain('.team-training-breakdown-list>article>span:nth-child(4)')
  })
})
