import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

function accessTokenFromStorage(file: string, expectedOrigin: string): string {
  const state = JSON.parse(fs.readFileSync(file, 'utf8')) as StorageState
  const origin = state.origins?.find((item) => item.origin === expectedOrigin)
  for (const entry of origin?.localStorage || []) {
    if (!entry.name?.includes('auth-token') || !entry.value) continue
    try {
      const parsed = JSON.parse(entry.value) as {
        access_token?: unknown
        currentSession?: { access_token?: unknown }
      }
      const token = parsed.access_token || parsed.currentSession?.access_token
      if (typeof token === 'string' && token.length > 20) return token
    } catch {
      // Ignora outras chaves do localStorage.
    }
  }
  throw new Error(`Sessão não encontrada em ${file}. Rode npm run testar:tudo.`)
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-profile-type': 'produtora',
    'Content-Type': 'application/json',
  }
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

test.describe('Broadcast e Stream — segurança de acesso e tokens', () => {
  test.setTimeout(120_000)

  test('rotas privadas exigem login e tokens públicos inválidos não expõem sessões', async ({ request, baseURL }) => {
    test.skip(!fs.existsSync(produtoraAuthFile), 'A sessão é gerada automaticamente por npm run testar:tudo.')

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = accessTokenFromStorage(produtoraAuthFile, origin)

    for (const endpoint of [
      '/api/broadcast/me',
      '/api/broadcast/sessions',
      '/api/stream/catalog?scope=mine',
      '/api/stream/catalog?scope=public',
      '/api/stream/catalog?scope=entitled',
    ]) {
      const response = await request.get(`${origin}${endpoint}`, { timeout: 30_000 })
      expect(response.ok(), `${endpoint} sem autenticação deve ser bloqueado.`).toBe(false)
    }

    const mine = await request.get(`${origin}/api/stream/catalog?scope=mine`, {
      headers: headers(produtoraToken),
      timeout: 30_000,
    })
    const mineBody = await json(mine)
    expect(mine.ok(), `Falha ao listar catálogo próprio: ${mineBody?.error || mine.status()}`).toBe(true)
    expect(Array.isArray(mineBody?.models)).toBe(true)

    const publicCatalog = await request.get(`${origin}/api/stream/catalog?scope=public`, {
      headers: headers(produtoraToken),
      timeout: 30_000,
    })
    const publicBody = await json(publicCatalog)
    expect(
      publicCatalog.ok(),
      `Falha ao listar catálogo público: ${publicBody?.error || publicCatalog.status()}`,
    ).toBe(true)
    expect(Array.isArray(publicBody?.models)).toBe(true)

    const entitled = await request.get(`${origin}/api/stream/catalog?scope=entitled`, {
      headers: headers(produtoraToken),
      timeout: 30_000,
    })
    const entitledBody = await json(entitled)
    expect(
      entitled.ok(),
      `Falha ao listar catálogo liberado: ${entitledBody?.error || entitled.status()}`,
    ).toBe(true)
    expect(Array.isArray(entitledBody?.models)).toBe(true)

    const shortController = await request.get(`${origin}/api/broadcast/control/curto`, {
      timeout: 30_000,
    })
    expect(shortController.status(), 'Token curto do controlador deve ser rejeitado.').toBe(400)

    const unknownController = await request.get(
      `${origin}/api/broadcast/control/00000000000000000000000000000000`,
      { timeout: 30_000 },
    )
    expect(
      [404, 503].includes(unknownController.status()),
      `Controlador inexistente deve retornar 404 ou 503, recebeu ${unknownController.status()}.`,
    ).toBe(true)

    const shortObs = await request.get(`${origin}/api/broadcast/obs/curto`, {
      timeout: 30_000,
    })
    expect(shortObs.status(), 'Token curto do OBS deve ser rejeitado.').toBe(400)

    const unknownObs = await request.get(
      `${origin}/api/broadcast/obs/00000000000000000000000000000000`,
      { timeout: 30_000 },
    )
    expect(
      [404, 503].includes(unknownObs.status()),
      `Sessão OBS inexistente deve retornar 404 ou 503, recebeu ${unknownObs.status()}.`,
    ).toBe(true)

    const invalidControllerWrite = await request.post(`${origin}/api/broadcast/control/curto`, {
      data: { active_overlay_id: null },
      timeout: 30_000,
    })
    expect(invalidControllerWrite.status(), 'POST com token curto deve ser rejeitado.').toBe(400)
  })
})
