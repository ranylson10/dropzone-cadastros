import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.describe('Rodada 86B — regras e prioridades dos alertas inteligentes', () => {
  test('mantém classificação, agrupamento, deduplicação e ordenação por prioridade', async () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'web/app/api/central-campeonato/route.ts'), 'utf8')
    const component = fs.readFileSync(path.join(process.cwd(), 'web/components/campeonatos/ChampionshipCentral.tsx'), 'utf8')

    expect(route).toContain("category: 'capacity'")
    expect(route).toContain("scope: 'championship'")
    expect(route).toContain('priority_score')
    expect(route).toContain('uniqueAlerts')
    expect(route).toContain('new Map(alerts.map')
    expect(route).toContain('Number(b.priority_score || 0) - Number(a.priority_score || 0)')
    expect(component).toContain('Impacto:')
    expect(component).toContain('Ação recomendada:')
    expect(component).toContain('alertCategoryLabel')
    expect(component).toContain('alertScopeLabel')
  })

  test('não adiciona correção automática nem distribuição automática', async () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'web/app/api/central-campeonato/route.ts'), 'utf8')
    expect(route).not.toContain('auto_fix_alert')
    expect(route).not.toContain('distribuir_grupos_automaticamente')
  })
})
