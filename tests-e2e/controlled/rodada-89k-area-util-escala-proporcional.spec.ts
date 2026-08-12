import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const outputs = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
const canvas = read('web/features/campeonatos/stream/services/stream-output-canvas-renderer.ts')
const css = read('web/features/campeonatos/stream/stream.css')

test.describe('Rodada 89K — área útil e escala proporcional da overlay de postagem', () => {
  test('área azul usa altura útil calculada pelo conteúdo da tabela', () => {
    expect(outputs).toContain('outputAreaContentBaseSize')
    expect(outputs).toContain('table.headerHeight')
    expect(outputs).toContain('count * table.rowHeight')
    expect(outputs).toContain('data.items.length || undefined')
  })

  test('remove ajuste manual separado de largura e altura e usa largura geral proporcional', () => {
    expect(outputs).toContain('Largura geral da overlay')
    expect(outputs).toContain('Escala proporcional: largura e altura crescem juntas sem esticar a arte.')
    expect(outputs).not.toContain('<label>Altura<input type="number" min={80} value={activeArea.height}')
    expect(outputs).not.toContain('aria-label="Redimensionar área"')
  })

  test('conteúdo limpo começa na origem e não carrega padding vazio da cena de live', () => {
    expect(stage).toContain('props.contentOnly ? layout.content.width * sharedLayout.widthScale')
    expect(css).toContain('.stream-package-render-content.is-content-only{align-items:flex-start;justify-content:flex-start;padding:0;overflow:visible}')
  })

  test('exportação preserva altura e espaçamento de linha sem esmagar a tabela', () => {
    expect(canvas).toContain('effectiveCleanArea')
    expect(canvas).toContain('const rowHeight = table.rowHeight * visualScale')
    expect(canvas).toContain('const gap = table.rowGap * visualScale')
    expect(canvas).toContain('const header = table.showHeaders ? table.headerHeight * visualScale : 0')
  })
})
