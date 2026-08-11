import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test('88R evita comandos redundantes para live e cena já ativas', () => {
  const page = read('web/app/broadcast/control/[token]/page.tsx')
  expect(page).toContain('campeonatoId === activeChampId')
  expect(page).toContain('id === activeId')
  expect(page).toContain('disabled={busy || active}')
  expect(page).toContain('disabled={busy || onAir}')
})

test('88R expõe estado confirmado ou pendente da saída', () => {
  const page = read('web/app/broadcast/control/[token]/page.tsx')
  expect(page).toContain("const outputStatus = pendingLive ? 'Trocando live…'")
  expect(page).toContain('broadcast-output-state')
  expect(page).toContain('Saída confirmada')
})

test('88R resume posição e estrutura da cena atual', () => {
  const page = read('web/app/broadcast/control/[token]/page.tsx')
  expect(page).toContain('activeSceneNumber')
  expect(page).toContain('activeStructureLabel')
  expect(page).toContain('broadcast-scenes-current')
})

test('88R marca semanticamente a cena atual', () => {
  const page = read('web/app/broadcast/control/[token]/page.tsx')
  expect(page).toContain("aria-current={!activeId ? 'true' : undefined}")
  expect(page).toContain("aria-current={onAir ? 'true' : undefined}")
})

test('88R mantém atalhos operacionais sem criar camada nova de controle', () => {
  const page = read('web/app/broadcast/control/[token]/page.tsx')
  expect(page).toContain('0 limpa · 1–9 cenas · Esc fecha menus')
  expect(page).not.toContain('/api/broadcast/control-v2')
  expect(page).not.toContain('BroadcastControlV2')
})

test('88R consolida estilos do polimento no broadcast css existente', () => {
  const css = read('web/features/broadcast/broadcast.css')
  expect(css).toContain('.broadcast-onair-status')
  expect(css).toContain('.broadcast-output-state')
  expect(css).toContain('.broadcast-scenes-summary')
  expect(css).toContain('.broadcast-scenes-current')
})
