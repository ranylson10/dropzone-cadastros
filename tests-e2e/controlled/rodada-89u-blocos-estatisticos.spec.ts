import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')

test('89U adiciona Classificados Booyahs do Dia e Líderes de Abates', () => {
  expect(types).toContain("'qualified_teams'")
  expect(types).toContain("'booyahs_day'")
  expect(types).toContain("'kills_leaders'")
  expect(workspace).toContain('Classificados')
  expect(workspace).toContain('Booyahs do Dia')
  expect(workspace).toContain('Líderes de Abates')
})

test('89U classificados reaproveita editor de tabela mas começa só com colunas úteis', () => {
  expect(workspace).toContain("createQualifiedTeamsBlock")
  expect(workspace).toContain("['rank', 'logo', 'name', 'points']")
  expect(workspace).toContain("selectedBlock.type === 'qualified_teams'")
  expect(workspace).toContain('Top ${block.dataStart || 1}–${block.dataEnd || 12}')
})

test('89U booyahs do dia usa rodada própria e ordena por booyah', () => {
  expect(workspace).toContain('createBooyahsDayBlock')
  expect(workspace).toContain("block.type === 'booyahs_day'")
  expect(workspace).toContain('booyahDayRoundKey')
  expect(service).toContain('loadPostArtworkDayBooyahs')
  expect(service).toContain('b.booyah - a.booyah')
  expect(service).not.toContain('/stream/')
})

test('89U líderes de abates usa dados de jogadores ordenados por abates', () => {
  expect(workspace).toContain('addKillLeaders')
  expect(workspace).toContain("type: 'kills_leaders' as const")
  expect(workspace).toContain('playerForBlock(block, mvpGeneral, mvpDay, killLeaders)')
  expect(service).toContain('loadPostArtworkKillLeaders')
  expect(service).toContain('b.kills - a.kills')
})

test('89U preview e exportação atualizam os novos blocos sem migration', () => {
  expect(workspace).toContain('latestBooyahRows')
  expect(workspace).toContain('latestKillLeaders')
  expect(workspace).toContain('setBooyahDay(latestBooyahRows)')
  expect(workspace).toContain('setKillLeaders(latestKillLeaders)')
  expect(workspace).toContain('renderArtworkCanvas(draft, latestRows, latestDayRows, latestMvpGeneral, latestMvpDayRows, latestBooyahRows, latestKillLeaders)')
})
