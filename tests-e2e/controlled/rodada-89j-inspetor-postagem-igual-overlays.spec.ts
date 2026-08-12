import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const outputs = read('web/features/campeonatos/stream/components/StreamOutputLayoutsEditor.tsx')
const css = read('web/features/campeonatos/stream/stream.css')

test.describe('Rodada 89J — inspetor de postagem igual ao editor de overlays', () => {
  test('remove criadores de elementos soltos da arte de postagem', () => {
    expect(outputs).not.toContain('>+ Texto</button>')
    expect(outputs).not.toContain('>+ Imagem</button>')
    expect(outputs).not.toContain('>+ Cronômetro</button>')
    expect(outputs).not.toContain('>+ Quedas</button>')
    expect(outputs).not.toContain('stream-output-add-elements')
  })

  test('painel da direita lista os elementos da overlay', () => {
    expect(outputs).toContain('Elementos da arte')
    expect(outputs).toContain('Selecione aqui; as ferramentas aparecem à esquerda.')
    expect(outputs).toContain('Posição da overlay')
    expect(outputs).toContain('Bloco da tabela')
    expect(outputs).toContain('Legenda da tabela')
    expect(outputs).toContain('Imagem da overlay')
    expect(outputs).toContain('Título da overlay')
    expect(outputs).toContain('Colunas')
  })

  test('selecionar item à direita abre as ferramentas no painel esquerdo', () => {
    expect(outputs).toContain("setOutputInspectorItem('table'); setToolsTab('edit')")
    expect(outputs).toContain("setOutputInspectorItem('header'); setToolsTab('edit')")
    expect(outputs).toContain("setOutputInspectorItem('loose_image'); setToolsTab('edit')")
    expect(outputs).toContain('Selecione o elemento no painel da direita. As ferramentas aparecem aqui.')
  })

  test('layout desktop ganha quarta coluna para o inspetor', () => {
    expect(css).toContain('.stream-output-editor{grid-template-columns:190px 320px minmax(0,1fr) 205px}')
    expect(css).toContain('.stream-output-elements{')
    expect(css).toContain('.stream-output-element-list')
  })

  test('zoom da rodada anterior continua disponível', () => {
    expect(outputs).toContain('onWheel={handlePreviewWheel}')
    expect(outputs).toContain('stream-output-zoom-tools')
  })
})
