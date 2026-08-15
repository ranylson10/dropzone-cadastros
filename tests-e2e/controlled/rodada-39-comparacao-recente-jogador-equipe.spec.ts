import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 39 — comparação histórica e momento recente', () => {
  test('jogador compara campeonatos e últimas partidas sem endpoint novo', async () => {
    const source = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
    expect(source).toContain('Momento recente')
    expect(source).toContain('Comparação por campeonato')
    expect(source).toContain('melhor leitura')
    expect(source).toContain('ponto de atenção')
    expect(source).toContain('chronological.slice(-5)')
    expect(source).toContain('championshipGroups')
  })

  test('equipe compara as 3 quedas recentes e detalha eficiência técnica', async () => {
    const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(source).toContain('buildTrainingRecentForm')
    expect(source).toContain('Últimas {recentForm.amostras} quedas')
    expect(source).toContain('K/uso')
    expect(source).toContain('{skill.usos} usos')
  })

  test('layout preserva leitura mobile sem criar cartões aninhados novos', async () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('Rodada 39 — comparação histórica e momento recente')
    expect(css).toContain('.player-performance-championship-list')
    expect(css).toContain('.team-training-recent-grid')
    expect(css).toContain('@media(max-width:760px)')
  })
})
