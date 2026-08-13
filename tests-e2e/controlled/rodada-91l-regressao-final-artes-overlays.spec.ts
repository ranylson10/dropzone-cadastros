import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const dataService = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')
const gamesTab = fs.readFileSync(path.join(root, 'web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx'), 'utf8')
const streamTab = fs.readFileSync(path.join(root, 'web/features/campeonatos/stream/components/CampeonatoStreamTab.tsx'), 'utf8')
const streamTypes = fs.readFileSync(path.join(root, 'web/features/campeonatos/stream/types/stream-package.types.ts'), 'utf8')
const streamPublic = fs.readFileSync(path.join(root, 'web/features/campeonatos/stream/services/stream-package-public.service.ts'), 'utf8')

test('91L - jogo possui regra classificatoria configuravel', async () => {
  expect(gamesTab).toContain('Pontos corridos / sem eliminação')
  expect(gamesTab).toContain('Mata-mata / classificatório')
  expect(gamesTab).toContain('classificam_quantidade')
  expect(gamesTab).toContain('Mata-mata · Top')
})

test('91L - template continua independente e jogo entra apenas na previa ou geracao', async () => {
  expect(workspace).toContain("const GAME_DATA_BLOCK_TYPES = new Set<PostArtworkBlock['type']>(['table_day', 'qualified_teams', 'booyahs_day', 'mvp_day', 'kills_leaders'])")
  expect(workspace).toContain('function stripDynamicGameSources(project: PostArtworkProject): PostArtworkProject')
  expect(workspace).toContain('resolveProjectForGame(draft, generationGame)')
  expect(workspace).toContain('resolveProjectForGame(draft, editorReferenceGame)')
})

test('91L - classificados usam o corte do jogo selecionado', async () => {
  expect(workspace).toContain('game.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0')
  expect(workspace).toContain("block.type === 'qualified_teams' ? { dataStart: 1, dataEnd: 0 } : {}")
  expect(workspace).toContain('Quantidade definida pelo jogo')
})

test('91L - todos os dados especificos sao carregados por jogo', async () => {
  expect(dataService).toContain('loadPostArtworkGameStandings')
  expect(dataService).toContain('loadPostArtworkGameBooyahs')
  expect(dataService).toContain('loadPostArtworkGameMvp')
  expect(dataService).toContain('loadPostArtworkGameKillLeaders')
  expect(workspace).toContain("block.type === 'table_day' || block.type === 'qualified_teams'")
  expect(workspace).toContain("block.type === 'booyahs_day'")
  expect(workspace).toContain("block.type === 'mvp_day'")
  expect(workspace).toContain("block.type === 'kills_leaders'")
})

test('91L - geracao exige jogo somente quando o modelo usa dados dinamicos', async () => {
  expect(workspace).toContain('projectRequiresGame(item) && !generationGame')
  expect(workspace).toContain("projectRequiresGame(draft) && !generationGame ? 'Selecione o jogo'")
  expect(workspace).toContain('Selecione o jogo, confira as artes prontas com os dados atualizados e baixe.')
})

test('91L - overlays usam o jogo ativo da live como fonte', async () => {
  expect(streamTab).toContain('Jogo da live · fonte das estatísticas')
  expect(streamTab).toContain('active_jogo_id: jogoVal')
  expect(streamPublic).toContain('context.activeJogoId ? { jogoId: context.activeJogoId } : {}')
  expect(streamPublic).toContain('loadBooyahs(campeonatoId, context.activeJogoId, partidas)')
  expect(streamTypes).toContain("title: 'MVP do jogo'")
  expect(streamTypes).toContain("title: 'Booyahs do jogo'")
})
