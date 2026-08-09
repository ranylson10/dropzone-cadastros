import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()
const read = (file:string) => fs.readFileSync(path.join(root,file),'utf8')

test.describe('Mobile campeonato — rodadas, jogos, quedas e mapas', () => {
  test('usa contratos oficiais sem criar fluxo paralelo', async () => {
    const panel = read('app/src/screens/ChampionshipGamesPanel.tsx')
    const api = read('app/src/lib/api.ts')
    const service = read('backend/src/campeonatos/jogos/jogos.service.ts')

    expect(panel).toContain('championshipRounds')
    expect(panel).toContain('createChampionshipRound')
    expect(panel).toContain('updateChampionshipRound')
    expect(panel).toContain('deleteChampionshipRound')
    expect(panel).toContain('createChampionshipGame')
    expect(panel).toContain('updateChampionshipGame')
    expect(panel).toContain('updateChampionshipFallMap')
    expect(panel).toContain('MAPA POR QUEDA')
    expect(panel).toContain('GRUPOS PARTICIPANTES')

    expect(api).toContain('/rodadas')
    expect(api).toContain('/jogos/${encodeURIComponent(gameId)}/quedas/${encodeURIComponent(fallId)}/mapa')
    expect(api).toContain("mapCatalog: () => dropzoneFetch<any>('/api/mapas'")

    expect(service).toContain('Selecione um mapa para cada queda.')
    expect(service).toContain('Não é possível alterar o mapa de uma queda finalizada.')
    expect(service).toContain('Remova ou desvincule os jogos desta rodada antes de excluí-la.')
  })
})
