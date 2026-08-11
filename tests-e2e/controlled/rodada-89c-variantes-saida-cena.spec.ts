import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const types = read('web/features/campeonatos/stream/types/stream-package.types.ts')
const config = read('web/features/campeonatos/stream/services/stream-package-config.ts')
const editor = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')

test('89C centraliza perfis Stream, Social e PNG e inclui saída PNG 4K transparente', () => {
  expect(types).toContain("kind: 'stream'")
  expect(types).toContain("kind: 'social'")
  expect(types).toContain("{ id: 'png-4k', label: 'PNG 4K · transparente', width: 3840, height: 2160, kind: 'png' }")
  expect(types).toContain('export type StreamOutputProfileId')
})

test('89C guarda somente exceções por formato dentro da configuração existente da cena', () => {
  expect(types).toContain('export type StreamPackageOutputVariantConfig')
  expect(types).toContain('outputVariants?: Partial<Record<StreamOutputProfileId, StreamPackageOutputVariantConfig>>')
  expect(editor).toContain('outputVariants: { ...(stored.outputVariants || {}), [canvasProfileId]: {} }')
})

test('89C mantém live-hd como base e mescla variante sem criar renderer paralelo', () => {
  expect(config).toContain("outputProfileId: StreamOutputProfileId = 'live-hd'")
  expect(config).toContain("if (outputProfileId === 'live-hd') return base")
  expect(config).toContain('const variant = stored.outputVariants?.[outputProfileId]')
  expect(stage).toContain("const outputProfileId = props.outputProfileId || 'live-hd'")
  expect(stage).toContain('outputProfileId={outputProfileId}')
})

test('89C herda assets, estrutura e elementos soltos antes da exceção do formato', () => {
  expect(config).toContain('const assetOverrides = { ...(base.assetOverrides || {}), ...(variant.assetOverrides || {}) }')
  expect(config).toContain('const layout = { ...(base.structureOverrides?.layout || {}), ...(variant.structureOverrides?.layout || {}) }')
  expect(config).toContain('const image = { ...(base.looseOverrides?.image || {}), ...(variant.looseOverrides?.image || {}) }')
})

test('89C editor mostra quando formato herda a live e permite criar ou remover variante', () => {
  expect(editor).toContain('Herdando a cena base da live')
  expect(editor).toContain('Criar variante')
  expect(editor).toContain('Remover variante')
  expect(editor).toContain("editingOutputVariant ? 'Herdar cena base' : 'Restaurar padrão'")
})

test('89C não cria migration ou API nova para as variantes de saída', () => {
  expect(config).toContain('allowedProfiles')
  expect(config).toContain("profileId !== 'live-hd'")
  expect(editor).toContain('overlay_configs:')
  expect(editor).toContain('overlay_configs: pack.overlay_configs')
})
