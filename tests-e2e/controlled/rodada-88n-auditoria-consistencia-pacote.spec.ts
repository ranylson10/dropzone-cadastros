import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const config = read('web/features/campeonatos/stream/services/stream-package-config.ts')
const editor = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')

test('88N centraliza normalização do pacote em uma única origem', async () => {
  expect(config).toContain('export function normalizeStreamOverlayPackage')
  expect(editor).toContain('normalizeStreamOverlayPackage(props.campeonatoId, json.pack || {})')
  expect(editor).not.toContain('function mergePackage(')
  expect(editor).not.toContain('function defaultPackage(')
})

test('88N centraliza resolução de herança e exceções', async () => {
  expect(config).toContain('export function resolveStreamAsset')
  expect(config).toContain('export function resolveStreamLayoutConfig')
  expect(config).toContain('export function resolveStreamTableConfig')
  expect(config).toContain('export function resolveStreamCardConfig')
  expect(config).toContain('export function resolveStreamLooseImageConfig')
  expect(config).toContain('export function resolveStreamLooseTextConfig')
})

test('88N renderer não mantém resolvers concorrentes locais', async () => {
  expect(stage).toContain('resolveStreamAsset(props.pack, props.type')
  expect(stage).toContain('resolveStreamTableConfig(props.pack, props.type, props.outputProfileId)')
  expect(stage).toContain('resolveStreamCardConfig(props.pack, props.type, props.outputProfileId)')
  expect(stage).not.toContain('function resolveTableConfig(')
  expect(stage).not.toContain('function resolveCardConfig(')
  expect(stage).not.toContain('function asset(')
})

test('88N editor usa os mesmos resolvers do renderer', async () => {
  expect(editor).toContain('resolveStreamOverlayConfig(pack, activeType, canvasProfileId)')
  expect(editor).toContain('resolveStreamLooseImageConfig(pack, activeType, canvasProfileId)')
  expect(editor).toContain('resolveStreamLooseTextConfig(pack, activeType, canvasProfileId)')
  expect(editor).toContain('resolveStreamLayoutConfig(pack, activeType, canvasProfileId)')
  expect(editor).toContain('resolveStreamTableConfig(pack, activeType, canvasProfileId)')
  expect(editor).toContain('resolveStreamCardConfig(pack, activeType, canvasProfileId)')
})

test('88N normalização elimina chaves de asset e cenas fora do modelo oficial', async () => {
  expect(config).toContain('const STREAM_PACKAGE_ASSET_KEYS: StreamPackageAssetKey[]')
  expect(config).toContain('STREAM_SYSTEM_OVERLAYS.map((type) => [type, normalizeOverlayConfig(type, rawOverlayConfigs[type])])')
  expect(config).toContain('assets: normalizeAssetMap(pack?.assets)')
  expect(config).not.toContain('overlay_configs: {\n      ...DEFAULT_STREAM_OVERLAY_CONFIGS,\n      ...rawOverlayConfigs')
})

test('88N mantém somente os três renderers centrais e não reintroduz legado', async () => {
  expect(stage).toContain('function TableRenderer(')
  expect(stage).toContain('function CardRenderer(')
  expect(stage).toContain('function HeroRenderer(')
  expect(stage).not.toContain('StreamOverlayEditor')
  expect(stage).not.toContain('StreamLiveStage')
  expect(stage).not.toContain('blocks')
  expect(stage).not.toContain('share_token')
})
