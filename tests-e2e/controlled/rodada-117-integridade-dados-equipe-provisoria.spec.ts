import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

test('painel da equipe isola jogadores, lines, campeonatos e treinos pela equipe ativa', async () => {
  const source = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')

  expect(source).toContain("const [activeTeamId, setActiveTeamId] = useState('')")
  expect(source).toContain("props.playerTeams.filter((row) => row.ref_id === selectedTeamId)")
  expect(source).toContain("props.teamLines.filter((line) => line.ref_id === selectedTeamId)")
  expect(source).toContain("lineups.filter((lineup) => String(lineup.equipe_id || '') === selectedTeamId)")
  expect(source).toContain("trainings.filter((training) => training.equipe_id === selectedTeamId)")
  expect(source).toContain('Equipe em análise')
})

test('MatchStats usa somente a importação concluída mais recente de cada queda', async () => {
  const source = read('web/app/api/equipe/treinos/route.ts')

  expect(source).toContain("const latestImportByDrop = new Map<string, any>()")
  expect(source).toContain("if (!current || candidateAt >= currentAt) latestImportByDrop.set(key, item)")
  expect(source).toContain("garenaImportacoes = [...latestImportByDrop.values()]")
})

test('telemetria real da Garena prevalece para roster e métricas privadas quando disponível', async () => {
  const source = read('web/app/api/equipe/treinos/route.ts')

  expect(source).toContain("const telemetryRows = garenaRowsByParticipacao.get(participacaoId) || []")
  expect(source).toContain("const jogadores = [...(telemetryPlayers.size ? telemetryPlayers : players).values()]")
  expect(source).toContain("(garenaPlayers.length ? garenaPlayers : dropPlayers).reduce")
  expect(source).toContain("line_id: participacao.line_id ? String(participacao.line_id) : null")
})

test('seletor de equipe segue visual do sistema e é responsivo', async () => {
  const css = read('web/app/globals.css')
  expect(css).toContain('.team-context-switch{display:flex;')
  expect(css).toContain('.team-context-switch select{width:min(320px,42vw);')
  expect(css).toContain('@media (max-width:720px){.team-context-switch')
})
