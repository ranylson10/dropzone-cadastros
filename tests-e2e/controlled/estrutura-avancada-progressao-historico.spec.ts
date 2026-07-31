import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

test.describe('Estrutura avançada — histórico e reversão da progressão', () => {
  test('banco preserva execução, itens e estado anterior para reversão', async () => {
    const migration = fs.readFileSync(path.join(root, 'database/migrations/20260731_campeonatos_progressao_historico_reprocessamento.sql'), 'utf8')
    expect(migration).toContain('campeonato_progressao_execucoes')
    expect(migration).toContain('campeonato_progressao_execucao_itens')
    expect(migration).toContain('destino_anterior jsonb')
    expect(migration).toContain('progressao_execucao_id')
  })

  test('API e painel tratam conflitos, substituição e reversão controlada', async () => {
    const route = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/estrutura-avancada/route.ts'), 'utf8')
    const component = fs.readFileSync(path.join(root, 'web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx'), 'utf8')
    expect(route).toContain("action === 'reverse_progression'")
    expect(route).toContain('replace_conflicts')
    expect(route).toContain('destino_anterior')
    expect(component).toContain('Histórico de execuções')
    expect(component).toContain('Substituir vínculos conflitantes')
    expect(component).toContain('Reverter')
  })
})
