import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 42 — evolução longa de desempenho', () => {
  test('jogador compara trajetória em blocos completos de 5 e 10', async () => {
    const source = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
    expect(source).toContain('buildPlayerLongEvolution')
    expect(source).toContain('buildPlayerLongEvolution(periodMatches, 5)')
    expect(source).toContain('buildPlayerLongEvolution(periodMatches, 10)')
    expect(source).toContain('Evolução longa')
    expect(source).toContain('Crescimento')
    expect(source).toContain('Amostra insuficiente')
  })

  test('equipe usa o mesmo recorte selecionado para evolução longa', async () => {
    const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(source).toContain('buildTrainingLongEvolution')
    expect(source).toContain('buildTrainingLongEvolution(analyzedTraining, 5)')
    expect(source).toContain('buildTrainingLongEvolution(analyzedTraining, 10)')
    expect(source).toContain('Blocos completos reduzem o peso de uma queda isolada')
  })

  test('classificação de trajetória exige sinais e tolerância objetiva', async () => {
    const player = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
    const team = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(player).toContain("normalized >= 0.25 ? 'crescimento'")
    expect(player).toContain("normalized <= -0.25 ? 'queda'")
    expect(team).toContain("normalized >= 0.25 ? 'crescimento'")
    expect(team).toContain("normalized <= -0.25 ? 'queda'")
  })

  test('layout fica compacto no desktop e reduz colunas no mobile', async () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('Rodada 42 — evolução longa em blocos')
    expect(css).toContain('.performance-long-evolution-groups')
    expect(css).toContain('@media(max-width:760px)')
  })
})
