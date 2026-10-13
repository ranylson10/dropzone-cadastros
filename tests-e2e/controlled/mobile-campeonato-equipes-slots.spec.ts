import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Mobile campeonato — equipes e slots manuais', () => {
  test('painel nativo usa as APIs canônicas e não distribui vagas automaticamente', async () => {
    const api = read('app/src/lib/api.ts')
    const management = read('app/src/screens/ChampionshipManagementScreen.tsx')
    const panel = read('app/src/screens/ChampionshipTeamsPanel.tsx')
    const participation = read('app/src/lib/participation-write.ts')

    expect(management).toContain('ChampionshipTeamsPanel')
    expect(panel).toContain('championshipAdminTeams')
    expect(panel).toContain('/equipes/busca')
    expect(panel).toContain('writeMobileParticipation')
    expect(panel).toContain('moveChampionshipSlot')
    expect(panel).toContain('participation_expected')
    expect(panel).toMatch(/targetOccupied\s*\?\s*["']swap["']\s*:\s*["']move["']/)
    expect(panel).toContain('A organização é manual')
    expect(panel).not.toContain('distribute_phase')
    expect(panel).not.toContain('shuffle_group')

    expect(api).toContain('/equipes/busca?q=')
    expect(api).toContain("method:'POST'")
    expect(api).toContain("method:'PATCH'")
    expect(participation).toContain('participacao_id=')
  })
})
