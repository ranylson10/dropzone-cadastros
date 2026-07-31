import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

test.describe('Central do Campeonato — escolha manual pela equipe', () => {
  test('lista campeonatos da equipe sem liberar o painel administrativo', async () => {
    const route = fs.readFileSync(path.join(root, 'web/app/api/central-campeonato/route.ts'), 'utf8')
    const component = fs.readFileSync(path.join(root, 'web/components/campeonatos/ChampionshipCentral.tsx'), 'utf8')
    expect(route).toContain('participantChampionships')
    expect(route).toContain('participant_items')
    expect(component).toContain("access: 'participant'")
    expect(component).toContain('participantMode')
  })

  test('equipe e administrador escolhem grupo e slot específicos', async () => {
    const teamRoute = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/escolha-grupo/route.ts'), 'utf8')
    const adminRoute = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/estrutura-avancada/route.ts'), 'utf8')
    const central = fs.readFileSync(path.join(root, 'web/components/campeonatos/ChampionshipCentral.tsx'), 'utf8')
    expect(teamRoute).toContain("const slotId = text(body?.slot_id)")
    expect(teamRoute).toContain(".eq('id', slotId)")
    expect(adminRoute).toContain("const slotId = text(body?.slot_id)")
    expect(central).toContain('Nenhum grupo ou slot é definido automaticamente')
    expect(central).toContain('Confirmar grupo e slot')
  })
})
