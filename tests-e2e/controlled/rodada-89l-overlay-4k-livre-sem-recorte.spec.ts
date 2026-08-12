import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('89L fixa postagens em overlay 4K completa e remove seletores de variante/conteúdo', async () => {
  const editor = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
  expect(editor).toContain("profileId: 'png-4k'")
  expect(editor).toContain("contentMode: 'full'")
  expect(editor).toContain('Overlay 4K completa')
  expect(editor).not.toContain('<label>Variante visual')
  expect(editor).not.toContain('<label>Conteúdo da área')
  expect(editor).toContain('outputProfileId="png-4k"')
  expect(editor).toContain('contentOnly={false}')
})

test('89L remove caixa visual e clipping interno da overlay de postagem', async () => {
  const css = read('web/features/campeonatos/stream/stream.css')
  const renderer = read('web/features/campeonatos/stream/services/stream-output-canvas-renderer.ts')
  expect(css).toContain('.stream-output-area-preview{position:absolute;overflow:visible;border:0;background:transparent}')
  expect(css).toContain('.stream-output-area-preview.is-selected{border:0;box-shadow:none;')
  expect(renderer).not.toContain('context.rect(area.x, area.y, area.width, area.height); context.clip()')
  expect(renderer).toContain('entry.area.width / profile.width')
})

test('89L mantém largura geral como escala proporcional e sem altura editável', async () => {
  const editor = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
  expect(editor).toContain('Largura geral da overlay')
  expect(editor).toContain('largura geral funciona como escala proporcional')
  expect(editor).not.toContain('Manter proporção ao redimensionar')
})
