import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87H1 — elementos livres no canvas', () => {
  test('texto e imagem usam o frame inteiro em vez de um bloco pequeno', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')
    const types = source('web/features/campeonatos/stream/types/stream.types.ts')

    expect(types).toContain('freeCanvas?: boolean')
    expect(editor).toContain("createEmptyCard('Elementos livres'")
    expect(editor).toContain('canvasW: frameSize.w')
    expect(editor).toContain('canvasH: frameSize.h')
    expect(editor).toContain('x: 48 + offset')
    expect(editor).toContain('y: 48 + offset')
  })

  test('reutiliza um único canvas transparente para os elementos livres', () => {
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')

    expect(editor).toContain('Boolean(block.freeCanvas)')
    expect(editor).toContain('layers: [...block.layers, layer]')
    expect(editor).toContain("fill: { mode: 'none', color: 'transparent' }")
  })
})
