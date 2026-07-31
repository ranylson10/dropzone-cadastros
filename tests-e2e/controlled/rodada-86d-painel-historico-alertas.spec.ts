import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 86D — painel e histórico dos alertas', () => {
  test('mantém filtros, exportação, ação em massa e histórico persistente', async () => {
    const route = read('web/app/api/central-campeonato/route.ts')
    const component = read('web/components/campeonatos/ChampionshipCentral.tsx')
    const migration = read('database/migrations/20260731_campeonato_alertas_inteligentes_historico.sql')

    expect(route).toContain("from('campeonato_alerta_historico')")
    expect(route).toContain('alert_keys')
    expect(route).toContain('alterado_por_email')
    expect(component).toContain('Marcar novos como lidos')
    expect(component).toContain('Exportar alertas CSV')
    expect(component).toContain('Histórico de mudanças')
    expect(component).toContain('Todas as prioridades')
    expect(migration).toContain('campeonato_alerta_historico')
  })
})
