import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const managerAuthFile = path.resolve('tests-e2e/.auth/manager.json')
const jogadorAuthFile = path.resolve('tests-e2e/.auth/jogador.json')

type StorageState = { origins?: Array<{ origin?: string; localStorage?: Array<{ name?: string; value?: string }> }> }
function token(file: string, origin: string) {
  const state = JSON.parse(fs.readFileSync(file, 'utf8')) as StorageState
  const exact = state.origins?.find((item) => item.origin === origin)
  const candidates = exact ? [exact, ...(state.origins || []).filter((item) => item !== exact)] : (state.origins || [])
  for (const candidate of candidates) {
    for (const entry of candidate.localStorage || []) {
      if (!entry.name?.includes('auth-token') || !entry.value) continue
      try {
        const parsed = JSON.parse(entry.value)
        const value = parsed.access_token || parsed.currentSession?.access_token
        if (typeof value === 'string' && value.length > 20) return value
      } catch {
        // Ignora entradas locais que não sejam uma sessão Supabase válida.
      }
    }
  }
  throw new Error(`Sessão ausente em ${file}.`)
}
const headers = (value: string, profile: string) => ({ Authorization: `Bearer ${value}`, 'x-profile-type': profile })

test.describe('Central do Campeonato — leitura autorizada', () => {
  test('bloqueia visitante, lista vínculos e rejeita usuário sem vínculo', async ({ request, baseURL }) => {
    test.skip(![produtoraAuthFile, managerAuthFile, jogadorAuthFile].every(fs.existsSync), 'Sessões geradas por npm run testar:tudo.')
    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const visitor = await request.get(`${origin}/api/central-campeonato`)
    expect(visitor.status()).toBe(401)

    const owner = await request.get(`${origin}/api/central-campeonato`, { headers: headers(token(produtoraAuthFile, origin), 'produtora') })
    const ownerBody = await owner.json()
    expect(owner.ok()).toBeTruthy()
    expect(Array.isArray(ownerBody.items)).toBeTruthy()

    const manager = await request.get(`${origin}/api/central-campeonato`, { headers: headers(token(managerAuthFile, origin), 'manager') })
    expect(manager.ok()).toBeTruthy()

    const foreign = await request.get(`${origin}/api/central-campeonato?campeonato_id=00000000-0000-4000-8000-000000000071`, { headers: headers(token(jogadorAuthFile, origin), 'jogador') })
    expect(foreign.ok()).toBeFalsy()
  })
})
