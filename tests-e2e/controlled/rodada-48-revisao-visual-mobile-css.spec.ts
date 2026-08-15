import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const cssPath = path.join(root, 'web/app/globals.css')

function trainingCss(source: string) {
  const start = source.indexOf('/* Rodada 31 — Treinos privados no painel da equipe. */')
  expect(start).toBeGreaterThan(-1)
  return source.slice(start)
}

test('rodada 48 limpa escapes literais antigos da telemetria sem criar override final', async () => {
  const source = fs.readFileSync(cssPath, 'utf8')
  const styles = trainingCss(source)
  expect(styles).not.toContain('\\nbody .team-training-telemetry')
  expect(styles).toContain('/* Rodada 35 — telemetria privada da Garena por jogador/queda. */')
  expect(styles).toContain('body .team-training-telemetry{display:grid')
  expect(styles).not.toContain('/* Rodada 48')
})

test('rodada 48 compacta o fluxo principal do treino na origem', async () => {
  const styles = trainingCss(fs.readFileSync(cssPath, 'utf8'))
  expect(styles).toContain('.team-trainings-tab{display:grid;gap:14px}')
  expect(styles).toContain('gap:12px;\n  padding:2px 2px 14px;')
  expect(styles).toContain('.team-training-kpis>article{display:grid;gap:3px;padding:9px 8px')
  expect(styles).toContain('.team-training-technical-summary{display:grid;gap:7px;padding-top:0}')
  expect(styles).toContain('.team-training-advanced-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0')
})

test('rodada 48 deixa controles e kpis compactos no mobile sem esconder acesso', async () => {
  const styles = trainingCss(fs.readFileSync(cssPath, 'utf8'))
  expect(styles).toContain('.team-training-summary{grid-template-columns:32px minmax(0,1fr) 46px 18px;gap:7px;padding:9px 0}')
  expect(styles).toContain('.team-training-period-actions{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:end;width:100%;gap:8px}')
  expect(styles).toContain('.team-training-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}')
  expect(styles).toContain('.team-training-technical-summary-grid>article{padding:7px}')
  expect(styles).toContain('.team-training-advanced-toggle{padding:8px 0}')
})
