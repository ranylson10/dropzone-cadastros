import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panel = path.join(root, 'web/features/dropzone/panels/equipe/EquipePanel.tsx')
const css = path.join(root, 'web/app/globals.css')

test('rodada 47 coloca resumo técnico antes das análises avançadas', async () => {
  const source = fs.readFileSync(panel, 'utf8')
  const summary = source.indexOf('Resumo técnico')
  const advanced = source.indexOf('Análises avançadas')
  expect(summary).toBeGreaterThan(-1)
  expect(advanced).toBeGreaterThan(summary)
  expect(source).toContain('Trajetória')
  expect(source).toContain('Equilíbrio da line')
  expect(source).toContain('Melhor contexto')
  expect(source).toContain('Elenco')
})

test('rodada 47 reaproveita leituras existentes sem criar nova análise', async () => {
  const source = fs.readFileSync(panel, 'utf8')
  expect(source).toContain('longEvolution5.status')
  expect(source).toContain('squadSynergy.balance')
  expect(source).toContain('tacticalContexts.best')
  expect(source).toContain('squadPlayerEvolution.destaque')
  expect(source).toContain('objectiveReading.strengths[0]')
  expect(source).toContain('objectiveReading.attentions[0]')
})

test('rodada 47 recolhe análises avançadas por padrão e mantém mobile compacto', async () => {
  const source = fs.readFileSync(panel, 'utf8')
  const styles = fs.readFileSync(css, 'utf8')
  expect(source).toContain('<details className="team-training-analytics team-training-advanced">')
  expect(source).not.toContain('<details open className="team-training-analytics team-training-advanced">')
  expect(styles).toContain('.team-training-advanced:not([open])>*:not(summary){display:none}')
  expect(styles).toContain('.team-training-technical-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}')
  expect(styles).toContain('@media(max-width:620px)')
})
