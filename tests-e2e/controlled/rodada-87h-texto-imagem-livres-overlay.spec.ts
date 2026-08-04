import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87H — texto e imagem livres no overlay', () => {
  test('expõe atalhos de texto e imagem no editor', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')
    expect(editor).toContain('data-testid="stream-add-free-text"')
    expect(editor).toContain('data-testid="stream-add-free-image"')
    expect(editor).toContain("addStandaloneLayer('text')")
    expect(editor).toContain("addStandaloneLayer('image')")
  })

  test('cria itens livres como camadas editáveis e animáveis', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')
    expect(editor).toContain("const nextCard: StreamCardBlock = { ...card, layers: [layer] }")
    expect(editor).toContain('setSelectedLayerId(layer.id)')
    expect(editor).toContain('previewSceneTransition')
    expect(editor).toContain('...overlay.blocks.map')
  })

  test('imagem livre preserva upload e ajuste de encaixe', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')
    expect(editor).toContain("objectFit: isText ? undefined : 'contain'")
    expect(editor).toContain('Imagem livre (upload PC)')
    expect(editor).toContain('Ajuste da imagem')
  })
})
