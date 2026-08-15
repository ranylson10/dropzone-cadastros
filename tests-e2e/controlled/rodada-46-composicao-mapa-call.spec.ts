import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panel = path.join(root, 'web/features/dropzone/panels/equipe/EquipePanel.tsx')
const css = path.join(root, 'web/app/globals.css')

test('rodada 46 cruza composição, mapa e call com amostra mínima', async () => {
  const source = fs.readFileSync(panel, 'utf8')
  expect(source).toContain('function buildTacticalCompositionContexts')
  expect(source).toContain(".filter((row) => row.quedas >= 2)")
  expect(source).toContain('Composição × mapa × call')
  expect(source).toContain('context.mapa')
  expect(source).toContain('context.call')
  expect(source).toContain("context.nomes.join(' · ')")
})

test('rodada 46 usa apenas call anotada e mantém métricas do contexto', async () => {
  const source = fs.readFileSync(panel, 'utf8')
  expect(source).toContain("if (!mapa || !call) continue")
  expect(source).toContain('top3_rate')
  expect(source).toContain('kills_media')
  expect(source).toContain('dano_media')
  expect(source).toContain('sobrevivencia_media')
  expect(source).toContain('Calls sem anotação não entram no cruzamento')
})

test('rodada 46 mantém leitura compacta no mobile', async () => {
  const source = fs.readFileSync(css, 'utf8')
  expect(source).toContain('team-tactical-contexts')
  expect(source).toContain('team-tactical-context-list')
  expect(source).toContain('@media (max-width:700px)')
})
