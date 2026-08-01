import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test.describe('Rodada 86E — revisão final dos alertas inteligentes', () => {
  test('preserva o ciclo operacional completo sem automações destrutivas', async () => {
    const route = read('web/app/api/central-campeonato/route.ts')
    const component = read('web/components/campeonatos/ChampionshipCentral.tsx')

    for (const status of ['new', 'read', 'resolved', 'dismissed']) {
      expect(route).toContain(`'${status}'`)
    }

    expect(route).toContain('alert_keys')
    expect(route).toContain("onConflict: 'campeonato_id,alerta_chave'")
    expect(route).toContain('status_anterior')
    expect(route).toContain('status_novo')
    expect(route).toContain('alterado_por_auth_user_id')
    expect(route).toContain('alterado_por_email')

    expect(component).toContain('Marcar novos como lidos')
    expect(component).toContain('Exportar alertas CSV')
    expect(component).toContain('Exportar histórico CSV')
    expect(component).toContain('Histórico de mudanças')
    expect(component).toContain('Todas as prioridades')
    expect(component).toContain('Todas as categorias')
    expect(component).toContain('Todos os escopos')

    expect(route).not.toContain('distribuirAutomaticamente')
    expect(route).not.toContain('corrigirAutomaticamente')
  })

  test('mantém migrations, inventário e classificações da rodada 86 consistentes', async () => {
    const estados = read('database/migrations/20260731_campeonato_alertas_inteligentes_estados.sql')
    const historico = read('database/migrations/20260731_campeonato_alertas_inteligentes_historico.sql')
    const rls = read('database/rls-classification.json')
    const inventario = read('relatorios-testes/banco-publicado.json')

    expect(estados).toContain('campeonato_alerta_estados')
    expect(historico).toContain('campeonato_alerta_historico')
    expect(rls).toContain('campeonato_alerta_estados')
    expect(rls).toContain('campeonato_alerta_historico')
    expect(inventario).toContain('campeonato_alerta_estados')
    expect(inventario).toContain('campeonato_alerta_historico')
  })
})
