import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')
const gameTab = fs.readFileSync(path.join(root, 'web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx'), 'utf8')
const gameTypes = fs.readFileSync(path.join(root, 'web/features/campeonatos/jogos/types/campeonato-jogos.types.ts'), 'utf8')
const gameService = fs.readFileSync(path.join(root, 'backend/src/campeonatos/jogos/jogos.service.ts'), 'utf8')
const home = fs.readFileSync(path.join(root, 'web/features/dropzone/DropZoneHome.tsx'), 'utf8')
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260812_jogos_mata_mata_classificados.sql'), 'utf8')

test('90A jogo distingue pontos corridos de mata-mata e exige top classificado só no mata-mata', () => {
  expect(gameTypes).toContain('mata_mata: boolean')
  expect(gameTab).toContain('Pontos corridos / sem eliminação')
  expect(gameTab).toContain('Mata-mata / classificatório')
  expect(gameTab).toContain('Top que passa de fase')
  expect(gameService).toContain('mata_mata?: boolean')
  expect(gameService).toContain('classificam_quantidade?: number | null')
  expect(gameService).toContain('Informe quantas equipes passam de fase neste jogo mata-mata.')
  expect(home).toContain('mata_mata: game.tipo_jogo === \'final\' ? false : Boolean(game.mata_mata)')
  expect(home).toContain("classificam_quantidade: game.tipo_jogo !== 'final' && game.mata_mata")
  expect(migration).toContain('add column if not exists mata_mata boolean not null default false')
  expect(migration).toContain('add column if not exists classificam_quantidade integer')
})

test('90A editor seleciona jogo e usa jogo_id para tabela MVP booyah e classificados', () => {
  expect(workspace).toContain('gameOptionsFromApi')
  expect(workspace).toContain('/jogos')
  expect(workspace).toContain('<label>Jogo<select')
  expect(workspace).toContain('Selecione o jogo')
  expect(workspace).toContain("selectedBlock.type === 'qualified_teams'")
  expect(workspace).toContain('game.classificamQuantidade')
  expect(service).toContain('jogo_id=')
  expect(service).toContain('loadPostArtworkGameStandings')
  expect(service).toContain('loadPostArtworkGameMvp')
  expect(service).toContain('loadPostArtworkGameBooyahs')
})

test('90A classificados usa apenas jogos mata-mata e herda automaticamente o top configurado', () => {
  expect(workspace).toContain("const limit = game?.mataMata && game.classificamQuantidade ? game.classificamQuantidade : 12")
  expect(workspace).toContain("selectedBlock.type !== 'qualified_teams' || (game.mataMata && game.classificamQuantidade)")
  expect(workspace).toContain("{ dataStart: 1, dataEnd: game.classificamQuantidade }")
  expect(workspace).toContain("if (block.type === 'table_day' || block.type === 'qualified_teams') return dayRows")
})
