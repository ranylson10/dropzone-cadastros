import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const dashboard = read('web/features/broadcast/components/StreamDashboard.tsx')
const css = read('web/features/broadcast/broadcast.css')

test('88P cria checklist operacional sem nova API ou estado paralelo', async () => {
  expect(dashboard).toContain('const preflightItems = [')
  expect(dashboard).toContain("label: 'Mesa criada'")
  expect(dashboard).toContain("label: 'Browser Source'")
  expect(dashboard).toContain("label: 'Live selecionada'")
  expect(dashboard).toContain("label: 'Cenas do pacote'")
  expect(dashboard).not.toContain('/api/broadcast/preflight')
})

test('88P deriva prontidão somente da mesa, link OBS, live ativa e cenas já carregadas', async () => {
  expect(dashboard).toContain("ready: Boolean(desk)")
  expect(dashboard).toContain("ready: Boolean(obsUrl)")
  expect(dashboard).toContain("ready: Boolean(activeLive)")
  expect(dashboard).toContain('activeScenesCount > 0')
})

test('88P não afirma que o OBS externo está conectado', async () => {
  expect(dashboard).toContain('Checklist da mesa')
  expect(dashboard).toContain('Pronta para operar')
  expect(dashboard).not.toContain('OBS conectado')
  expect(dashboard).not.toContain('OBS online')
})

test('88P mostra progresso objetivo dos quatro itens', async () => {
  expect(dashboard).toContain('const readyCount = preflightItems.filter((item) => item.ready).length')
  expect(dashboard).toContain('{readyCount}/4 itens prontos')
  expect(dashboard).toContain('Configuração incompleta')
})

test('88P mantém o fluxo operacional da 88O e não reabre o editor', async () => {
  expect(dashboard).toContain('broadcast-operation-flow')
  expect(dashboard).toContain('Opere no controlador')
  expect(dashboard).not.toContain('StreamPackageEditor')
})

test('88P adiciona layout responsivo próprio sem duplicar estilos antigos', async () => {
  expect(css).toContain('.broadcast-preflight')
  expect(css).toContain('.broadcast-preflight-grid')
  expect(css).toContain('.broadcast-preflight-item.is-ready')
  expect(css).toContain('@media (max-width: 680px)')
})
