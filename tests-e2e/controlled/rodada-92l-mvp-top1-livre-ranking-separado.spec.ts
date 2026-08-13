import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspacePath = path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const typesPath = path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts')
const cssPath = path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css')

function read(file: string) { return fs.readFileSync(file, 'utf8') }

test('92L - MVP Geral cria Top 1 e ranking como blocos independentes', async () => {
  const source = read(workspacePath)
  expect(source).toContain("'top1_only'")
  expect(source).toContain("'ranking_only'")
  expect(source).toContain('MVP Geral · Top 1')
  expect(source).toContain('MVP Geral · Top 2+')
  expect(source).toContain('addMvpTop1')
  expect(source).toContain('addMvpRanking')
})

test('92L - Top 1 permite posicionar foto e card de informacoes livremente', async () => {
  const source = read(workspacePath)
  const types = read(typesPath)
  expect(types).toContain('photoX: number')
  expect(types).toContain('photoY: number')
  expect(types).toContain('photoWidth: number')
  expect(types).toContain('photoHeight: number')
  expect(types).toContain('infoX: number')
  expect(types).toContain('infoY: number')
  expect(types).toContain('infoWidth: number')
  expect(types).toContain('infoHeight: number')
  expect(source).toContain('Foto X')
  expect(source).toContain('Card de informações livre')
})

test('92L - foto do Top 1 suporta mascara em degrade no preview e exportacao', async () => {
  const source = read(workspacePath)
  const css = read(cssPath)
  expect(source).toContain("photoFade: 'none'")
  expect(source).toContain('Degradê da foto')
  expect(source).toContain('destination-in')
  expect(source).toContain('maskImage: photoMask')
  expect(css).toContain('.post-artworks-mvp-photo-free')
})
