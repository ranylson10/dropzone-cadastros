import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function source(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test.describe('Rodada 87I — fontes corretas das overlays', () => {
  test('equipes do jogo usa os slots do jogo selecionado', () => {
    const route = source('web/app/api/campeonatos/[id]/stream/data/route.ts')
    expect(route).toContain("sheet === 'equipes_jogo'")
    expect(route).toContain("from('campeonato_pontuador_slots_jogo')")
    expect(route).toContain("eq('jogo_id', jogoId)")
  })

  test('partida usa somente o resultado da queda selecionada', () => {
    const route = source('web/app/api/campeonatos/[id]/stream/data/route.ts')
    const types = source('web/features/campeonatos/stream/types/stream.types.ts')
    expect(route).toContain("sheet === 'equipes_partida'")
    expect(route).toContain('partidaId: selectedPartidaId')
    expect(types).toContain("{ key: 'pontos_posicao', label: 'Pts posição'")
    expect(types).toContain("{ key: 'pontos_abates', label: 'Pts kills'")
  })

  test('separa jogadores do mapa e MVP por partida, dia e geral', () => {
    const types = source('web/features/campeonatos/stream/types/stream.types.ts')
    const service = source('web/features/campeonatos/stream/services/stream-data.service.ts')
    for (const id of ['jogadores_mapa', 'mvp_partida', 'mvp_dia', 'mvp_geral']) {
      expect(types).toContain(`id: '${id}'`)
    }
    expect(service).toContain("loadDedicatedMvpRows(campeonatoId, 'jogadores_mapa'")
    expect(service).toContain("loadDedicatedMvpRows(campeonatoId, 'mvp_partida'")
    expect(service).toContain("loadDedicatedMvpRows(campeonatoId, 'mvp_dia'")
  })

  test('equipes do próximo mapa não cai silenciosamente na tabela geral', () => {
    const route = source('web/app/api/campeonatos/[id]/stream/data/route.ts')
    const service = source('web/features/campeonatos/stream/services/stream-data.service.ts')
    expect(route).toContain("sheet === 'equipes_mapa'")
    expect(route).toContain('picked.next || picked.current')
    expect(service).toContain("loadDedicatedStreamSheet(campeonatoId, 'equipes_mapa'")
  })
})
