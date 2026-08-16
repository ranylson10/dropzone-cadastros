import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 53 — formação operacional da Liga', () => {
  test('Liga prepara grupos físicos somente quando a produtora inicia a formação', () => {
    const teams = read('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')
    const service = read('web/features/campeonatos/equipes/services/campeonato-equipes.service.ts')
    expect(teams).toContain('Preparar agrupamentos')
    expect(teams).toContain("nome: 'Liga'")
    expect(teams).toContain("grupos: data.liga.divisoes.map")
    expect(service).toContain('prepararLiga:')
    expect(service).toContain('/estrutura`')
  })

  test('cada slot da Liga exige a origem operacional planejada', () => {
    const teams = read('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')
    expect(teams).toContain('Origem desta vaga')
    expect(teams).toContain('LIGA_ENTRY_LABELS')
    expect(teams).toContain("...(origemEntrada ? { origem_entrada: origemEntrada } : {})")
    for (const label of ['Mantida', 'Promovida', 'Rebaixada', 'Classificatória aberta', 'Vaga paga', 'Convite direto']) {
      expect(teams).toContain(label)
    }
  })

  test('API valida cota por origem e agrupamento', () => {
    const api = read('web/app/api/campeonatos/[id]/equipes/route.ts')
    expect(api).toContain('LIGA_ENTRY_TYPES')
    expect(api).toContain("const normalizedOrigin = `liga_${requestedOrigin}`")
    expect(api).toContain(".eq('grupo_id', slot.grupo_id)")
    expect(api).toContain("if (Number(usedOrigin || 0) >= quota)")
    expect(api).toContain('A cota desta origem já foi preenchida')
  })

  test('mesma equipe não pode ocupar dois agrupamentos da mesma Liga', () => {
    const api = read('web/app/api/campeonatos/[id]/equipes/route.ts')
    expect(api).toContain(".eq('equipe_id', equipeId)")
    expect(api).toContain('Esta equipe já ocupa uma vaga em outro agrupamento desta Liga.')
  })

  test('painel mostra preenchimento de cada origem sem abrir configuração pesada', () => {
    const teams = read('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')
    const css = read('web/features/campeonatos/equipes/campeonato-equipes.css')
    expect(teams).toContain('champ-league-entry-progress')
    expect(teams).toContain('used}/{entry.quantidade}')
    expect(css).toContain('.champ-league-entry-progress{display:flex')
    expect(css).toContain('@media(max-width:760px)')
  })

  test('configuração detalhada da Liga só é devolvida para quem pode gerenciar equipes', () => {
    const api = read('web/app/api/campeonatos/[id]/equipes/route.ts')
    expect(api).toContain('if (!canManage) return null')
    expect(api).toContain('loadLigaConfig(id, permission.canManage)')
    expect(api).toContain('liga,')
  })
})
