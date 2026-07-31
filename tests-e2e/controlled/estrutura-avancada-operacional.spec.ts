import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.describe('Estrutura avançada operacional — Rodada 85C', () => {
  test('mantém autenticação e publica os contratos operacionais', async ({ request, baseURL }) => {
    const origin = baseURL || 'http://localhost:3000'
    const blocked = await request.get(`${origin}/api/campeonatos/00000000-0000-0000-0000-000000000000/estrutura-avancada`)
    expect(blocked.status()).toBe(401)

    const root = path.resolve(__dirname, '..', '..')
    const route = fs.readFileSync(path.join(root, 'web/app/api/campeonatos/[id]/estrutura-avancada/route.ts'), 'utf8')
    const migration = fs.readFileSync(path.join(root, 'database/migrations/20260731_campeonatos_estruturas_avancadas_operacionais.sql'), 'utf8')
    expect(route).toContain("action === 'assign_team'")
    expect(route).toContain("action === 'link_phase'")
    expect(route).toContain("action === 'link_daily_group'")
    expect(route).toContain('capacidade máxima')
    expect(migration).toContain('campeonato_etapa_equipes')
    expect(migration).toContain('fn_validar_campeonato_etapa_equipe_85c')
  })
})
