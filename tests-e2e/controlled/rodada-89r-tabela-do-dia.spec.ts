import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')

test('89R adiciona Tabela do Dia como bloco independente da tabela geral', () => {
  expect(workspace).toContain('Tabela do Dia')
  expect(workspace).toContain("type: 'table_day'")
  expect(workspace).toContain('addDayTable')
  expect(workspace).toContain("block.type === 'table_general' || block.type === 'table_day'")
})

test('89R tabela do dia escolhe rodada e salva a fonte no próprio bloco', () => {
  expect(types).toContain('rodadaId?: string')
  expect(types).toContain('rodadaName?: string')
  expect(workspace).toContain('Rodada / dia')
  expect(workspace).toContain('Selecione a rodada')
  expect(workspace).toContain("source: { rodadaId: event.target.value, rodadaName: round?.nome || '' }")
})

test('89R busca classificação filtrada por rodada sem depender da transmissão', () => {
  expect(service).toContain('rodada_id=')
  expect(service).toContain('loadPostArtworkDayStandings')
  expect(service).toContain('/estatisticas/equipes')
  expect(service).not.toContain('/stream/')
  expect(workspace).toContain('/sumula')
})

test('89R prévia e exportação resolvem dados gerais e do dia separadamente', () => {
  expect(workspace).toContain('rowsForBlock(block, standings, dayStandings, booyahDay)')
  expect(workspace).toContain('latestDayRows')
  expect(workspace).toContain('renderArtworkCanvas(draft, latestRows, latestDayRows, latestMvpGeneral, latestMvpDayRows, latestBooyahRows, latestKillLeaders)')
  expect(workspace).toContain("if (block.type === 'table_day') return dayRows")
})

test('89R duplicar Tabela do Dia mantém rodada e avança apenas a faixa', () => {
  expect(workspace).toContain("block.type === 'table_day' ? 'table-day'")
  expect(workspace).toContain("block.type === 'booyahs_day' ? 'booyahs-day'")
  expect(workspace).toContain('dataStart: nextStart')
  expect(workspace).toContain('dataEnd: nextStart + count - 1')
  expect(workspace).toContain('...structuredClone(block)')
})
