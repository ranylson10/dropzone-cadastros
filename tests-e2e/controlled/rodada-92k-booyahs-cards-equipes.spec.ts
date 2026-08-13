import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const workspace = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx'), 'utf8')
const service = fs.readFileSync(path.join(root, 'web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts'), 'utf8')
const route = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/artes-postagem/booyahs/route.ts'), 'utf8')

test('92K - booyahs deixam de ser tabela e viram cards por queda', async () => {
  expect(workspace).toContain("block.type === 'booyahs_day'")
  expect(workspace).toContain('post-artworks-booyah-card')
  expect(workspace).toContain('booyahCardWidth(style, rows.length')
  expect(workspace).not.toContain("selectedBlock.type === 'booyahs_day') ? normalizeTableStyle")
})

test('92K - card usa somente dados da equipe vencedora da queda', async () => {
  expect(route).toContain("if (!row.booyah) continue")
  expect(route).toContain('winnerByPartida')
  expect(route).toContain('pontos_total')
  expect(route).toContain('abates')
  expect(route).not.toContain('jogador')
  expect(service).toContain('/artes-postagem/booyahs?jogo_id=')
})

test('92K - usuario controla altura e largura geral e cards se ajustam', async () => {
  expect(workspace).toContain('Altura dos cards')
  expect(workspace).toContain('Largura geral')
  expect(workspace).toContain('(style.totalWidth - Math.max(0, count - 1) * style.gap) / count')
  expect(workspace).toContain('mantendo a largura geral definida')
})
