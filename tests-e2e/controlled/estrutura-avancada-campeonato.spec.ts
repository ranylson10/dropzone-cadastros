import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function tokenFrom(fileName: string, origin: string) {
  const file = path.resolve(process.cwd(), 'tests-e2e', '.auth', fileName)
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const entry of json.origins || []) {
    if (entry.origin !== origin) continue
    for (const item of entry.localStorage || []) {
      try {
        const parsed = JSON.parse(item.value)
        const token = parsed?.access_token || parsed?.currentSession?.access_token
        if (token) return token
      } catch {}
    }
  }
  throw new Error(`Sessão não encontrada em ${file}. Rode npm run testar:tudo.`)
}

test.describe('Estrutura avançada — edições, séries e etapas', () => {
  test('protege visitante e expõe contrato somente ao usuário autorizado', async ({ request, baseURL }) => {
    const origin = baseURL || 'http://localhost:3000'
    const blocked = await request.get(`${origin}/api/campeonatos/00000000-0000-0000-0000-000000000000/estrutura-avancada`)
    expect(blocked.status()).toBe(401)

    const token = tokenFrom('produtora.json', origin)
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
