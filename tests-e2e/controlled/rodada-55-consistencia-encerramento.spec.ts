import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function source(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

test.describe('Rodada 55 — consistência e encerramento', () => {
  test('painel normal encerra e reabre usando backend existente', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    expect(panel).toContain("updateEditionLifecycle(action: 'publish_final' | 'reopen_final')")
    expect(panel).toContain('Encerrar campeonato')
    expect(panel).toContain('Reabrir season')
    expect(panel).toContain('/estrutura-avancada')
  })

  test('encerramento fecha inscrições sem criar agenda ou ranking paralelo', () => {
    const route = source('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
    expect(route).toContain("action === 'publish_final'")
    expect(route).toContain("aceita_novas_inscricoes_equipes: false")
    expect(route).toContain("String(championship.tipo || '').toLowerCase() === 'liga'")
    expect(route).toContain("listarEstatisticasEquipes(campeonatoId, { grupoId: String(group.id) })")
  })

  test('liga exige classificação de cada agrupamento para encerrar', () => {
    const route = source('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
    expect(route).toContain('A Liga ainda não possui agrupamentos para encerrar.')
    expect(route).toContain('ainda não possui classificação calculada.')
    expect(route).toContain('final_campeao_campeonato_equipe_id: isLeague ? null')
  })

  test('desempate do cálculo e regulamento usam a mesma ordem objetiva', () => {
    const stats = source('backend/src/campeonatos/estatisticas/estatisticas.service.ts')
    const scorer = source('backend/src/campeonatos/pontuador/pontuador.service.ts')
    const rulebook = source('backend/src/campeonatos/rulebook/rulebook.generator.ts')
    expect(stats).toContain('b.pontos_total - a.pontos_total || b.booyahs - a.booyahs || b.abates - a.abates')
    expect(stats).toContain('a.melhor_posicao ?? 999')
    expect(scorer).toContain('a.melhor_posicao ?? 999')
    expect(rulebook).toContain('1. Maior número de Booyahs')
    expect(rulebook).toContain('2. Maior número total de abates')
    expect(rulebook).toContain('3. Melhor colocação alcançada em uma queda')
    expect(rulebook).not.toContain('Melhor colocação no confronto direto mais recente')
  })
})
