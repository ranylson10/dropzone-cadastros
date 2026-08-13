import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')

test('91B artes salvas usam o jogo escolhido sem prender o template', async () => {
  expect(workspace).toContain("(mode === 'generate' || mode === 'manage') ? resolveProjectForGame(draft, generationGame)")
  expect(workspace).toContain('Gerar com dados do jogo')
  expect(workspace).toContain('A prévia e os downloads usam os dados desse jogo sem alterar o template salvo.')
  expect(workspace).toContain('Selecione um jogo para gerar os templates com Tabela do Jogo, Classificados, MVP e Booyahs atualizados.')
})

test('91B download dos cards resolve o template para o jogo selecionado', async () => {
  expect(workspace).toContain('exportArtwork(resolveProjectForGame(item, generationGame))')
  expect(workspace).toContain("generationGame ? ` · Dados: ${generationGame.nome}` : ''")
  expect(workspace).toContain("draft.slice_count > 1 ? 'Baixar carrossel' : `Baixar ${draft.output_format.toUpperCase()}`")
})

test('91B classificados continuam obedecendo o Top do jogo selecionado', async () => {
  expect(workspace).toContain("block.type === 'qualified_teams' ? { dataStart: 1, dataEnd: game.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0 } : {}")
  expect(workspace).toContain("Mata-mata · Top ${generationGame.classificamQuantidade || '—'} classifica")
})
