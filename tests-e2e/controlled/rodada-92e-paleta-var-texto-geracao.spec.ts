import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

test('92E - tabela de artes oferece coluna VAR e reutiliza movimento do ranking', async () => {
  const types = source('web/features/campeonatos/artes-postagem/types/artwork.types.ts')
  const workspace = source('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')
  const data = source('web/features/campeonatos/artes-postagem/services/post-artwork-data.service.ts')

  expect(types).toContain("'movement'")
  expect(workspace).toContain("movement: { label: 'VAR'")
  expect(workspace).toContain("return value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-same'")
  expect(data).toContain("loadStreamSheet(campeonatoId, jogoId ? 'equipes_jogo' : 'equipes_geral'")
  expect(data).toContain("movementByTeam.get(normalizeTeamName(row.nome || row.tag))")
})

test('92E - projeto mantém paleta curta e troca a cor no template inteiro', async () => {
  const workspace = source('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')

  expect(workspace).toContain("const DEFAULT_PROJECT_PALETTE = ['#8FCE00', '#15171C', '#FFFFFF']")
  expect(workspace).toContain('function replaceProjectColor')
  expect(workspace).toContain('Paleta do projeto')
  expect(workspace).toContain('Ao trocar uma cor aqui, todos os usos iguais no template acompanham.')
  expect(workspace).toContain("currentPalette.length < 6")
})

test('92E - informação do jogo é editada apenas na geração e entra na exportação', async () => {
  const workspace = source('web/features/campeonatos/artes-postagem/components/PostArtworkWorkspace.tsx')

  expect(workspace).toContain('function generationCaptionForGame')
  expect(workspace).toContain('Informação do jogo')
  expect(workspace).toContain('Este texto entra somente na imagem gerada. O template salvo não é alterado.')
  expect(workspace).toContain("mode === 'edit' ? '' : generationCaption")
  expect(workspace).toContain('if (exportCaption.trim())')
})
