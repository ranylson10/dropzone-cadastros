import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 38 — desempenho privado do jogador e eficiência da equipe', () => {
  test('painel do jogador ganha aba de desempenho com gráficos', () => {
    const panel = source('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
    expect(panel).toContain("'desempenho'")
    expect(panel).toContain('Meu desempenho')
    expect(panel).toContain('TrendChart')
    expect(panel).toContain('Kills')
    expect(panel).toContain('Dano')
    expect(panel).toContain('Sobrevivência')
    expect(panel).toContain('Colocação')
  })

  test('jogador recebe apenas a própria telemetria autenticada', () => {
    const api = source('web/app/api/lili/jogadores/route.ts')
    expect(api).toContain("playerAccounts.find")
    expect(api).toContain(".eq('jogador_id', account.id)")
    expect(api).toContain(".in('campeonato_jogador_id', formationIds)")
    expect(api).toContain('matchHistory: enrichedMatchHistory')
    expect(api).toContain('garena_matchstats_armas')
    expect(api).toContain('garena_matchstats_habilidades')
  })

  test('painel do jogador agrega mapa armas habilidades e leitura técnica', () => {
    const panel = source('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
    expect(panel).toContain('Por mapa')
    expect(panel).toContain('Armas')
    expect(panel).toContain('Habilidades')
    expect(panel).toContain('Leitura técnica')
    expect(panel).toContain('headshots')
    expect(panel).toContain('knockdowns')
    expect(panel).toContain('precisão')
  })

  test('equipe agrega eficiência de armas e habilidades sem consulta extra', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('buildTrainingTechnicalEfficiency')
    expect(panel).toContain('Eficiência técnica')
    expect(panel).toContain('Armas e habilidades agregadas da equipe neste treino.')
  })

  test('layout mantém duas colunas no desktop e uma no mobile', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.player-performance-sections{display:grid;grid-template-columns:repeat(2')
    expect(css).toContain('.player-performance-sections{grid-template-columns:1fr}')
    expect(css).toContain('.team-training-technical-grid{display:grid;grid-template-columns:repeat(2')
    expect(css).toContain('.team-training-technical-grid{grid-template-columns:1fr}')
  })
})
