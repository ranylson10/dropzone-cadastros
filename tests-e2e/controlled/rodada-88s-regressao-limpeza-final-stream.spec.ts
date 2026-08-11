import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const currentWebFiles = [
  'web/app/api/broadcast/control/[token]/route.ts',
  'web/app/api/broadcast/me/route.ts',
  'web/app/api/broadcast/obs/[token]/route.ts',
  'web/app/api/campeonatos/[id]/stream/pack/route.ts',
  'web/app/broadcast/control/[token]/page.tsx',
  'web/app/broadcast/obs/[token]/page.tsx',
  'web/features/broadcast/components/StreamDashboard.tsx',
  'web/features/campeonatos/stream/components/CampeonatoStreamTab.tsx',
  'web/features/campeonatos/stream/components/StreamPackageEditor.tsx',
  'web/features/campeonatos/stream/components/StreamPackageStage.tsx',
  'web/features/campeonatos/stream/services/stream-package-config.ts',
  'web/features/campeonatos/stream/services/stream-package-data.service.ts',
  'web/features/campeonatos/stream/services/stream-package-public.service.ts',
  'web/features/campeonatos/stream/types/stream-package.types.ts',
]

const currentWebSource = currentWebFiles.map(read).join('\n')

test('88S runtime atual não referencia arquitetura livre removida', () => {
  expect(currentWebSource).not.toContain('campeonato_stream_overlays')
  expect(currentWebSource).not.toContain('selected_overlay_ids')
  expect(currentWebSource).not.toContain('active_overlay_id')
  expect(currentWebSource).not.toContain('StreamOverlayEditor')
  expect(currentWebSource).not.toContain('StreamLiveStage')
})

test('88S rotas e componentes legados continuam fisicamente removidos', () => {
  const removed = [
    'web/app/api/broadcast/sessions/route.ts',
    'web/app/api/stream/live/[token]/route.ts',
    'web/app/api/stream/catalog/route.ts',
    'web/app/api/campeonatos/[id]/stream/overlays/route.ts',
    'web/app/stream/live/[token]/page.tsx',
    'web/app/campeonatos/[id]/stream/overlays/novo/page.tsx',
    'web/features/campeonatos/stream/components/StreamOverlayEditor.tsx',
    'web/features/campeonatos/stream/components/StreamOverlaysHub.tsx',
    'web/features/campeonatos/stream/components/StreamLiveStage.tsx',
    'web/features/campeonatos/stream/services/stream-catalog.service.ts',
  ]
  for (const file of removed) expect(exists(file), file).toBe(false)
})

test('88S mantém pacote oficial como fonte única de configuração e renderização', () => {
  const config = read('web/features/campeonatos/stream/services/stream-package-config.ts')
  const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
  expect(config).toContain('normalizeStreamOverlayPackage')
  expect(config).toContain('resolveStreamOverlayConfig')
  expect(config).toContain('resolveStreamAsset')
  expect(stage).toContain('function TableRenderer(')
  expect(stage).toContain('function CardRenderer(')
  expect(stage).toContain('function HeroRenderer(')
})

test('88S OBS e controlador usam somente tipo oficial de cena', () => {
  const controlApi = read('web/app/api/broadcast/control/[token]/route.ts')
  const obsApi = read('web/app/api/broadcast/obs/[token]/route.ts')
  const obsPage = read('web/app/broadcast/obs/[token]/page.tsx')
  expect(controlApi).toContain('active_overlay_type')
  expect(obsApi).toContain('active_overlay_type')
  expect(obsPage).toContain('StreamPackageStage')
  expect(controlApi).not.toContain('active_overlay_id')
  expect(obsApi).not.toContain('active_overlay_id')
})

test('88S fluxo operacional final preserva preview, estados e bloqueio de redundância', () => {
  const page = read('web/app/broadcast/control/[token]/page.tsx')
  expect(page).toContain('broadcast-output-state')
  expect(page).toContain('broadcast-output-preview')
  expect(page).toContain('id === activeId')
  expect(page).toContain('campeonatoId === activeChampId')
  expect(page).toContain('0 limpa · 1–9 cenas · Esc fecha menus')
})

test('88S não reintroduz CSS operacional legado concorrente', () => {
  const css = read('web/features/broadcast/broadcast.css')
  expect(css).toContain('.broadcast-output-state')
  expect(css).toContain('.broadcast-output-preview')
  expect(css).toContain('.broadcast-scenes-summary')
  expect(css).not.toContain('.broadcast-control-grid')
  expect(css).not.toContain('.broadcast-control-card')
})
