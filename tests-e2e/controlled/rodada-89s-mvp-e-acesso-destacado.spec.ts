import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/post-artworks.css'), 'utf8')
const championship = fs.readFileSync(path.join(root, 'web/features/directory/components/ChampionshipPublicView.tsx'), 'utf8')
const globals = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('89S adiciona MVP Geral e MVP do Jogo como blocos independentes', () => {
  expect(workspace).toContain('MVP Geral')
  expect(workspace).toContain('MVP do Jogo')
  expect(workspace).toContain("createMvpBlock('mvp_general'")
  expect(workspace).toContain("createMvpBlock('mvp_day'")
  expect(types).toContain("'mvp_general'")
  expect(types).toContain("'mvp_day'")
})

test('89S MVP usa estatísticas do campeonato e filtro de jogo sem stream', () => {
  expect(service).toContain('/estatisticas/mvp')
  expect(service).toContain('loadPostArtworkGeneralMvp')
  expect(service).toContain('loadPostArtworkGameMvp')
  expect(service).toContain('jogo_id=')
  expect(service).not.toContain('/stream/')
})

test('89S card MVP tem foto equipe abates quedas e visual próprio', () => {
  expect(types).toContain('PostArtworkMvpStyle')
  expect(types).toContain('PostArtworkPlayerRow')
  expect(workspace).toContain('Tamanho da foto')
  expect(workspace).toContain('Visual do MVP')
  expect(workspace).toContain('Upload do fundo')
  expect(workspace).toContain("openAssetLibrary('mvp')")
  expect(workspace).toContain('showKills')
  expect(workspace).toContain('showDrops')
  expect(css).toContain('.post-artworks-mvp-block{position:absolute')
})

test('89S preview e exportação atualizam MVP Geral e MVP do Jogo', () => {
  expect(workspace).toContain('playerForBlock(block, mvpGeneral, mvpDay, killLeaders)')
  expect(workspace).toContain('latestMvpGeneral')
  expect(workspace).toContain('latestMvpDayRows')
  expect(workspace).toContain('renderArtworkCanvas(project, latestRows, latestDayRows, latestMvpGeneral, latestMvpDayRows, latestBooyahRows, latestKillLeaders, renderScale)')
})

test('89S adiciona acesso destacado para Artes para postar no topo do campeonato', () => {
  expect(championship).toContain('champ-artworks-hero-cta')
  expect(championship).toContain('Crie e baixe tabelas, MVPs e carrosséis')
  expect(championship).toContain('champ-artworks-cta')
  expect(globals).toContain('.champ-artworks-hero-cta')
  expect(globals).toContain('.champ-public-info-links .champ-artworks-cta')
})
