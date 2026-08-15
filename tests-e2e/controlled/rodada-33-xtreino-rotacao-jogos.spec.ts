import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 33 — XTreino operacional com rotação de mapas', () => {
  test('novo jogo usa a quantidade de quedas configurada no XTreino', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("selectedChamp.data?.partidas_por_jogo || 4")
    expect(panel).toContain('const defaultDrops = isXtreino ? xtreinoDrops : 6')
    expect(panel).toContain('numero_partidas: String(defaultDrops)')
  })

  test('rotação repete os mapas configurados', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain('function xtreinoMapRotation(total: number, current: string[] = [])')
    expect(panel).toContain('configured[index % configured.length]')
    expect(panel).toContain('const defaultMaps = isXtreino ? xtreinoMapRotation(defaultDrops)')
  })

  test('mapas alterados manualmente são preservados ao redimensionar', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain('current[index] || configured[index % configured.length]')
    expect(panel).toContain('xtreinoMapRotation(total, props.game.mapas)')
  })

  test('XTreino pré-seleciona fase e grupos da estrutura padrão', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("const defaultPhaseId = options?.phaseId || (isXtreino ? orderedChampPhases[0]?.id || '' : '')")
    expect(panel).toContain("champGroups.filter((group) => String(group.data?.fase_id || '') === defaultPhaseId).map((group) => group.id)")
  })

  test('novo jogo recebe nome de treino automaticamente', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain('`Treino ${champGames.length + 1}`')
  })

  test('editor alternativo também respeita configuração do XTreino', () => {
    const jogos = source('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')
    expect(jogos).toContain("const isXtreino = String(props.campeonato.data?.tipo || '').toLowerCase() === 'xtreino'")
    expect(jogos).toContain('function buildXtreinoRotation(total: number, current: string[] = [])')
    expect(jogos).toContain("mapas: isXtreino ? buildXtreinoRotation(xtreinoDrops).join(', ') : ''")
    expect(jogos).toContain('XTREINO_MAP_LABELS')
  })

  test('interface informa que a rotação continua editável', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const jogos = source('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')
    const css = source('web/app/globals.css')
    expect(panel).toContain('Plano do XTreino aplicado')
    expect(panel).toContain('Você pode alterar qualquer queda manualmente.')
    expect(jogos).toContain('Os mapas continuam editáveis.')
    expect(css).toContain('.xtreino-game-plan{display:grid;gap:8px')
  })

  test('não cria persistência paralela para a rotação', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain('props.createGame()')
    expect(panel).not.toContain('xtreino_jogos')
    expect(panel).not.toContain('xtreino_quedas')
  })
})
