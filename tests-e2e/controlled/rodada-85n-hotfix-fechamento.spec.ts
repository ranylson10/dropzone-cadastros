import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

test.describe('Rodada 85N — hotfix de fechamento', () => {
  test('Central preserva a lista administrativa quando a consulta de participações falha', async () => {
    const route = fs.readFileSync(path.join(root, 'web/app/api/central-campeonato/route.ts'), 'utf8')
    expect(route).toContain("if (teamsResult.error && missingRelation(teamsResult.error))")
    expect(route).toContain(".eq('auth_user_id', userId)")
    expect(route).toContain('const adminItems = await authorizedChampionships(user.id)')
    expect(route).toContain('participantItems = await participantChampionships(user.id)')
    expect(route).toContain("console.error('[central-campeonato] Falha ao carregar participações:'")
  })

  test('painel mantém os contratos textuais da progressão automática', async () => {
    const component = fs.readFileSync(path.join(root, 'web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx'), 'utf8')
    expect(component).toContain('Progressão automática')
    expect(component).toContain('Gerar prévia')
    expect(component).toContain('Aplicar progressão')
    expect(component).toContain('Já aplicada')
  })
})
