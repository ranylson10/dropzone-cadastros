import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('overlay config possui exceções estruturais tipadas e pontuais', () => {
  const source = read('web/features/campeonatos/stream/types/stream-package.types.ts')
  expect(source).toContain('export type StreamPackageStructureOverrides')
  expect(source).toContain('layout?: Partial<StreamSharedLayoutConfig>')
  expect(source).toContain('table?: Partial<StreamSharedTableConfig>')
  expect(source).toContain('card?: Partial<StreamSharedCardConfig>')
})

test('renderer mescla pacote com exceção da cena sem duplicar configuração', () => {
  const source = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
  expect(source).toContain('resolveStreamTableConfig(props.pack, props.type, props.outputProfileId)')
  expect(source).toContain('resolveStreamCardConfig(props.pack, props.type, props.outputProfileId)')
  expect(source).toContain('resolveStreamLayoutConfig(props.pack, props.type, outputProfileId)')
})

test('editor apresenta herança estrutural como regra padrão', () => {
  const source = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
  expect(source).toContain('Exceções estruturais')
  expect(source).toContain('Herdar layout')
  expect(source).toContain('Herdar tabela')
  expect(source).toContain('Herdar cards')
})

test('edição individual altera somente o campo escolhido', () => {
  const source = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
  expect(source).toContain("patchActiveStructure('layout', { offsetX:")
  expect(source).toContain("patchActiveStructure('table', { rowHeight:")
  expect(source).toContain("patchActiveStructure('card', { width:")
})

test('limpeza de exceção remove seção e volta ao pacote', () => {
  const source = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')
  expect(source).toContain('delete next[section]')
  expect(source).toContain('structureOverrides: Object.keys(next).length ? next : undefined')
})

test('88L não cria migration, API ou renderer paralelo', () => {
  const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
  expect(stage).toContain('function TableRenderer')
  expect(stage).toContain('function CardRenderer')
  expect(stage).toContain('function HeroRenderer')
  expect(stage).not.toContain('SceneTableRenderer')
})
