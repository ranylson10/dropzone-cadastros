import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const panel = fs.readFileSync(path.join(root, 'web/features/dropzone/panels/equipe/EquipePanel.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'web/app/globals.css'), 'utf8')

test('rodada 45 calcula sinergia usando jogadores que realmente atuaram juntos', () => {
  expect(panel).toContain('function buildSquadSynergy(training: TeamTraining)')
  expect(panel).toContain("player.player_id || player.campeonato_jogador_id || player.nick")
  expect(panel).toContain('combinations(players, size)')
  expect(panel).toContain("for (const size of [2, 3] as const)")
})

test('rodada 45 mostra participação, equilíbrio e dependência da line', () => {
  expect(panel).toContain('Sinergia da line')
  expect(panel).toContain('dos kills')
  expect(panel).toContain('do dano')
  expect(panel).toContain("dependency >= 50 ? 'dependente'")
  expect(panel).toContain("dependency >= 40 ? 'atencao'")
  expect(panel).toContain('Dependência é sinal de concentração estatística')
})

test('rodada 45 exige amostra mínima para duplas trios e composições', () => {
  expect(panel).toContain('.filter((row) => row.quedas >= 2)')
  expect(panel).toContain('Duplas nos melhores resultados')
  expect(panel).toContain('Trios nos melhores resultados')
  expect(panel).toContain('Composição por mapa')
  expect(panel).toContain('Composição consistente')
})

test('rodada 45 mantém layout mobile enxuto sem nova dependência visual', () => {
  expect(css).toContain('body .team-squad-synergy')
  expect(css).toContain('@media(max-width:760px)')
  expect(css).toContain('body .team-squad-synergy-combos{grid-template-columns:1fr}')
})
