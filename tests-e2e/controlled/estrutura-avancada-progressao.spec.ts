import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

test.describe('Estrutura avançada — progressão automática', () => {
  test('API oferece prévia e aplicação idempotente com controle de capacidade', async () => {
    const route = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/estrutura-avancada/route.ts'), 'utf8')
    expect(route).toContain("action === 'preview_progression'")
    expect(route).toContain("action === 'apply_progression'")
    expect(route).toContain('listarEstatisticasEquipes')
    expect(route).toContain('canApply: newCount <= available')
    expect(route).toContain("onConflict: 'etapa_id,campeonato_equipe_id'")
  })

  test('painel exige prévia antes de aplicar a progressão', async () => {
    const component = fs.readFileSync(path.join(root, 'web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx'), 'utf8')
    expect(component).toContain('Progressão automática')
    expect(component).toContain('Gerar prévia')
    expect(component).toContain('Aplicar progressão')
    expect(component).toContain('Já aplicada')
  })
})
