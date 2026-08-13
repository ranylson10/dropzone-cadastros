import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const workspacePath = path.resolve(process.cwd(), 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
const source = fs.readFileSync(workspacePath, 'utf8')

test('91J - lista de blocos usa o mesmo jogo de referencia da previa', async () => {
  expect(source).toContain('const block = resolveBlockForGame(rawBlock, editorReferenceGame)')
  expect(source).toContain('const isGameDataBlock = GAME_DATA_BLOCK_TYPES.has(block.type)')
})

test('91J - bloco dinamico mostra claramente o jogo usado apenas na previa', async () => {
  expect(source).toContain("editorReferenceGame ? `Prévia: ${editorReferenceGame.nome}` : 'Prévia sem jogo'")
  expect(source).not.toContain("`${block.source?.jogoName || 'Jogo não selecionado'} · `")
})

test('91J - corte dos classificados exibido na lista acompanha o jogo de referencia', async () => {
  expect(source).toContain("block.type === 'qualified_teams' ? (block.dataEnd && block.dataEnd > 0 ? `Top ${block.dataEnd} passam` : 'Quantidade definida pelo jogo')")
  expect(source).toContain('game.mataMata && game.classificamQuantidade && game.classificamQuantidade > 0 ? game.classificamQuantidade : 0')
})
