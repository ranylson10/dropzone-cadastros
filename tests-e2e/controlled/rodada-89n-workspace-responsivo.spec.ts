import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const editor = fs.readFileSync(path.join(root, 'web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/stream/stream.css'), 'utf8')

test('89N mede a largura real do editor em vez de depender apenas do viewport', () => {
  expect(editor).toContain("type OutputEditorLayout = 'wide' | 'medium' | 'narrow'")
  expect(editor).toContain('new ResizeObserver')
  expect(editor).toContain("width >= 1180 ? 'wide' : width >= 780 ? 'medium' : 'narrow'")
  expect(editor).toContain('ref={editorRef}')
  expect(editor).toContain('stream-output-editor is-${editorLayout}')
})

test('89N elimina overflow horizontal do painel de controles', () => {
  expect(css).toContain('.stream-output-editor{width:100%;max-width:100%;min-width:0;overflow:hidden}')
  expect(css).toContain('.stream-output-controls{min-width:0;overflow-y:auto;overflow-x:hidden}')
  expect(css).toContain('.stream-output-number-field input{width:100%;min-width:0;box-sizing:border-box}')
})

test('89N reorganiza o inspetor quando o espaço real fica apertado', () => {
  expect(css).toContain('.stream-output-editor.is-medium{grid-template-columns:minmax(150px,180px) minmax(270px,310px) minmax(0,1fr)}')
  expect(css).toContain('.stream-output-editor.is-medium .stream-output-elements{grid-column:1/-1')
  expect(css).toContain('.stream-output-editor.is-narrow{display:grid;grid-template-columns:minmax(0,1fr)}')
})

test('89N preserva campos utilizáveis em largura estreita', () => {
  expect(css).toContain('.stream-output-transform-grid>* ,.stream-package-quad-grid>*{min-width:0}')
  expect(css).toContain('@media(max-width:560px)')
  expect(css).toContain('.stream-output-editor.is-narrow .stream-output-transform-grid')
})
