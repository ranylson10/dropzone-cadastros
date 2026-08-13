import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const workspacePath = path.resolve(process.cwd(), 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const source = fs.readFileSync(workspacePath, 'utf8')

test('91I - gerador nao escolhe automaticamente o primeiro jogo ao carregar', async () => {
  expect(source).toContain("setGenerationGameId((current) => current && nextGames.some((game) => game.id === current) ? current : '')")
  expect(source).not.toContain("setGenerationGameId((current) => current || nextGames[0]?.id || '')")
})

test('91I - trocar a fase limpa o jogo e exige nova escolha explicita', async () => {
  const occurrences = source.match(/setGenerationPhaseId\(faseId\); setGenerationGameId\(''\)/g) || []
  expect(occurrences.length).toBeGreaterThanOrEqual(2)
  expect(source).not.toContain("const first = games.find((game) => game.faseId === faseId)")
})

test('91I - artes dinamicas continuam bloqueadas enquanto nenhum jogo for escolhido', async () => {
  expect(source).toContain("projectRequiresGame(draft) && !generationGame")
  expect(source).toContain("'Selecione o jogo'")
})
