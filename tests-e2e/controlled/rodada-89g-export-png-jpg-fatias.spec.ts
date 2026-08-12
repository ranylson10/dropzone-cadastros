import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const editor = readFileSync(resolve(root, 'web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx'), 'utf8')
const exporter = readFileSync(resolve(root, 'web/features/campeonatos/stream/services/stream-output-export.ts'), 'utf8')
const css = readFileSync(resolve(root, 'web/features/campeonatos/stream/stream.css'), 'utf8')

test('89G exporta a prancha na resolução real sem depender do zoom da prévia', () => {
  expect(editor).toContain('return renderStreamOutputCanvas(activeLayout, entries)')
  expect(editor).toContain('stream-output-export-canvas')
  expect(css).toContain('.stream-output-export-host')
  expect(exporter).toContain('canvas.width = width')
  expect(exporter).toContain('canvas.height = height')
})

test('89G suporta PNG e JPG e baixa a prancha inteira', () => {
  expect(editor).toContain('Baixar imagem')
  expect(editor).toContain('activeLayout.outputFormat')
  expect(exporter).toContain("format === 'jpg' ? 'image/jpeg' : 'image/png'")
  expect(exporter).toContain('downloadStreamOutputBlob')
})

test('89G fatia carrossel horizontal ou vertical e empacota múltiplas imagens em ZIP', () => {
  expect(editor).toContain("activeLayout.sliceDirection === 'horizontal'")
  expect(editor).toContain("activeLayout.sliceDirection === 'vertical'")
  expect(editor).toContain('cropStreamOutputCanvas')
  expect(editor).toContain('new JSZip()')
  expect(editor).toContain('imagens (.zip)')
  expect(editor).toContain("zip.generateAsync({ type: 'blob' })")
})

test('89G remove elementos de edição e espera os dados antes de renderizar', () => {
  expect(editor).toContain('interactive={false}')
  expect(editor).toContain('data-stream-export-area')
  expect(editor).toContain("data-ready={ready ? 'true' : 'false'}")
  expect(exporter).toContain('waitForExportAreas')
  expect(exporter).toContain('document.fonts?.ready')
})

test('89G preserva transparência no PNG e usa branco quando JPG não tem fundo', () => {
  expect(editor).toContain("activeLayout.backgroundType === 'transparent' && activeLayout.outputFormat === 'jpg' ? '#ffffff' : 'transparent'")
  expect(exporter).toContain("mime = format === 'jpg' ? 'image/jpeg' : 'image/png'")
})

test('89G incorpora imagens e estilos computados para reutilizar o mesmo renderer DOM', () => {
  expect(exporter).toContain('cloneWithComputedStyles')
  expect(exporter).toContain('fetchAsDataUrl')
  expect(exporter).toContain('XMLSerializer')
  expect(editor).toContain('<StreamPackageStage')
})
