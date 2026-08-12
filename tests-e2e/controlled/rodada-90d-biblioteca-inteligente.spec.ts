import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const workspace = source('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const libraryPage = source('web/app/campeonatos/[id]/artes-postagem/biblioteca/page.tsx')
const assetApi = source('web/app/api/campeonatos/[id]/artes-postagem/assets/[assetId]/route.ts')
const css = source('web/features/campeonatos/artes-postagem/post-artworks.css')

test('90D cria página própria de biblioteca e mantém navegação entre as áreas de artes', () => {
  expect(libraryPage).toContain('mode="library"')
  expect(workspace).toContain("mode?: 'edit' | 'generate' | 'manage' | 'library'")
  expect(workspace).toContain('Biblioteca de imagens')
  expect(workspace).toContain('/artes-postagem/biblioteca')
  expect(workspace).toContain("mode === 'library'")
})

test('90D mostra quantidade e locais de uso de cada imagem', () => {
  expect(workspace).toContain('function collectAssetUsages')
  expect(workspace).toContain('Fundo do projeto')
  expect(workspace).toContain('Fundo da legenda')
  expect(workspace).toContain('Ver usos')
  expect(workspace).toContain('ONDE ESTA IMAGEM É USADA')
  expect(workspace).toContain('Editar arte')
})

test('90D substitui a URL em todos os templates que usam o asset', () => {
  expect(assetApi).toContain('function replaceExactUrl')
  expect(assetApi).toContain("export async function PUT")
  expect(assetApi).toContain("from('campeonato_post_artworks').select('id,name,background_url,blocks')")
  expect(assetApi).toContain('updated_references: updatedReferences')
  expect(assetApi).toContain('updated_artworks: updatedArtworks')
  expect(workspace).toContain('Substituir em todas')
  expect(workspace).toContain('replaceLibraryAsset(asset')
})

test('90D permite baixar e enviar assets e impede apagar imagem ainda em uso', () => {
  expect(workspace).toContain('downloadLibraryAsset')
  expect(workspace).toContain('Adicionar imagem')
  expect(workspace).toContain('Tipo do próximo upload')
  expect(assetApi).toContain('Esta imagem ainda é usada')
  expect(assetApi).toContain('status: 409')
  expect(css).toContain('.post-artworks-smart-library-grid')
  expect(css).toContain('.post-artworks-usage-list')
})
