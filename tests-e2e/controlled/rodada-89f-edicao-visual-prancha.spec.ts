import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const outputs = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const types = read('web/features/campeonatos/stream/types/stream-package.types.ts')
const config = read('web/features/campeonatos/stream/services/stream-package-config.ts')
const css = read('web/features/campeonatos/stream/stream.css')

test('89F permite selecionar mover e redimensionar área direto na prancha', () => {
  expect(outputs).toContain("mode: 'move' | 'resize'")
  expect(outputs).toContain('beginAreaInteraction')
  expect(outputs).toContain('moveAreaInteraction')
  expect(outputs).toContain('stream-output-area-resize-handle')
  expect(css).toContain('.stream-output-area-preview.is-selected')
})

test('89F mantém proporção opcional persistida por área', () => {
  expect(types).toContain('lockAspect: boolean')
  expect(config).toContain('lockAspect: row.lockAspect === true')
  expect(outputs).toContain('Manter proporção ao redimensionar')
  expect(outputs).toContain('if (original.lockAspect)')
})

test('89F oferece snap nas bordas e guias de fatia sem criar grade paralela', () => {
  expect(outputs).toContain('const [snapEnabled, setSnapEnabled] = useState(true)')
  expect(outputs).toContain('snapCoordinate')
  expect(outputs).toContain('activeLayout.sliceWidth')
  expect(outputs).toContain('activeLayout.sliceHeight')
  expect(outputs).not.toContain('stream_output_snap_guides')
})

test('89F permite teclado duplicação e ordenação de camadas', () => {
  expect(outputs).toContain("event.key.toLowerCase() === 'd'")
  expect(outputs).toContain("event.shiftKey ? 10 : 1")
  expect(outputs).toContain('duplicateArea')
  expect(outputs).toContain('moveAreaLayer')
  expect(outputs).toContain('Trazer para frente')
  expect(outputs).toContain('Mandar para trás')
})

test('89F mostra preview da prancha inteira ou de uma fatia individual', () => {
  expect(outputs).toContain('activeSliceIndex')
  expect(outputs).toContain('Prancha')
  expect(outputs).toContain('Fatia {index + 1}')
  expect(outputs).toContain('stream-output-preview-viewport')
  expect(outputs).toContain('sliceOffsetX')
  expect(outputs).toContain('sliceOffsetY')
})

test('89F continua usando StreamPackageStage e a mesma prancha persistida', () => {
  expect(outputs).toContain('<StreamPackageStage')
  expect(outputs).toContain('contentOnly={props.area.contentMode === \'clean\'}')
  expect(outputs).not.toContain('StreamOutputCanvasRenderer')
  expect(types).toContain('areas: StreamOutputArea[]')
})
