import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const jogos = fs.readFileSync(path.join(root, 'web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'backend/src/campeonatos/jogos/jogos.service.ts'), 'utf8')
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260812_jogos_mata_mata_classificados.sql'), 'utf8')

test('91C cadastro do jogo deixa a regra de classificação visível', async () => {
  expect(jogos).toContain('Regra de avanço deste jogo')
  expect(jogos).toContain('Formato competitivo')
  expect(jogos).toContain('Mata-mata / classificatório')
  expect(jogos).toContain('Top que passa de fase')
  expect(jogos).toContain('Essa regra também alimenta automaticamente as artes de Classificados e Eliminados.')
})

test('91C pontos corridos limpa corte e mata-mata usa quantidade informada', async () => {
  expect(jogos).toContain("mata_mata: e.target.value === 'mata_mata'")
  expect(jogos).toContain("classificam_quantidade: e.target.value === 'mata_mata' ? props.value.classificam_quantidade : ''")
  expect(jogos).toContain('value={props.value.classificam_quantidade}')
  expect(jogos).toContain('Sem corte de classificados')
})

test('91C backend e banco usam os campos canônicos do jogo', async () => {
  expect(service).toContain('mata_mata?: boolean')
  expect(service).toContain('classificam_quantidade?: number | null')
  expect(service).toContain("if (!payload.mata_mata) payload.classificam_quantidade = null")
  expect(service).toContain("if (payload.mata_mata && !payload.classificam_quantidade) throw new Error('Informe quantas equipes passam de fase neste jogo mata-mata.')")
  expect(migration).toContain('add column if not exists mata_mata boolean not null default false')
  expect(migration).toContain('add column if not exists classificam_quantidade integer')
})
