import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 87K — conteúdo interno e início da tabela', () => {
  test('camadas aceitam deslocamento independente do conteúdo', () => {
    const types = source('web/features/campeonatos/stream/types/stream.types.ts')
    const canvas = source('web/features/campeonatos/stream/components/CardLayerCanvas.tsx')
    const editor = source('web/features/campeonatos/stream/components/StreamOverlayEditor.tsx')

    expect(types).toContain('contentOffsetX?: number')
    expect(types).toContain('contentOffsetY?: number')
    expect(canvas).toContain('contentTransform')
    expect(editor).toContain('Mover somente o conteúdo')
    expect(editor).toContain('Centralizar conteúdo')
  })

  test('posição inicial desloca também fontes sem coluna de posição', () => {
    const canvas = source('web/features/campeonatos/stream/components/StreamTableCanvas.tsx')
    const sidebar = source('web/features/campeonatos/stream/components/editor/TableSidebarPanel.tsx')

    expect(canvas).toContain('sourceRows[Math.max(0, startRank - 1) + item.dataIndex]')
    expect(sidebar).toContain('Começar na posição')
    expect(sidebar).toContain('Quantidade de linhas')
  })
})
