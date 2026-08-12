import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const outputs = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const css = read('web/features/campeonatos/stream/stream.css')

test.describe('Rodada 89I — editor de postagem acessível', () => {
  test('organiza ferramentas principais em abas curtas', () => {
    expect(outputs).toContain("type OutputToolsTab = 'project' | 'areas' | 'edit'")
    expect(outputs).toContain('Ferramentas da postagem')
    expect(outputs).toContain('>Projeto</button>')
    expect(outputs).toContain('>Áreas</button>')
    expect(outputs).toContain('>Edição</button>')
    expect(css).toContain('.stream-output-tools-tabs')
  })

  test('área selecionada tem acesso direto ao editor', () => {
    expect(outputs).toContain('Abrir ferramentas de edição')
    expect(outputs).toContain("setToolsTab('edit')")
    expect(outputs).toContain('stream-output-area-editor-tab')
  })

  test('prévia aceita zoom pelo scroll do mouse', () => {
    expect(outputs).toContain('previewZoom')
    expect(outputs).toContain('handlePreviewWheel')
    expect(outputs).toContain('event.deltaY < 0 ? 1.12 : .88')
    expect(outputs).toContain('onWheel={handlePreviewWheel}')
    expect(outputs).toContain('Use o scroll do mouse para aplicar zoom')
  })

  test('toolbar mostra menos mais percentual e ajustar à tela', () => {
    expect(outputs).toContain('stream-output-zoom-tools')
    expect(outputs).toContain('Diminuir zoom')
    expect(outputs).toContain('Aumentar zoom')
    expect(outputs).toContain('Ajustar à tela')
    expect(outputs).toContain('Math.round(previewZoom * 100)')
  })
})
