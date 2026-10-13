import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function source(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

test.describe('Rodada 55 — consistência e encerramento', () => {
  test('painel mostra estado da edição e indisponibilidade das ações inseguras', () => {
    const panel = source('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
    const status = source('web/features/campeonatos/estrutura-avancada/EditionLifecycleStatus.tsx')
    expect(panel).toContain('<EditionLifecycleStatus championshipId={selectedChamp.id} />')
    expect(panel).not.toContain('updateEditionLifecycle(')
    expect(status).toContain('Encerrar campeonato')
    expect(status).toContain('Reabrir season')
    expect(status).toContain('disabled={!atomic || busy || !mutation.ready || Boolean(mutation.pending)}')
  })

  test('servidor recusa encerramento antes dos escritores legados', () => {
    const route = source('web/app/api/campeonatos/[id]/estrutura-avancada/route.ts')
    expect(route).toContain('assertLifecycleActionSafe(action)')
    expect(route).not.toContain('final_publicado_em')
    expect(route).not.toContain('aceita_novas_inscricoes_equipes: false')
  })

  test('não existe flag que reative as gravações paralelas do lifecycle', () => {
    const safety = source('backend/src/campeonatos/lifecycle-safety.ts')
    expect(safety).toContain("lifecycleWriteMode = 'unavailable'")
    expect(safety).toContain("action === 'publish_final' || action === 'reopen_final'")
    expect(safety).not.toContain('process.env')
    const transport = source('backend/src/campeonatos/lifecycle-transport.ts')
    expect(transport).toContain("rpc('fn_lifecycle_atomico', args)")
    expect(transport).not.toContain('.from(')
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
