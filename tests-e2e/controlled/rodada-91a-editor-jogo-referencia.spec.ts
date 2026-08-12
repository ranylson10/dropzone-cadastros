import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')

test('91A editor usa jogo apenas como referencia de preview', async () => {
  expect(workspace).toContain("const [editorReferenceGameId, setEditorReferenceGameId] = useState('')")
  expect(workspace).toContain('Dados de pré-visualização')
  expect(workspace).toContain('Sem jogo de referência')
  expect(workspace).toContain('Usado somente para visualizar e testar o modelo. O jogo não fica preso ao template.')
  expect(workspace).toContain("mode === 'edit' && editorReferenceGame ? resolveProjectForGame(draft, editorReferenceGame) : draft")
})

test('91A classificados usam o Top configurado no jogo de referencia', async () => {
  expect(workspace).toContain('function resolveBlockForGame(')
  expect(workspace).toContain("block.type === 'qualified_teams' && game.mataMata && game.classificamQuantidade")
  expect(workspace).toContain('{ dataStart: 1, dataEnd: game.classificamQuantidade }')
  expect(workspace).toContain('const block = resolveBlockForGame(rawBlock, editorReferenceGame)')
})
