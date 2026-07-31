import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')

function source(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

test.describe('Rodada 86A — alertas inteligentes persistentes', () => {
  test('mantém estados operacionais e ações explícitas sem automação destrutiva', async () => {
    const route = source('web/app/api/central-campeonato/route.ts')
    const component = source('web/components/campeonatos/ChampionshipCentral.tsx')
    const migration = source('database/migrations/20260731_campeonato_alertas_inteligentes_estados.sql')

    expect(route).toContain("from('campeonato_alerta_estados')")
    expect(route).toContain('export async function PATCH')
    expect(route).toContain("['new', 'read', 'resolved', 'dismissed']")
    expect(route).toContain('permission.canManage')
    expect(component).toContain('Marcar lido')
    expect(component).toContain('Resolver')
    expect(component).toContain('Dispensar')
    expect(component).toContain('Reabrir')
    expect(migration).toContain('unique (campeonato_id, alerta_chave)')
    expect(migration).toContain('enable row level security')
    expect(route).not.toContain('auto_resolve_alert')
  })
})
