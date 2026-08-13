import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const dataService = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')

test('91K - todos os blocos dinamicos recebem o jogo escolhido na geracao', async () => {
  expect(workspace).toContain("const GAME_DATA_BLOCK_TYPES = new Set<PostArtworkBlock['type']>(['table_day', 'qualified_teams', 'booyahs_day', 'mvp_day', 'kills_leaders'])")
  expect(workspace).toContain('resolveProjectForGame(draft, generationGame)')
  expect(workspace).toContain("source: { jogoId: game.id, jogoName: game.nome }")
})

test('91K - tabela, classificados e booyahs carregam estatisticas pelo jogo', async () => {
  expect(dataService).toContain('export function loadPostArtworkGameStandings(campeonatoId: string, jogoId: string)')
  expect(dataService).toContain('return loadPostArtworkTeamStandings(campeonatoId, jogoId)')
  expect(dataService).toContain('export async function loadPostArtworkGameBooyahs(campeonatoId: string, jogoId: string)')
  expect(workspace).toContain("block.type === 'table_day' || block.type === 'qualified_teams'")
  expect(workspace).toContain("block.type === 'booyahs_day'")
})

test('91K - MVP e lideres de abates carregam jogadores pelo jogo', async () => {
  expect(dataService).toContain('export function loadPostArtworkGameMvp(campeonatoId: string, jogoId: string)')
  expect(dataService).toContain('return loadPostArtworkMvp(campeonatoId, jogoId)')
  expect(dataService).toContain('export async function loadPostArtworkGameKillLeaders(campeonatoId: string, jogoId: string)')
  expect(workspace).toContain("block.type === 'mvp_day'")
  expect(workspace).toContain("block.type === 'kills_leaders'")
})

test('91K - exportacao busca dados atuais do jogo antes de gerar a imagem', async () => {
  expect(workspace).toContain('async function exportArtwork(project: PostArtworkProject | null = renderDraft)')
  expect(workspace).toContain('await loadPostArtworkGameStandings(campeonatoId, jogoId)')
  expect(workspace).toContain('await loadPostArtworkGameBooyahs(campeonatoId, jogoId)')
  expect(workspace).toContain('await loadPostArtworkGameMvp(campeonatoId, jogoId)')
  expect(workspace).toContain('await loadPostArtworkGameKillLeaders(campeonatoId, jogoId)')
})

test('91K - template salvo continua sem jogo fixo e corte vem do jogo selecionado', async () => {
  expect(workspace).toContain('function stripDynamicGameSources(project: PostArtworkProject): PostArtworkProject')
  expect(workspace).toContain('JSON.stringify(stripDynamicGameSources(draft))')
  expect(workspace).toContain("block.type === 'qualified_teams' ? { dataStart: 1, dataEnd: 0 } : {}")
  expect(workspace).toContain("game.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0")
})
