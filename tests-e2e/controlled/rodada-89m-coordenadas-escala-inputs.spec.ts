import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const outputs = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const canvas = read('web/features/campeonatos/stream/services/stream-output-canvas-renderer.ts')
const geometry = read('web/features/campeonatos/stream/services/stream-output-artwork-geometry.ts')
const stage = read('web/features/campeonatos/stream/components/StreamPackageStage.tsx')
const css = read('web/features/campeonatos/stream/stream.css')

test.describe('Rodada 89M — coordenada real, escala visual e inputs editáveis', () => {
  test('X/Y usam a borda visual da overlay e não o canvas 4K invisível', () => {
    expect(geometry).toContain('export function streamOutputArtworkBounds')
    expect(geometry).toContain('STREAM_SYSTEM_OVERLAY_LAYOUTS[area.overlayType].content')
    expect(outputs).toContain('left: -artworkBounds.x * innerScale')
    expect(outputs).toContain('top: -artworkBounds.y * innerScale')
    expect(outputs).toContain('canvasWidth={STREAM_ARTWORK_DESIGN_WIDTH}')
    expect(outputs).toContain('outputProfileId="png-4k"')
    expect(outputs).toContain('X = 0 encosta o conteúdo visual da overlay na borda esquerda.')
  })

  test('largura escala o conjunto pelo tamanho visual e altura acompanha no mesmo fator', () => {
    expect(geometry).toContain('const scale = Math.max(80, area.width) / bounds.width')
    expect(geometry).toContain('Math.round(bounds.height * scale)')
    expect(geometry).toContain('rowsPerPanel * table.rowHeight')
    expect(outputs).toContain('const innerScale = displayWidth / artworkBounds.width')
    expect(outputs).toContain('A largura escala a overlay inteira; a altura acompanha automaticamente.')
    expect(canvas).toContain('streamOutputArtworkScale(entry.pack, entry.area, renderItemCount(entry))')
  })

  test('overlay é livre e arraste/teclado não prendem X/Y dentro da prancha', () => {
    expect(outputs).toContain('let x = original.x + dx')
    expect(outputs).toContain('let y = original.y + dy')
    expect(outputs).toContain('x: activeArea.x + dx')
    expect(outputs).toContain('y: activeArea.y + dy')
    expect(outputs).not.toContain('clamp(activeArea.x + dx')
    expect(outputs).toContain('pode usar X/Y negativos e ultrapassar a prancha')
  })

  test('campos principais podem ser apagados antes de digitar outro valor', () => {
    expect(outputs).toContain('function DraftNumberInput')
    expect(outputs).toContain('const [draft, setDraft] = useState(String(props.value))')
    expect(outputs).toContain('onChange={(event) => setDraft(event.target.value)}')
    expect(outputs).toContain('onBlur={commit}')
    expect(outputs).toContain('type="text"')
    expect(outputs).toContain('function DraftOptionalNumberInput')
    expect(outputs).not.toContain('input type="number"')
    expect(css).toContain('.stream-output-number-field.is-prominent input')
    expect(css).toContain('font-size:17px')
  })

  test('postagem remove também o clipping interno do renderer sem alterar a live', () => {
    expect(outputs).toContain('artworkMode')
    expect(stage).toContain('artworkMode?: boolean')
    expect(stage).toContain("props.artworkMode ? ' is-artwork-output' : ''")
    expect(css).toContain('.stream-package-render-root.is-artwork-output{overflow:visible}')
    expect(css).toContain('.stream-package-render-root.is-artwork-output .stream-package-render-content{overflow:visible}')
  })

  test('exportação usa a mesma geometria compartilhada da prévia', () => {
    expect(canvas).toContain("from './stream-output-artwork-geometry'")
    expect(canvas).toContain('streamOutputArtworkBounds(entry.pack, entry.area, renderItemCount(entry))')
    expect(canvas).toContain('x: entry.area.x + (x - bounds.x) * scale')
    expect(canvas).toContain("const visualScale = area.contentMode === 'clean' ? area.width / baseWidth : streamOutputArtworkScale(entry.pack, entry.area, renderItemCount(entry))")
  })

  test('exportação escala também fonte, padding, borda e offsets da tabela', () => {
    expect(canvas).toContain('(style.paddingX ?? 8) * visualScale')
    expect(canvas).toContain('(style.paddingY ?? 4) * visualScale')
    expect(canvas).toContain('(style.borderWidth || 0) * visualScale')
    expect(canvas).toContain('(style.fontSize || 18) * visualScale')
    expect(canvas).toContain('(style.offsetX || 0) * visualScale')
    expect(canvas).toContain('(style.offsetY || 0) * visualScale')
  })
})
