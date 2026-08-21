import { test, expect } from '@playwright/test'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

test.describe('Estrutura avançada — edições, séries e etapas', () => {
  test('protege visitante e expõe contrato somente ao usuário autorizado', async ({ request, browser, baseURL }) => {
    const origin = baseURL || 'http://localhost:3000'
    const blocked = await request.get(`${origin}/api/campeonatos/00000000-0000-0000-0000-000000000000/estrutura-avancada`)
    expect(blocked.status()).toBe(401)

    const token = await activeAuthToken(browser, path.resolve('tests-e2e/.auth/produtora.json'), '/campeonatos')
    const central = await request.get(`${origin}/api/central-campeonato`, { headers: { Authorization: `Bearer ${token}`, 'x-profile-type': 'produtora' } })
    expect(central.ok()).toBe(true)
    const centralBody = await central.json()
    const championship = centralBody?.items?.[0]
    expect(championship?.id).toBeTruthy()

    const response = await request.get(`${origin}/api/campeonatos/${championship.id}/estrutura-avancada`, { headers: { Authorization: `Bearer ${token}`, 'x-profile-type': 'produtora' } })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.divisions)).toBe(true)
    expect(Array.isArray(body.stages)).toBe(true)
    expect(Array.isArray(body.dailyHours)).toBe(true)
    expect(typeof body.permission?.canManage).toBe('boolean')
  })
})
