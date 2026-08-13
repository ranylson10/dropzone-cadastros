import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/stream/types/stream-package.types.ts'), 'utf8')
const publicService = fs.readFileSync(path.join(root, 'web/features/campeonatos/stream/services/stream-package-public.service.ts'), 'utf8')
const tab = fs.readFileSync(path.join(root, 'web/features/campeonatos/stream/components/CampeonatoStreamTab.tsx'), 'utf8')

test('91G overlays deixam claro que a fonte dinâmica é o jogo da live', async () => {
  expect(tab).toContain('Jogo da live · fonte das estatísticas')
  expect(tab).toContain('active_jogo_id: jogoVal')
})

test('91G MVP e booyahs usam o jogo ativo da transmissão', async () => {
  expect(publicService).toContain("if (type === 'mvp_day')")
  expect(publicService).toContain('context.activeJogoId ? { jogoId: context.activeJogoId } : {}')
  expect(publicService).toContain("if (type === 'booyahs_day')")
  expect(publicService).toContain('loadBooyahs(campeonatoId, context.activeJogoId, partidas)')
})

test('91G nomenclatura visual usa jogo em vez de dia', async () => {
  expect(types).toContain("title: 'MVP do jogo'")
  expect(types).toContain("title: 'Booyahs do jogo'")
  expect(types).toContain("mvp_day: { name: 'MVP do jogo', description: 'Líderes individuais do jogo selecionado.'")
  expect(types).toContain("booyahs_day: { name: 'Booyahs do jogo', description: 'Cards das equipes vencedoras por mapa no jogo selecionado.'")
})
