import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const championship = read('web/features/directory/components/ChampionshipPublicView.tsx')
const page = read('web/app/campeonatos/[id]/artes-postagem/page.tsx')
const workspace = read('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const api = read('web/app/api/campeonatos/[id]/artes-postagem/route.ts')
const apiItem = read('web/app/api/campeonatos/[id]/artes-postagem/[artId]/route.ts')
const migration = read('database/migrations/20260812_post_artworks_independentes.sql')
const stream = read('web/features/campeonatos/stream/components/StreamPackageEditor.tsx')

test('89P cria entrada própria Artes para postar na página do campeonato', () => {
  expect(championship).toContain('/artes-postagem')
  expect(championship).toContain('Artes para postar')
  expect(page).toContain('PostArtworkWorkspace')
  expect(page).toContain('activeLabel="Artes para postar"')
})

test('89P persiste templates em tabela própria e não no pacote da live', () => {
  expect(migration).toContain('create table if not exists public.campeonato_post_artworks')
  expect(migration).toContain("'Templates de artes para redes sociais do campeonato. Independentes do pacote de overlays da transmissão.'")
  expect(migration).toContain('blocks jsonb')
  expect(api).toContain("from('campeonato_post_artworks')")
  expect(apiItem).toContain("from('campeonato_post_artworks')")
  expect(api).not.toContain('campeonato_stream_pack')
  expect(apiItem).not.toContain('campeonato_stream_pack')
})

test('89P editor base tem canvas, fatias, fundo e formato independentes', () => {
  expect(workspace).toContain('ARTES PARA POSTAR')
  expect(workspace).toContain('Largura da fatia')
  expect(workspace).toContain('Altura da fatia')
  expect(workspace).toContain('Quantidade de fatias')
  expect(workspace).toContain('Enviar fundo da arte')
  expect(workspace).toContain('Área de trabalho')
  expect(workspace).toContain('Salvar template')
})

test('89P campos numéricos permitem apagar e só consolidam no blur ou Enter', () => {
  expect(workspace).toContain('function EditableNumberInput')
  expect(workspace).toContain('onChange={(event) => setText(event.target.value)}')
  expect(workspace).toContain('onBlur={commit}')
  expect(workspace).toContain("event.key === 'Enter'")
})

test('89P transmissão deixa de expor a antiga aba Postagens', () => {
  expect(stream).not.toContain('StreamOutputLayoutsEditor')
  expect(stream).not.toContain('>Postagens</button>')
  expect(stream).toContain('Overlays da transmissão')
})
