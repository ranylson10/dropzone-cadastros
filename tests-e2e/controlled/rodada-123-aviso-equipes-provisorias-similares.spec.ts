import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { compareTeamNames, findTeamNameMatches } from '../../web/features/produtoras/lib/team-name-similarity'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('cadastro provisório consulta nomes iguais e parecidos sem bloquear a criação', () => {
  const panel = read('web/features/produtoras/components/ProvisionalTeamsPanel.tsx')
  const route = read('web/app/api/produtora/equipes-provisorias/route.ts')
  const similarity = read('web/features/produtoras/lib/team-name-similarity.ts')

  expect(panel).toContain("action: 'check_names'")
  expect(panel).toContain('Nome já cadastrado')
  expect(panel).toContain('Nome parecido encontrado')
  expect(panel).toContain('É apenas um aviso. Você pode manter ou remover esta linha.')
  expect(panel).not.toMatch(/disabled=.*bulkNameMatches/)
  expect(route).toContain("body?.action === 'check_names'")
  expect(route).toContain(".from('equipes')")
  expect(similarity).toContain("kind: 'exact'")
  expect(similarity).toContain("kind: 'similar'")
  expect(similarity).toContain('score >= 0.72 || contained')
})

test('a conferência expõe somente dados públicos mínimos das equipes encontradas', () => {
  const route = read('web/app/api/produtora/equipes-provisorias/route.ts')
  expect(route).toContain(".select('id,nome,tag,public_id')")
})

test('comparação diferencia nomes iguais, parecidos e sem relação', () => {
  expect(compareTeamNames('Tropa do Pará', 'tropa do para')).toMatchObject({ kind: 'exact', score: 1 })
  expect(compareTeamNames('Fluxo', 'Flux')).toMatchObject({ kind: 'similar' })
  expect(compareTeamNames('Aloe Gaming', 'Aloe')).toMatchObject({ kind: 'similar' })
  expect(compareTeamNames('Amazon Cria', 'Dragões do Sul')).toMatchObject({ kind: null })

  const matches = findTeamNameMatches('Fluxo', [
    { id: '1', nome: 'Fluxo' },
    { id: '2', nome: 'Flux' },
    { id: '3', nome: 'Outra Equipe' },
  ])
  expect(matches.map((match) => match.kind)).toEqual(['exact', 'similar'])
})
