import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function source(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test.describe('Rodada 87G — editor visual de overlays', () => {
  test('permite mover camadas diretamente e pelo teclado', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')
    const canvas = source('web/features/campeonatos/stream/components/CardLayerCanvas.tsx')

    expect(editor).toContain('startLayerMove')
    expect(editor).toContain('moveSelectedLayerByKeyboard')
    expect(editor).toContain("e.shiftKey ? 10 : 1")
    expect(canvas).toContain('onLayerPointerDown')
  })

  test('oferece alças visuais de redimensionamento', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')
    const canvas = source('web/features/campeonatos/stream/components/CardLayerCanvas.tsx')
    const css = source('web/features/campeonatos/stream/stream.css')

    expect(editor).toContain('startLayerResize')
    expect(canvas).toContain('stream-layer-resize-handle')
    expect(css).toContain('.stream-layer-resize-handle.is-se')
  })

  test('teste de cena alcança todos os blocos do overlay', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')

    expect(editor).toContain('previewSceneTransition')
    expect(editor).toContain('...overlay.blocks.map')
    expect(editor).toContain('data-testid="stream-preview-scene"')
    expect(editor).toContain('scenePreview')
  })

  test('aplica identidade grafite, cinza e dourado sem sombras decorativas nos painéis', () => {
    const css = source('web/features/campeonatos/stream/stream.css')

    expect(css).toContain('--stream-editor-bg: #8b8f94')
    expect(css).toContain('--stream-editor-graphite: #1b1e23')
    expect(css).toContain('--stream-editor-gold: #cfa820')
    expect(css).toContain('box-shadow: none')
  })
})
