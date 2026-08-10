import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Campeonato — Grande Final, multi-dia e Champion Point', () => {
  test('formaliza uma única Grande Final com Grupo da Final automático', async () => {
    const migration = read('database/migrations/20260810_grande_final_multi_dia.sql')
    const structure = read('web/app/api/campeonatos/[id]/estrutura/route.ts')
    const web = read('web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx')
    const mobile = read('app/src/screens/ChampionshipManagementScreen.tsx')

    expect(migration).toContain("tipo in ('normal', 'grande_final')")
    expect(migration).toContain('campeonato_fases_grande_final_unique')
    expect(structure).toContain("nome: 'Grupo da Final'")
    expect(structure).toContain('Este campeonato já possui uma Grande Final')
    expect(structure).toContain('A Grande Final usa somente o "Grupo da Final"')
    expect(web).toContain('Grande Final')
    expect(web).toContain('Slots do Grupo da Final')
    expect(mobile).toContain('Grande Final e Grupo da Final criados.')
  })

  test('jogos finais suportam vários dias sem obrigar um único jogo a definir o campeão', async () => {
    const migration = read('database/migrations/20260810_grande_final_multi_dia.sql')
    const service = read('backend/src/campeonatos/jogos/jogos.service.ts')
    const web = read('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')
    const mobile = read('app/src/screens/ChampionshipGamesPanel.tsx')

    expect(migration).toContain("tipo_jogo in ('normal', 'final')")
    expect(migration).toContain('dia_final integer')
    expect(migration).toContain('define_campeao boolean')
    expect(service).toContain("payload.tipo_jogo = 'final'")
    expect(service).toContain("payload.dia_final = payload.dia_final || 1")
    expect(web).toContain('Dia da Grande Final')
    expect(web).toContain('Pontuação acumulada em todos os dias')
    expect(web).toContain('Point Rush · dias anteriores viram bônus')
    expect(mobile).toContain('A final pode somar todos os dias ou usar Point Rush')
    expect(mobile).toContain('Champion Point')

    // O projeto já possuía a configuração-base do Champion Point/Booyah de Ouro.
    expect(service).toContain("modo_decisao?: 'pontuacao_normal' | 'booyah_ouro'")
    expect(service).toContain('booyah_ouro_pontos_limite')
    expect(service).toContain("modo_acumulacao?: 'acumulado' | 'bonus_por_ranking'")
    expect(service).toContain("papel_na_fase?: 'normal' | 'classificatorio_bonus' | 'decisivo'")
  })

  test('configura a regra da final e abre estatísticas pelo campeão quando a final termina', async () => {
    const service = read('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
    const gamesService = read('backend/src/campeonatos/jogos/jogos.service.ts')
    const route = read('web/app/api/campeonatos/[id]/estatisticas/campeao/route.ts')
    const webGame = read('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')
    const webStats = read('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')
    const publicStats = read('web/features/directory/components/ChampionshipPublicView.tsx')
    const mobileGame = read('app/src/screens/ChampionshipGamesPanel.tsx')
    const mobilePublic = read('app/src/screens/ChampionshipPublicScreen.tsx')

    expect(webGame).toContain('Configurações adicionais')
    expect(webGame).toContain('Champion Point / Booyah de Ouro')
    expect(webGame).toContain('/configuracao-jogos')
    expect(webGame).toContain('Aplicar bônus do Point Rush')
    expect(webGame).not.toContain('Champion Point a partir da queda')
    expect(gamesService).toContain("papel_na_fase: 'classificatorio_bonus'")
    expect(gamesService).toContain("papel_na_fase: 'decisivo'")
    expect(mobileGame).toContain('CRITÉRIO DO CAMPEÃO')
    expect(mobileGame).toContain('Pontuação mínima para ativar')
    expect(mobileGame).toContain('Point Rush')
    expect(mobileGame).not.toContain('A partir da queda')
    expect(mobileGame).not.toContain('SE NINGUÉM FECHAR O CHAMPION POINT')
    expect(route).toContain('carregarResumoCampeao')
    expect(service).toContain(".eq('tipo', 'grande_final')")
    expect(service).toContain('campeonato_estatisticas_equipes_detalhe')
    expect(service).toContain("modo_final: pointRush ? 'point_rush' : 'acumulado'")
    expect(service).toContain('campeonato_fases_bonus_equipes')
    expect(webStats).toContain('Line campeã')
    expect(webStats).toContain('Jogadores da Grande Final')
    expect(webStats).toContain('Estatísticas do campeonato')
    expect(publicStats).toContain('champion-public-spotlight')
    expect(mobilePublic).toContain('CAMPEÃO DA GRANDE FINAL')
    expect(mobilePublic).toContain('Ver MVP')
  })

})
