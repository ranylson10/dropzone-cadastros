import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 29 hotfix — pontuação no campeonato vazio', () => {
  test('emptyChampionship nasce com a pontuação oficial Garena completa', () => {
    const home = source('web/features/dropzone/DropZoneHome.tsx')

    expect(home).toContain("sistema_pontuacao_tipo: 'garena' as const")
    expect(home).toContain("sistema_pontuacao_nome: 'Oficial Garena'")
    expect(home).toContain("pontuacao_equipes_por_partida: '12'")
    expect(home).toContain("pontos_colocacao: ['12', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0', '0']")
    expect(home).toContain("pontos_por_abate: '1'")
  })
})
