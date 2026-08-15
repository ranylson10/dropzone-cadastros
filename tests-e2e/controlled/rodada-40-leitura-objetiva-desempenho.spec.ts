import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 40 — leitura objetiva automática de desempenho', () => {
  test('jogador recebe pontos fortes e atenção por regras transparentes', async () => {
    const source = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
    expect(source).toContain('const objectiveReading = useMemo')
    expect(source).toContain('Leitura objetiva')
    expect(source).toContain('Pontos fortes')
    expect(source).toContain('Pontos de atenção')
    expect(source).toContain('Arma mais eficiente')
    expect(source).toContain('Sobrevivência × resultado')
    expect(source).toContain('map.partidas >= 2')
    expect(source).toContain("recent.partidas >= 3")
  })

  test('equipe usa as mesmas regras sem IA generativa nem persistência nova', async () => {
    const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(source).toContain('buildTrainingObjectiveReading')
    expect(source).toContain('Mapa mais consistente')
    expect(source).toContain('Mapa para revisar')
    expect(source).toContain('row.usos >= 3')
    expect(source).toContain('Regras transparentes aplicadas somente aos dados privados deste treino.')
  })

  test('layout mantém leitura simples e responsiva', async () => {
    const css = read('web/app/globals.css')
    expect(css).toContain('Rodada 40 — leitura objetiva automática de desempenho')
    expect(css).toContain('.performance-objective-columns')
    expect(css).toContain('grid-template-columns:1fr 1fr')
    expect(css).toContain('@media(max-width:760px)')
  })
})
