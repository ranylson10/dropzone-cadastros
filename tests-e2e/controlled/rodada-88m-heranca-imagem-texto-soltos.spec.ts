import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const types = read('web/features/campeonatos/stream/types/stream-package.types.ts')
const editor = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
const config = read('web/features/campeonatos/stream/services/stream-package-config.ts')

test('88M tipa exceções pontuais de imagem e texto soltos sem criar configuração paralela', async () => {
  expect(types).toContain('export type StreamPackageLooseOverrides')
  expect(types).toContain('image?: Partial<StreamLooseImageConfig>')
  expect(types).toContain('text?: Partial<StreamLooseTextConfig>')
  expect(types).toContain('looseOverrides?: StreamPackageLooseOverrides')
})

test('88M renderer resolve herança do pacote antes da exceção da cena', async () => {
  expect(config).toContain('...pack.shared_config.looseImage, ...(resolveStreamOverlayConfig(pack, type).looseOverrides?.image || {})')
  expect(config).toContain('...pack.shared_config.looseText, ...(resolveStreamOverlayConfig(pack, type).looseOverrides?.text || {})')
  expect(stage).toContain('looseImage.show && eventLogo')
  expect(stage).toContain('looseText.show')
})

test('88M editor permite exceção somente no campo alterado', async () => {
  expect(editor).toContain("function patchActiveLoose<K extends 'image' | 'text'>")
  expect(editor).toContain("[section]: { ...(current[section] || {}), ...patch }")
  expect(editor).toContain('Imagem e título soltos')
  expect(editor).toContain('Logo e título herdam posição e estilo do pacote')
})

test('88M editor permite voltar à herança sem copiar valores globais', async () => {
  expect(editor).toContain("clearActiveLoose('image')")
  expect(editor).toContain("clearActiveLoose('text')")
  expect(editor).toContain('Herdar imagem')
  expect(editor).toContain('Herdar título')
  expect(editor).toContain('looseOverrides: Object.keys(next).length ? next : undefined')
})

test('88M mantém assets e estrutura como mecanismos separados', async () => {
  expect(types).toContain('assetOverrides?: Partial<Record<StreamPackageAssetKey, string>>')
  expect(types).toContain('structureOverrides?: StreamPackageStructureOverrides')
  expect(types).toContain('looseOverrides?: StreamPackageLooseOverrides')
  expect(editor).toContain('Exceções do kit visual')
  expect(editor).toContain('Exceções estruturais')
})

test('88M não recria editor livre ou blocos legados', async () => {
  expect(editor).not.toContain('StreamOverlayEditor')
  expect(editor).not.toContain('StreamLiveStage')
  expect(stage).not.toContain('blocks')
  expect(stage).not.toContain('share_token')
})
