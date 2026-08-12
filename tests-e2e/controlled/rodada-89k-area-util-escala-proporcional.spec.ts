import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const outputs = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const canvas = read('web/features/campeonatos/stream/services/stream-output-canvas-renderer.ts')
const css = read('web/features/campeonatos/stream/stream.css')

test.describe('Rodada 89K/89L — escala proporcional sem recorte artificial', () => {
  test('mantém largura geral como escala proporcional da overlay', () => {
    expect(outputs).toContain('Largura geral da overlay')
    expect(outputs).toContain('A largura escala a overlay inteira; a altura acompanha automaticamente.')
    expect(outputs).not.toContain('<label>Altura<input type="number" min={80} value={activeArea.height}')
    expect(outputs).not.toContain('aria-label="Redimensionar área"')
  })

  test('postagem não usa mais caixa azul como máscara de recorte', () => {
    expect(css).toContain('.stream-output-area-preview{position:absolute;overflow:visible;border:0;background:transparent}')
    expect(css).toContain('.stream-output-area-preview.is-selected{border:0;box-shadow:none;')
    expect(canvas).not.toContain('context.rect(area.x, area.y, area.width, area.height); context.clip()')
  })

  test('exportação continua respeitando altura e espaçamento de linha', () => {
    expect(canvas).toContain('const rowHeight = table.rowHeight * visualScale')
    expect(canvas).toContain('const gap = table.rowGap * visualScale')
    expect(canvas).toContain('const header = table.showHeaders ? table.headerHeight * visualScale : 0')
  })
})
