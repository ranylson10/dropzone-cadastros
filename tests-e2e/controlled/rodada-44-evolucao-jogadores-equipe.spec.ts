import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const panel = path.resolve(process.cwd(), 'web/features/dropzone/panels/equipe/EquipePanel.tsx')
const css = path.resolve(process.cwd(), 'web/app/globals.css')

test('rodada 44 cria evolução do elenco com duas janelas de cinco quedas', async () => {
  const source = fs.readFileSync(panel, 'utf8')
  expect(source).toContain('function buildSquadPlayerEvolution')
  expect(source).toContain('history.rows.slice(-5)')
  expect(source).toContain('history.rows.slice(-10, -5)')
  expect(source).toContain("'growing' | 'stable' | 'declining' | 'insufficient'")
})

test('rodada 44 combina kills dano e sobrevivência para classificar tendência', async () => {
  const source = fs.readFileSync(panel, 'utf8')
  expect(source).toContain('score += compare(killsAtual')
  expect(source).toContain('score += compare(danoAtual')
  expect(source).toContain('score += compare(sobrevivenciaAtual')
  expect(source).toContain("score >= 2 ? 'growing'")
  expect(source).toContain("score <= -2 ? 'declining'")
})

test('rodada 44 mostra destaques mapa arma e mantém leitura compacta', async () => {
  const source = fs.readFileSync(panel, 'utf8')
  const styles = fs.readFileSync(css, 'utf8')
  expect(source).toContain('Evolução do elenco')
  expect(source).toContain('Mais evoluiu')
  expect(source).toContain('Ponto de atenção')
  expect(source).toContain('melhor mapa')
  expect(source).toContain('arma eficiente')
  expect(styles).toContain('.team-squad-evolution-row')
  expect(styles).toContain('@media(max-width:760px)')
})
