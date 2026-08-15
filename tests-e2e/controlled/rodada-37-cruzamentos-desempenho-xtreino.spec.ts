import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 37 — cruzamentos privados de desempenho do XTreino', () => {
  test('calcula correlações sem nova consulta ou banco', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('pearsonCorrelation')
    expect(panel).toContain('buildTrainingCrossAnalytics')
    expect(panel).toContain('Dano × kills')
    expect(panel).toContain('Kills × colocação')
    expect(panel).toContain('Sobrevivência × colocação')
  })

  test('explica correlação como tendência e não causalidade', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('Serve como pista de tendência, não como causa automática.')
    expect(panel).toContain('Dados insuficientes')
    expect(panel).toContain('quedas comparadas')
  })

  test('agrega desempenho por jogador e por mapa da telemetria privada', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('Desempenho por jogador')
    expect(panel).toContain('player.mapa')
    expect(panel).toContain('kills/queda')
    expect(panel).toContain('dano/queda')
    expect(panel).toContain('player.sobrevivencia_segundos')
  })

  test('jogadores ficam recolhidos e mobile reduz colunas', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    const css = source('web/app/globals.css')
    expect(panel).toContain('<details key={player.chave}>')
    expect(css).toContain('.team-training-cross-grid{display:grid;grid-template-columns:repeat(3')
    expect(css).toContain('.team-training-cross-grid{grid-template-columns:1fr}')
    expect(css).toContain('summary>span:nth-of-type(3)')
  })
})
