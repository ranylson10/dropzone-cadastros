import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const types = read('web/features/campeonatos/stream/types/stream-package.types.ts')
const config = read('web/features/campeonatos/stream/services/stream-package-config.ts')
const outputs = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
const css = read('web/features/campeonatos/stream/stream.css')

test('89E modela prancha contínua com quantidade direção e tamanho de cada fatia', () => {
  expect(types).toContain("export type StreamOutputSliceDirection = 'horizontal' | 'vertical'")
  expect(types).toContain('sliceCount: number')
  expect(types).toContain('sliceWidth: number')
  expect(types).toContain('sliceHeight: number')
  expect(outputs).toContain('Tamanho de cada fatia')
  expect(outputs).toContain('Prancha total')
})

test('89E fundo pertence à prancha inteira e guias apenas marcam os cortes', () => {
  expect(outputs).toContain('O fundo continua único na prancha inteira')
  expect(outputs).toContain('stream-output-slice-guide')
  expect(outputs).toContain('stream-output-slice-label')
  expect(css).toContain('.stream-output-slice-guide.is-horizontal')
  expect(css).toContain('.stream-output-slice-guide.is-vertical')
})

test('89E mantém áreas livres e ranges independentes em qualquer fatia', () => {
  expect(outputs).toContain('Adicionar área')
  expect(outputs).toContain('next.items.slice(start, end)')
  expect(outputs).toContain('activeArea.dataStart')
  expect(outputs).toContain('activeArea.dataEnd')
  expect(outputs).toContain('activeArea.x')
  expect(outputs).toContain('activeArea.y')
})

test('89E adiciona modo limpo por área sem duplicar renderer', () => {
  expect(types).toContain("export type StreamOutputAreaContentMode = 'full' | 'clean'")
  expect(outputs).toContain('Limpo · só conteúdo dinâmico')
  expect(outputs).toContain("contentOnly={props.area.contentMode === 'clean'}")
  expect(stage).toContain('contentOnly?: boolean')
  expect(stage).toContain('!props.contentOnly && looseText.show')
  expect(outputs).not.toContain('StreamOutputStage')
})

test('89E preserva layouts antigos ao normalizar novos campos de fatiamento', () => {
  expect(config).toContain('const legacyWidth')
  expect(config).toContain('const legacyHeight')
  expect(config).toContain('source.sliceCount')
  expect(config).toContain("source.sliceDirection === 'vertical'")
  expect(config).toContain("contentMode: row.contentMode === 'clean' ? 'clean' : 'full'")
})

test('89E não cria tabela ou migration nova para carrossel e conteúdo limpo', () => {
  expect(types).toContain('areas: StreamOutputArea[]')
  expect(config).toContain('normalizeStreamOutputLayouts')
  expect(outputs).toContain('patchSlices')
  expect(outputs).not.toContain('/api/stream/output-layouts')
})
