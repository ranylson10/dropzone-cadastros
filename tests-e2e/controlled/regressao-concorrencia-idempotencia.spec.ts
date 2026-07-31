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
      // Ignora chaves não relacionadas à sessão.
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

test.describe('Regressão final — concorrência, estabilidade e idempotência segura', () => {
  test.setTimeout(180_000)

  test('leituras públicas e autenticadas suportam concorrência sem respostas 5xx', async ({ request, baseURL }) => {
    test.skip(!fs.existsSync(produtoraAuthFile), 'A sessão é gerada automaticamente por npm run testar:tudo.')

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const token = accessTokenFromStorage(produtoraAuthFile, origin)

    const publicEndpoints = [
      '/api/ping',
      '/api/rank',
      '/api/mapas',
      '/api/vagas',
      '/api/webhooks/asaas',
      '/api/webhooks/paypal',
    ]

    const privateEndpoints = [
      '/api/me',
      '/api/me/carteira',
      '/api/notificacoes?limit=5',
      '/api/lili/campeonatos',
      '/api/stream/catalog?scope=mine',
    ]

    const publicResponses = await Promise.all(
      Array.from({ length: 3 }, () =>
        publicEndpoints.map((endpoint) =>
          request.get(`${origin}${endpoint}`, { timeout: 45_000 }),
        ),
      ).flat(),
    )

    for (const response of publicResponses) {
      expect(response.status(), 'Leitura pública concorrente não pode retornar erro 5xx.').toBeLessThan(500)
    }

    const privateResponses = await Promise.all(
      Array.from({ length: 3 }, () =>
        privateEndpoints.map((endpoint) =>
          request.get(`${origin}${endpoint}`, {
            headers: headers(token),
            timeout: 45_000,
          }),
        ),
      ).flat(),
    )

    for (const response of privateResponses) {
      const body = await json(response)
      expect(
        response.status(),
        `Leitura autenticada concorrente não pode retornar erro 5xx: ${body?.error || response.status()}`,
      ).toBeLessThan(500)
      expect(response.ok(), `Leitura autenticada concorrente falhou: ${body?.error || response.status()}`).toBe(true)
    }
  })

  test('requisições inválidas repetidas permanecem bloqueadas sem efeitos colaterais', async ({ request, baseURL }) => {
    test.skip(!fs.existsSync(produtoraAuthFile), 'A sessão é gerada automaticamente por npm run testar:tudo.')

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const token = accessTokenFromStorage(produtoraAuthFile, origin)
    const fakeId = '00000000-0000-4000-8000-000000000077'

    const invalidRequests = [
      () =>
        request.post(`${origin}/api/pagamentos/vaga/claim`, {
          headers: headers(token),
          data: { payment_id: fakeId },
          timeout: 30_000,
        }),
      () =>
        request.post(`${origin}/api/paypal/orders/${fakeId}/capture`, {
          headers: headers(token),
          data: {},
          timeout: 30_000,
        }),
      () =>
        request.post(`${origin}/api/stream/catalog/redeem`, {
          headers: headers(token),
          data: { code: 'CODIGO-E2E-INEXISTENTE-77' },
          timeout: 30_000,
        }),
      () =>
        request.patch(`${origin}/api/notificacoes`, {
          headers: headers(token),
          data: { id: fakeId, status: 'status-invalido' },
          timeout: 30_000,
        }),
    ]

    for (const makeRequest of invalidRequests) {
      const responses = await Promise.all([makeRequest(), makeRequest(), makeRequest()])

      for (const response of responses) {
        expect(response.ok(), 'Requisição inválida repetida não pode ser aceita.').toBe(false)
        expect(
          response.status(),
          `Requisição inválida não pode causar erro 5xx; recebeu ${response.status()}.`,
        ).toBeLessThan(500)
      }

      expect(
        new Set(responses.map((response) => response.status())).size,
        'A mesma entrada inválida deve produzir resposta HTTP consistente.',
      ).toBe(1)
    }

    const healthAfterAbuse = await request.get(`${origin}/api/ping`, {
      timeout: 30_000,
    })
    expect(healthAfterAbuse.ok(), 'A API deve continuar saudável após as tentativas inválidas.').toBe(true)

    const sessionAfterAbuse = await request.get(`${origin}/api/me`, {
      headers: headers(token),
      timeout: 30_000,
    })
    const sessionBody = await json(sessionAfterAbuse)
    expect(
      sessionAfterAbuse.ok(),
      `A sessão deve continuar válida após as tentativas: ${sessionBody?.error || sessionAfterAbuse.status()}`,
    ).toBe(true)
  })
})
