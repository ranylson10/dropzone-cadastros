import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const managerAuthFile = path.resolve('tests-e2e/.auth/manager.json')
const jogadorAuthFile = path.resolve('tests-e2e/.auth/jogador.json')

const headers = (value: string, profile: string) => ({ Authorization: `Bearer ${value}`, 'x-profile-type': profile })

test.describe('Central do Campeonato — leitura autorizada', () => {
  test('bloqueia visitante, lista vínculos e rejeita usuário sem vínculo', async ({ request, browser, baseURL }) => {
    test.skip(![produtoraAuthFile, managerAuthFile, jogadorAuthFile].every(fs.existsSync), 'Sessões geradas por npm run testar:tudo.')
    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = await activeAuthToken(browser, produtoraAuthFile, '/campeonatos')
    const managerToken = await activeAuthToken(browser, managerAuthFile, '/managers')
    const jogadorToken = await activeAuthToken(browser, jogadorAuthFile, '/jogadores')
    const visitor = await request.get(`${origin}/api/central-campeonato`)
    expect(visitor.status()).toBe(401)

    const owner = await request.get(`${origin}/api/central-campeonato`, { headers: headers(produtoraToken, 'produtora') })
    const ownerBody = await owner.json()
    expect(owner.ok()).toBeTruthy()
    expect(Array.isArray(ownerBody.items)).toBeTruthy()

    const manager = await request.get(`${origin}/api/central-campeonato`, { headers: headers(managerToken, 'manager') })
    expect(manager.ok()).toBeTruthy()

    const foreign = await request.get(`${origin}/api/central-campeonato?campeonato_id=00000000-0000-4000-8000-000000000071`, { headers: headers(jogadorToken, 'jogador') })
    expect(foreign.ok()).toBeFalsy()
  })
})
