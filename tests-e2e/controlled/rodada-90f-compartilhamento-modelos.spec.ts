import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const workspace = source('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const shareRoute = source('web/app/api/campeonatos/[id]/artes-postagem/share/route.ts')
const importRoute = source('web/app/api/campeonatos/[id]/artes-postagem/import/route.ts')
const migration = source('database/migrations/20260812_post_artwork_share_tokens.sql')

test('90F artes salvas oferece compartilhar e importar modelos sem abrir o editor', () => {
  expect(workspace).toContain('Compartilhar modelo')
  expect(workspace).toContain('Importar modelo')
  expect(workspace).toContain('Pacote de artes por token')
  expect(workspace).toContain('Personalizar cores e imagens')
})

test('90F token compartilha snapshot visual sem resultados competitivos', () => {
  expect(shareRoute).toContain('campeonato_post_artwork_share_tokens')
  expect(shareRoute).toContain('background_color')
  expect(shareRoute).toContain('blocks')
  expect(shareRoute).toContain('campeonato_asset_library')
  expect(shareRoute).not.toContain('campeonato_resultados_')
  expect(shareRoute).not.toContain('campeonato_jogadores')
})

test('90F importação permite conferir pacote antes e copia artes e assets para o campeonato destino', () => {
  expect(importRoute).toContain('body.preview === true')
  expect(importRoute).toContain("from('campeonato_post_artworks').insert(rows)")
  expect(importRoute).toContain("from('campeonato_asset_library').insert")
  expect(importRoute).toContain("name: `${String(artwork.name || 'Arte').slice(0, 108)} · importada`")
})

test('90F persiste tokens curtos revogáveis em tabela com RLS', () => {
  expect(migration).toContain('create table if not exists public.campeonato_post_artwork_share_tokens')
  expect(migration).toContain('token text not null')
  expect(migration).toContain('revoked_at timestamptz')
  expect(migration).toContain('enable row level security')
  expect(shareRoute).toContain('DZART-')
})
