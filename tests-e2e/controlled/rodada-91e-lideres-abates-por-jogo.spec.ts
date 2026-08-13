import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')

test('91E lideres de abates usam o jogo selecionado', async () => {
  expect(workspace).toContain("block.type === 'kills_leaders' ? killLeaders[block.source?.jogoId || ''] || []")
  expect(workspace).toContain("block.type === 'mvp_day' || block.type === 'kills_leaders'")
  expect(workspace).toContain("type === 'mvp_day' || block.type === 'kills_leaders'")
})

test('91E troca do jogo na central resolve tambem lideres de abates', async () => {
  expect(workspace).toContain("block.type === 'mvp_day' || block.type === 'kills_leaders')) return")
  expect(workspace).toContain("renderDraft.blocks.filter((block) => block.type === 'kills_leaders')")
  expect(workspace).toContain('loadPostArtworkGameKillLeaders(campeonatoId, jogoId)')
})

test('91E exportacao baixa lideres calculados somente para o jogo escolhido', async () => {
  expect(service).toContain('export async function loadPostArtworkGameKillLeaders(campeonatoId: string, jogoId: string)')
  expect(service).toContain('const rows = await loadPostArtworkMvp(campeonatoId, jogoId)')
  expect(workspace).toContain("project.blocks.filter((block) => block.type === 'kills_leaders').map((block) => block.source?.jogoId)")
  expect(workspace).toContain('await loadPostArtworkGameKillLeaders(campeonatoId, jogoId)')
})
