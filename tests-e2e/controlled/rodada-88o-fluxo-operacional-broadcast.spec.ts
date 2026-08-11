import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const control = read('web/app/broadcast/control/[token]/page.tsx')
const dashboard = read('web/features/broadcast/components/StreamDashboard.tsx')
const css = read('web/features/broadcast/broadcast.css')

test('88O deixa claro que a operação acontece no controlador e não no editor', async () => {
  expect(control).toContain('Troque a live e coloque as cenas no ar sem voltar ao editor.')
  expect(dashboard).toContain('Troque live e cena sem abrir o editor.')
  expect(control).not.toContain('StreamPackageEditor')
})

test('88O mostra estado real da saída OBS com live e cena atuais', async () => {
  expect(control).toContain('const activeOverlay = useMemo(')
  expect(control).toContain("const sceneLabel = activeOverlay?.name || 'Tela limpa'")
  expect(control).toContain('broadcast-onair')
  expect(control).toContain('SAÍDA OBS')
})

test('88O oferece atalhos 0 e 1–9 sem criar outro sistema de cenas', async () => {
  expect(control).toContain("if (event.key === '0')")
  expect(control).toContain("if (!/^[1-9]$/.test(event.key)) return")
  expect(control).toContain('const overlay = overlays[Number(event.key) - 1]')
  expect(control).toContain('void selectOverlay(overlay.id)')
})

test('88O bloqueia comandos concorrentes durante troca de live ou cena', async () => {
  expect(control).toContain('const busy = pendingOverlay || pendingLive')
  expect(control).toContain('if (busy || campeonatoId === activeChampId)')
  expect(control).toContain('if (busy || !activeChampId || id === activeId) return')
  expect(control).toContain('disabled={busy}')
})

test('88O documenta no painel o fluxo fixo chave, OBS e controlador', async () => {
  expect(dashboard).toContain('broadcast-operation-flow')
  expect(dashboard).toContain('Adicione a live')
  expect(dashboard).toContain('Configure o OBS uma vez')
  expect(dashboard).toContain('Opere no controlador')
})

test('88O remove CSS legado do controlador antigo em vez de empilhar estilos', async () => {
  expect(css).toContain('.broadcast-onair')
  expect(css).toContain('.broadcast-operation-flow')
  expect(css).not.toContain('.broadcast-control-grid')
  expect(css).not.toContain('.broadcast-control-card')
})
