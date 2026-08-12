import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const savedPage = fs.readFileSync(path.join(root, 'web/app/campeonatos/[id]/artes-postagem/salvas/page.tsx'), 'utf8')
const generatePage = fs.readFileSync(path.join(root, 'web/app/campeonatos/[id]/artes-postagem/page.tsx'), 'utf8')

test('90C separa Artes salvas da Central de geração sem remover o editor', () => {
  expect(savedPage).toContain('mode="manage"')
  expect(generatePage).toContain('mode="generate"')
  expect(generatePage).toContain('initialArtworkId={query.artwork}')
  expect(workspace).toContain("mode?: 'edit' | 'generate' | 'manage'")
  expect(workspace).toContain('Gerar artes')
  expect(workspace).toContain('Artes salvas')
  expect(workspace).toContain('Editor de artes')
  expect(workspace).toContain('Biblioteca de imagens')
})

test('90C permite buscar e filtrar templates sem entrar no editor', () => {
  expect(workspace).toContain('Buscar arte')
  expect(workspace).toContain("setArtworkFilter('tables')")
  expect(workspace).toContain("setArtworkFilter('mvp')")
  expect(workspace).toContain("setArtworkFilter('qualified')")
  expect(workspace).toContain('managedItems.map')
})

test('90C oferece ações rápidas de gestão por arte', () => {
  expect(workspace).toContain('renameProject(item)')
  expect(workspace).toContain('duplicateProject(item)')
  expect(workspace).toContain('deleteManagedProject(item)')
  expect(workspace).toContain('Visualizar')
  expect(workspace).toContain('Renomear')
  expect(workspace).toContain('Duplicar')
  expect(workspace).toContain('Excluir')
})

test('90C mantém criação e edição como atalhos diretos para o editor', () => {
  expect(workspace).toContain('createProjectAndEdit()')
  expect(workspace).toContain('openEditor(item.id)')
  expect(workspace).toContain('Criar arte')
  expect(workspace).toContain('Editar arte')
})
