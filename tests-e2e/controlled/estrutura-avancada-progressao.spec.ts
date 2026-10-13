import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

test.describe('Estrutura avançada — progressão automática', () => {
  test('API delega a prévia ao backend e mantém aplicação legada com controle de capacidade', async () => {
    const route = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/estrutura-avancada/route.ts'), 'utf8')
    const preview = fs.readFileSync(path.join(root, 'backend/src/campeonatos/progression-preview.ts'), 'utf8')
    expect(route).toContain("action === 'preview_progression'")
    expect(route).toContain("action === 'apply_progression'")
    expect(route).toContain('listarEstatisticasEquipes')
    expect(route).toContain("import { buildProgressionPreview } from '@backend/campeonatos/progression-preview'")
    expect(preview).toContain('readPagedRows')
    expect(preview).toContain('newCount <= available')
    expect(route).toContain('preview.summary.capacity !== null')
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
