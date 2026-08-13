import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 8 — jogos, quedas e resultados', () => {
  test('agenda é agrupada por fase com resumo operacional', () => {
    const source = read('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')
    expect(source).toContain('const gameStats = useMemo')
    expect(source).toContain('const phaseSections = useMemo')
    expect(source).toContain('Agenda de jogos')
    expect(source).toContain('<small>agendados</small>')
    expect(source).toContain('<small>em andamento</small>')
    expect(source).toContain('<small>finalizados</small>')
  })

  test('cada jogo prioriza data, grupos, quedas e status', () => {
    const source = read('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')
    expect(source).toContain('champ-game-date')
    expect(source).toContain('champ-game-copy')
    expect(source).toContain('champ-game-rounds')
    expect(source).toContain('champ-game-status')
    expect(source).toContain('Sequência de quedas')
    expect(source).toContain("mapas[index] || 'Mapa não definido'")
  })

  test('edição continua preservando regras existentes do campeonato', () => {
    const source = read('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')
    expect(source).toContain('Champion Point / Booyah de Ouro')
    expect(source).toContain('Point Rush')
    expect(source).toContain('Controle de escalação')
    expect(source).toContain('Criar jogo e quedas')
    expect(source).toContain('props.updateGame')
    expect(source).toContain('props.deleteGame')
  })

  test('mobile usa linhas curtas em vez de cards altos', () => {
    const css = read('web/features/campeonatos/jogos/campeonato-jogos.css')
    expect(css).toContain('@media(max-width:760px)')
    expect(css).toContain('min-height:54px')
    expect(css).toContain('grid-template-columns:48px minmax(0,1fr) auto 15px')
    expect(css).not.toContain('box-shadow:')
    expect(css).not.toContain('backdrop-filter:')
  })
})
