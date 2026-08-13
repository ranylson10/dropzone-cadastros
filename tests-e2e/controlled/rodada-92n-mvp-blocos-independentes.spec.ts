import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const types = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/types/artwork.types.ts'), 'utf8')

test('92N - MVP top 1 e tabela viram blocos independentes', async () => {
  expect(types).toContain("'mvp_general_card'")
  expect(types).toContain("'mvp_general_table'")
  expect(workspace).toContain('Card MVP Top 1')
  expect(workspace).toContain('Tabela MVP')
  expect(workspace).toContain("createMvpGeneralCardBlock")
  expect(workspace).toContain("createMvpGeneralTableBlock")
})

test('92N - tabela MVP reutiliza configuracao generica de tabela', async () => {
  expect(workspace).toContain("selectedBlock.type === 'mvp_general_table'")
  expect(workspace).toContain('normalizeTableStyle(block)')
  expect(workspace).toContain('tableStyleWithColumns')
  expect(workspace).toContain('patchTableStyle')
  expect(workspace).toContain('post-artworks-table-block')
})

test('92N - card e tabela podem ser arrastados separadamente', async () => {
  expect(workspace).toContain("block.visible && block.type === 'mvp_general_table'")
  expect(workspace).toContain("block.type === 'mvp_general_card'")
  expect(workspace).toContain('onPointerDown={(event) => beginDrag(event, block)}')
  expect(workspace).toContain("dataStart: 1, dataEnd: 1")
  expect(workspace).toContain("dataStart: 2, dataEnd: 10")
})
