import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const workspacePath = path.resolve(process.cwd(), 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const source = fs.readFileSync(workspacePath, 'utf8')

test('92C - seletor de jogo de referencia fica visivel mesmo com bloco selecionado', async () => {
  const selector = 'Jogo de referência da prévia'
  const selectorIndex = source.indexOf(selector)
  const selectedBlockConditionalIndex = source.indexOf('{!selectedBlock ? <>', selectorIndex)

  expect(selectorIndex).toBeGreaterThan(-1)
  expect(selectedBlockConditionalIndex).toBeGreaterThan(selectorIndex)
})

test('92C - seletor lista os jogos carregados e mostra regra de corte mata-mata', async () => {
  expect(source).toContain('{games.map((game) => <option key={game.id} value={game.id}>')
  expect(source).toContain('game.mataMata && game.classificamQuantidade')
  expect(source).toContain('` · Top ${game.classificamQuantidade} passa`')
})

test('92C - jogo escolhido continua sendo apenas referencia de previa', async () => {
  expect(source).toContain('value={editorReferenceGameId}')
  expect(source).toContain('setEditorReferenceGameId(event.target.value)')
  expect(source).toContain('o jogo não fica preso ao template')
  expect(source).toContain('resolveProjectForGame(draft, editorReferenceGame)')
})
