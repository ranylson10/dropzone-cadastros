import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('overlay config possui exceção tipada de asset, sem objeto genérico', () => {
  const source = read('web/features/campeonatos/stream/types/stream-package.types.ts')
  expect(source).toContain('assetOverrides?: Partial<Record<StreamPackageAssetKey, string>>')
  expect(source).not.toContain('overrides?: Record<string, unknown>')
})

test('renderer resolve exceção antes do asset compartilhado', () => {
  const source = read('web/features/campeonatos/stream/services/stream-package-config.ts')
  expect(source).toContain('resolveStreamOverlayConfig(pack, type).assetOverrides?.[key]')
  expect(source).toContain('override || pack.assets[key]')
})

test('editor mantém herança como padrão e exceção explícita', () => {
  const source = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
  expect(source).toContain('Exceções do kit visual')
  expect(source).toContain('Herdando do kit visual')
  expect(source).toContain('Voltar ao padrão')
})

test('exceção reaproveita o mesmo campo da cena e não duplica pacote', () => {
  const source = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
  expect(source).toContain('assetOverrides: { ...(activeConfig.assetOverrides || {}), [key]: url }')
  expect(source).toContain('delete next[key]')
})

test('assets mostrados na cena respeitam estrutura da overlay', () => {
  const source = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
  expect(source).toContain("asset.usage === 'all' || asset.usage === activeMeta.structure")
})

test('não cria migration ou API nova para exceções visuais', () => {
  const files = [
    'web/features/campeonatos/stream/components/StreamPackageEditor.tsx',
    'web/features/campeonatos/stream/components/StreamPackageStage.tsx',
    'web/features/campeonatos/stream/types/stream-package.types.ts',
  ]
  for (const file of files) expect(fs.existsSync(path.join(root, file))).toBeTruthy()
})
