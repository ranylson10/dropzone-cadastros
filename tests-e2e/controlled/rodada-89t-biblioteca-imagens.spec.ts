import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css'), 'utf8')
const api = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/artes-postagem/assets/route.ts'), 'utf8')
const apiDelete = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/artes-postagem/assets/[assetId]/route.ts'), 'utf8')
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260812_asset_library.sql'), 'utf8')

test('89T cria biblioteca de imagens própria do campeonato', () => {
  expect(types).toContain('PostArtworkAsset')
  expect(types).toContain("'background' | 'cell' | 'card' | 'other'")
  expect(migration).toContain('create table if not exists public.campeonato_asset_library')
  expect(migration).toContain('campeonato_id uuid not null references public.campeonatos')
  expect(api).toContain("from('campeonato_asset_library')")
  expect(apiDelete).toContain("from('campeonato_asset_library').delete()")
})

test('89T uploads usados nas artes entram automaticamente na biblioteca', () => {
  expect(workspace).toContain("rememberAsset(url, file.name || 'Fundo da arte', 'background')")
  expect(workspace).toContain("rememberAsset(url, file.name || 'Fundo de MVP', 'card')")
  expect(workspace).toContain("'cell')")
  expect(workspace).toContain('Imagem enviada, mas não foi possível salvá-la na biblioteca.')
})

test('89T biblioteca reaplica imagem no fundo da arte célula ou MVP', () => {
  expect(workspace).toContain("openAssetLibrary('project')")
  expect(workspace).toContain("openAssetLibrary('column')")
  expect(workspace).toContain("openAssetLibrary('mvp')")
  expect(workspace).toContain("if (assetTarget === 'project'")
  expect(workspace).toContain("if (assetTarget === 'column'")
  expect(workspace).toContain("if (assetTarget === 'mvp'")
})

test('89T possui galeria visual e remoção da biblioteca sem apagar templates', () => {
  expect(workspace).toContain('BIBLIOTECA DO CAMPEONATO')
  expect(workspace).toContain('Biblioteca de imagens')
  expect(workspace).toContain('deleteLibraryAsset')
  expect(css).toContain('.post-artworks-library-backdrop')
  expect(css).toContain('.post-artworks-library-grid')
})

test('89T biblioteca compartilha assets sem voltar a acoplar layout da live', () => {
  expect(migration).toContain('Compartilha apenas assets')
  expect(workspace).not.toContain('/stream/')
  expect(api).not.toContain('campeonato_stream_pack')
})
