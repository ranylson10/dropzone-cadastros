import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function source(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test.describe('Rodada 87J — imagem nos fundos', () => {
  test('todo editor de fundo oferece imagem, ajuste, posição e repetição', () => {
    const panel = source('web/features/campeonatos/stream/components/editor/StylePanels.tsx')
    expect(panel).toContain('<option value="image">Imagem</option>')
    expect(panel).toContain('<option value="stretch">Esticar</option>')
    expect(panel).toContain('label="Posição"')
    expect(panel).toContain('label="Repetição"')
    expect(panel).toContain('label="Cor atrás da imagem"')
    expect(panel).toContain('label="Cor de apoio"')
    expect(panel).toContain('useFallbackColor')
  })

  test('renderização respeita contain, cover, stretch, posição e repetição', () => {
    const style = source('web/features/campeonatos/stream/utils/stream-style.ts')
    expect(style).toContain("fill.fit === 'stretch' ? '100% 100%'")
    expect(style).toContain("backgroundPosition: fill.position || 'center'")
    expect(style).toContain("backgroundRepeat: fill.repeat || 'no-repeat'")
    expect(style).toContain("backgroundColor: fill.useFallbackColor ? fill.fallbackColor || '#000000' : 'transparent'")
  })

  test('linhas alternadas e linhas individuais aceitam estilo completo com imagem', () => {
    const types = source('web/features/campeonatos/stream/types/stream.types.ts')
    const canvas = source('web/features/campeonatos/stream/components/StreamTableCanvas.tsx')
    const tools = source('web/features/campeonatos/stream/components/editor/TableToolsPanel.tsx')
    expect(types).toContain('altRowStyle?: FieldStyle')
    expect(types).toContain('style?: FieldStyle')
    expect(canvas).toContain('fieldToCss(altRowStyle)')
    expect(tools).toContain('value={data.altRowStyle')
    expect(tools).toContain('value={props.selectedRow.style')
  })
})
