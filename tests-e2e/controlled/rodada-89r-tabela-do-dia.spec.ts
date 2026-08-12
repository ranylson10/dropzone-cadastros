import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')

test('89R adiciona Tabela do Jogo como bloco independente da tabela geral', () => {
  expect(workspace).toContain('Tabela do Jogo')
  expect(workspace).toContain("type: 'table_day'")
  expect(workspace).toContain('addDayTable')
  expect(workspace).toContain("block.type === 'table_general' || block.type === 'table_day'")
})

test('89R tabela do jogo salva o jogo selecionado no próprio bloco', () => {
  expect(types).toContain('jogoId?: string')
  expect(types).toContain('jogoName?: string')
  expect(workspace).toContain('<label>Jogo<select')
  expect(workspace).toContain('Selecione o jogo')
  expect(workspace).toContain("source: { jogoId: event.target.value, jogoName: game?.nome || '' }")
})

test('89R busca classificação filtrada por jogo sem depender da transmissão', () => {
  expect(service).toContain('jogo_id=')
  expect(service).toContain('loadPostArtworkGameStandings')
  expect(service).toContain('/estatisticas/equipes')
  expect(service).not.toContain('/stream/')
  expect(workspace).toContain('/jogos')
})

test('89R prévia e exportação resolvem dados gerais e do dia separadamente', () => {
  expect(workspace).toContain('rowsForBlock(block, standings, dayStandings, booyahDay)')
  expect(workspace).toContain('latestDayRows')
  expect(workspace).toContain('renderArtworkCanvas(draft, latestRows, latestDayRows, latestMvpGeneral, latestMvpDayRows, latestBooyahRows, latestKillLeaders, renderScale)')
  expect(workspace).toContain("if (block.type === 'table_day' || block.type === 'qualified_teams') return dayRows")
})

test('89R duplicar Tabela do Jogo mantém rodada e avança apenas a faixa', () => {
  expect(workspace).toContain("uid(block.type === 'table_day' ? 'table-day' : block.type === 'booyahs_day' ? 'booyahs-day' : block.type === 'qualified_teams' ? 'qualified-teams' : block.type === 'mvp_day' ? 'mvp-day'")
  expect(workspace).toContain('dataStart: nextStart')
  expect(workspace).toContain('dataEnd: nextStart + count - 1')
  expect(workspace).toContain('...structuredClone(block)')
})
