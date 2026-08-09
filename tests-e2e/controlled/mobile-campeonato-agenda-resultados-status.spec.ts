import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Mobile — campeonato público com agenda, resultados e status dinâmicos', () => {
  test('atualiza estrutura/classificação periodicamente e permite pull-to-refresh', async () => {
    const screen = read('app/src/screens/ChampionshipPublicScreen.tsx')
    const api = read('app/src/lib/api.ts')
    const structureRoute = read('web/app/api/campeonatos/[id]/estrutura/route.ts')
    const statsRoute = read('web/app/api/campeonatos/[id]/estatisticas/equipes/route.ts')

    expect(screen).toContain('RefreshControl')
    expect(screen).toContain('loadChampionship')
    expect(screen).toContain('setInterval')
    expect(screen).toContain('30000')
    expect(screen).toContain('ATUALIZAÇÃO AUTOMÁTICA · 30S')
    expect(screen).toContain('AO VIVO')
    expect(screen).toContain('FINALIZADO')
    expect(screen).toContain('AGENDADO')
    expect(screen).toContain('fallsRow')
    expect(screen).toContain('CLASSIFICAÇÃO')
    expect(screen).toContain('MVP')

    expect(api).toContain('championshipStructure:')
    expect(api).toContain('championshipTeamStats:')
    expect(api).toContain('championshipMvpStats:')

    expect(structureRoute).toContain('export async function GET')
    expect(statsRoute).toContain('export async function GET')

    expect(screen).not.toContain('WebView')
    expect(screen).not.toContain('Linking.openURL')
  })
})
