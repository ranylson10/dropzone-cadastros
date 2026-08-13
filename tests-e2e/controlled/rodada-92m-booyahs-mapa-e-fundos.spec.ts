import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')

test('92M - booyah exibe o nome do mapa na faixa principal e remove texto da equipe', async () => {
  expect(workspace).toContain('>{row.mapName}</strong>')
  expect(workspace).not.toContain('{row.mapName} · {row.round}')
  expect(workspace).not.toContain('>{row.name}</strong>')
  expect(workspace).toContain("ctx.fillText(row.mapName || 'Sem mapa'")
})

test('92M - booyah aceita tres fundos independentes', async () => {
  expect(types).toContain('mediaBackgroundUrl: string | null')
  expect(types).toContain('titleBackgroundUrl: string | null')
  expect(types).toContain('statsBackgroundUrl: string | null')
  expect(workspace).toContain("uploadBooyahSectionBackground('mediaBackgroundUrl'")
  expect(workspace).toContain("uploadBooyahSectionBackground('titleBackgroundUrl'")
  expect(workspace).toContain("uploadBooyahSectionBackground('statsBackgroundUrl'")
})

test('92M - biblioteca aplica fundos nas tres secoes do booyah', async () => {
  expect(workspace).toContain("openAssetLibrary('booyah-media')")
  expect(workspace).toContain("openAssetLibrary('booyah-title')")
  expect(workspace).toContain("openAssetLibrary('booyah-stats')")
  expect(workspace).toContain("assetTarget === 'booyah-media'")
  expect(workspace).toContain("assetTarget === 'booyah-title'")
  expect(workspace).toContain("assetTarget === 'booyah-stats'")
})
