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
    expect(web).toContain('Acumula na Grande Final')
    expect(mobile).toContain('Você pode distribuir a decisão em vários dias.')
    expect(mobile).toContain('Champion Point')

    // O projeto já possuía a configuração-base do Champion Point/Booyah de Ouro.
    expect(service).toContain("modo_decisao?: 'pontuacao_normal' | 'booyah_ouro'")
    expect(service).toContain('booyah_ouro_pontos_limite')
    expect(service).toContain('booyah_ouro_queda_minima')
  })
})
