import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 30 — auditoria KillScore x KILL dos jogadores', () => {
  test('KillScore continua sendo o abate oficial da equipe', () => {
    const service = source('backend/src/campeonatos/estatisticas/matchresult.service.ts')
    expect(service).toContain('abates: Number(teamMatch[3])')
    expect(service).toContain('KillScore:')
  })

  test('auditoria soma qualquer quantidade de jogadores sem assumir quatro', () => {
    const service = source('backend/src/campeonatos/estatisticas/matchresult.service.ts')
    expect(service).toContain('export function auditarAbatesEquipe')
    expect(service).toContain('team.jogadores.reduce')
    expect(service).toContain('jogadores_contagem: team.jogadores.length')
    expect(service).not.toContain('jogadores.length === 4')
  })

  test('preview informa soma dos jogadores, conferência e diferença', () => {
    const service = source('backend/src/campeonatos/estatisticas/matchresult.service.ts')
    expect(service).toContain('abates_jogadores')
    expect(service).toContain('abates_conferem')
    expect(service).toContain('diferenca_abates')
    expect(service).toContain('auditarAbatesEquipe(team)')
  })

  test('confirmação recalcula auditoria depois de eventual edição de jogador', () => {
    const service = source('backend/src/campeonatos/estatisticas/matchresult.service.ts')
    expect(service).toContain('Object.assign(team, auditarAbatesEquipe(team))')
  })

  test('editar KILL individual não sobrescreve automaticamente o KillScore da equipe', () => {
    const page = source('web/app/campeonatos/[id]/pontuador/[jogoId]/page.tsx')
    expect(page).toContain('const abatesJogadores = jogadores.reduce')
    expect(page).toContain('const killScore = number(team.abates)')
    expect(page).not.toContain("if (linkedTeamId) patchTeam(linkedTeamId, { abates: String(nextPlayers.reduce")
  })

  test('pontuador mostra conferência e divergência sem bloquear importação', () => {
    const page = source('web/app/campeonatos/[id]/pontuador/[jogoId]/page.tsx')
    expect(page).toContain('previewKillWarnings')
    expect(page).toContain('divergência entre KillScore e soma dos KILL')
    expect(page).toContain('KillScore conferido com a soma dos KILL dos jogadores')
    expect(page).toContain('KILL jogadores:')
  })

  test('alerta usa tratamento visual discreto no pontuador', () => {
    const css = source('web/app/campeonatos/[id]/pontuador/pontuador.css')
    expect(css).toContain('.match-kill-audit.is-ok')
    expect(css).toContain('.match-kill-audit.is-warning')
  })
})
