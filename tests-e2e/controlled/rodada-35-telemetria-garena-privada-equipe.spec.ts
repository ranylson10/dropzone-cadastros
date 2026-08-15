import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 35 — telemetria Garena privada da equipe', () => {
  test('rota de treinos lê somente telemetria de participações controladas', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')
    expect(route).toContain(".from('garena_matchstats_jogadores')")
    expect(route).toContain(".in('campeonato_equipe_id', participacaoIds)")
    expect(route).toContain(".eq('status', 'concluida')")
  })

  test('armas e habilidades são carregadas pelas linhas privadas da Garena', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')
    expect(route).toContain(".from('garena_matchstats_armas')")
    expect(route).toContain(".from('garena_matchstats_habilidades')")
    expect(route).toContain('armasByJogadorMatchstats')
    expect(route).toContain('habilidadesByJogadorMatchstats')
  })

  test('telemetria é ligada à queda pela importação e partida', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')
    expect(route).toContain('garenaPartidaByImportacao')
    expect(route).toContain('garenaByParticipacaoPartida')
    expect(route).toContain('telemetria_garena: garenaPlayers.length > 0')
  })

  test('payload privado inclui métricas detalhadas do jogador', () => {
    const route = source('web/app/api/equipe/treinos/route.ts')
    expect(route).toContain('precisao_percentual')
    expect(route).toContain('headshots')
    expect(route).toContain('sobrevivencia_segundos')
    expect(route).toContain('distancia_max_abate')
    expect(route).toContain('granadas_usadas')
    expect(route).toContain('gel_usado')
  })

  test('painel mostra telemetria por jogador sem misturar na tabela pública', () => {
    const panel = source('web/features/dropzone/panels/equipe/EquipePanel.tsx')
    expect(panel).toContain('Telemetria Garena')
    expect(panel).toContain('drop.jogadores_detalhados.map')
    expect(panel).toContain('Armas')
    expect(panel).toContain('Habilidades')
    expect(panel).toContain('privado')
  })

  test('mobile reorganiza métricas detalhadas', () => {
    const css = source('web/app/globals.css')
    expect(css).toContain('.team-training-telemetry-metrics{display:grid;grid-template-columns:repeat(6')
    expect(css).toContain('.team-training-telemetry-metrics{grid-template-columns:repeat(3')
  })
})
