import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css'), 'utf8')

test('92O - editor usa grupos padrao em vez de painel especifico sempre aberto', async () => {
  expect(workspace).toContain('function CompactToolSection')
  expect(workspace).toContain('title="Bloco"')
  expect(workspace).toContain('title="Estrutura"')
  expect(workspace).toContain('title="Texto"')
  expect(workspace).toContain('title="Imagem"')
  expect(workspace).toContain('title="Fundo"')
})

test('92O - tabelas MVP continuam usando o mesmo editor das outras tabelas', async () => {
  expect(workspace).toContain("selectedBlock.type === 'mvp_general_table') ? normalizeTableStyle")
  expect(workspace).toContain('selectedTableStyle && selectedColumn')
  expect(workspace).toContain('Largura coluna')
  expect(workspace).toContain('Altura da linha')
})

test('92O - controles antigos ficam recolhidos e painel principal fica compacto', async () => {
  expect(workspace).toContain('className="post-artworks-advanced-tools"')
  expect(workspace).toContain('<summary>Ajustes avançados</summary>')
  expect(css).toContain('.post-artworks-tool-section')
  expect(css).toContain('.post-artworks-compact-tools')
  expect(css).toContain('.post-artworks-advanced-tools')
})
