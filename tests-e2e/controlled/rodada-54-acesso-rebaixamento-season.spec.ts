import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

test.describe('Rodada 54 — acesso e rebaixamento entre seasons', () => {
  test('classificação anterior gera somente sugestões de mantidas, promovidas e rebaixadas', () => {
    const api = source('web/app/api/campeonatos/[id]/equipes/route.ts')
    expect(api).toContain('loadLigaSeasonSuggestions')
    expect(api).toContain('listarEstatisticasEquipes(previousChampionshipId')
    expect(api).toContain("['mantida', 'promovida', 'rebaixada'].includes(tipo)")
    expect(api).toContain("tipo === 'promovida'")
    expect(api).toContain("tipo === 'rebaixada'")
    expect(api).toContain('promotedOut')
    expect(api).toContain('relegatedOut')
  })

  test('season anterior é localizada pela franquia e edição anterior, sem depender de nome solto', () => {
    const api = source('web/app/api/campeonatos/[id]/equipes/route.ts')
    expect(api).toContain(".from('campeonato_edicoes')")
    expect(api).toContain(".eq('franquia_id', currentEdition.franquia_id)")
    expect(api).toContain(".lt('numero_edicao', Number(currentEdition.numero_edicao))")
    expect(api).toContain(".order('numero_edicao', { ascending: false })")
  })

  test('promoção usa topo, rebaixamento usa fundo e mantidas excluem movimentos de saída', () => {
    const api = source('web/app/api/campeonatos/[id]/equipes/route.ts')
    expect(api).toContain('const promotedOut = new Map<string, number>()')
    expect(api).toContain('const relegatedOut = new Map<string, number>()')
    expect(api).toContain('ranking.slice(offset, Math.min(offset + quantity, ceiling))')
    expect(api).toContain('ranking.slice(start, end)')
    expect(api).toContain('ranking.slice(start, end).slice(0, quantity)')
  })

  test('painel mostra preview e não aplica antes da confirmação explícita', () => {
    const panel = source('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')
    expect(panel).toContain('Nova season · sugestão pela classificação')
    expect(panel).toContain('Nenhuma equipe muda de agrupamento até você confirmar.')
    expect(panel).toContain('window.confirm(')
    expect(panel).toContain('Revisar e confirmar sugestões')
    expect(panel).toContain('aplicarSugestoesSeasonLiga')
  })

  test('aplicação em lote é bloqueada depois que começou preenchimento manual ou há convite reservado', () => {
    const api = source('web/app/api/campeonatos/[id]/equipes/route.ts')
    expect(api).toContain("body.mode === 'apply_league_season_suggestions'")
    expect(api).toContain('A aplicação automática só pode ser usada antes de preencher manualmente os agrupamentos.')
    expect(api).toContain('Existem slots reservados por convite.')
    expect(api).toContain('usedTeams')
    expect(api).toContain('apareceu em mais de uma sugestão')
  })

  test('confirmação reaproveita a line real e preserva origem auditável da vaga', () => {
    const api = source('web/app/api/campeonatos/[id]/equipes/route.ts')
    expect(api).toContain('lineId: item.candidate.line_id')
    expect(api).toContain('equipeId: item.candidate.equipe_id')
    expect(api).toContain('origem: item.origem')
    expect(api).toContain('`liga_${suggestion.tipo}`')
  })

  test('tipos e serviço expõem a sugestão sem criar migration ou cadastro paralelo', () => {
    const types = source('web/features/campeonatos/equipes/types/campeonato-equipes.types.ts')
    const service = source('web/features/campeonatos/equipes/services/campeonato-equipes.service.ts')
    expect(types).toContain('export type LigaSeasonPreview')
    expect(types).toContain('season?: LigaSeasonPreview | null')
    expect(service).toContain('aplicarSugestoesSeasonLiga')
  })
})
