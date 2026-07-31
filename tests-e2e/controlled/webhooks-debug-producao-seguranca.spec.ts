import { test, expect, type APIRequestContext } from '@playwright/test'

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

test.describe('Produção — webhooks e rotas de debug protegidas', () => {
  test.setTimeout(120_000)

  test('webhooks informam estado sem segredos e rejeitam chamadas não autenticadas', async ({ request, baseURL }) => {
    const origin = new URL(baseURL || 'http://localhost:3000').origin

    const asaasStatus = await request.get(`${origin}/api/webhooks/asaas`, {
      timeout: 30_000,
    })
    const asaasStatusBody = await json(asaasStatus)
    expect(asaasStatus.ok(), `Falha no status ASAAS: ${asaasStatusBody?.error || asaasStatus.status()}`).toBe(true)
    expect(asaasStatusBody).toEqual({
      ok: true,
      service: 'asaas-webhook',
      configured: expect.any(Boolean),
    })
    expect(JSON.stringify(asaasStatusBody).toLowerCase()).not.toContain('token')
    expect(JSON.stringify(asaasStatusBody).toLowerCase()).not.toContain('secret')
    expect(JSON.stringify(asaasStatusBody).toLowerCase()).not.toContain('api_key')

    const asaasWithoutToken = await request.post(`${origin}/api/webhooks/asaas`, {
      data: {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_e2e_inexistente' },
      },
      timeout: 30_000,
    })
    expect(
      [401, 503].includes(asaasWithoutToken.status()),
      `Webhook ASAAS sem token deve retornar 401 ou 503, recebeu ${asaasWithoutToken.status()}.`,
    ).toBe(true)

    const asaasFakeToken = await request.post(`${origin}/api/webhooks/asaas`, {
      headers: {
        'asaas-access-token': 'token-e2e-invalido',
        'Content-Type': 'application/json',
      },
      data: {
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_e2e_inexistente' },
      },
      timeout: 30_000,
    })
    expect(
      [401, 503].includes(asaasFakeToken.status()),
      `Webhook ASAAS com token falso deve retornar 401 ou 503, recebeu ${asaasFakeToken.status()}.`,
    ).toBe(true)

    const paypalStatus = await request.get(`${origin}/api/webhooks/paypal`, {
      timeout: 30_000,
    })
    const paypalStatusBody = await json(paypalStatus)
    expect(paypalStatus.ok(), `Falha no status PayPal: ${paypalStatusBody?.error || paypalStatus.status()}`).toBe(true)
    expect(paypalStatusBody).toEqual({
      ok: true,
      service: 'paypal-webhook',
      configured: expect.any(Boolean),
    })
    expect(JSON.stringify(paypalStatusBody).toLowerCase()).not.toContain('webhook_id')
    expect(JSON.stringify(paypalStatusBody).toLowerCase()).not.toContain('client_secret')
    expect(JSON.stringify(paypalStatusBody).toLowerCase()).not.toContain('access_token')

    const paypalWithoutSignature = await request.post(`${origin}/api/webhooks/paypal`, {
      data: {
        id: 'WH-E2E-INEXISTENTE',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAPTURE-E2E-INEXISTENTE' },
      },
      timeout: 30_000,
    })
    expect(
      [400, 401, 503].includes(paypalWithoutSignature.status()),
      `Webhook PayPal sem assinatura deve ser rejeitado, recebeu ${paypalWithoutSignature.status()}.`,
    ).toBe(true)
    expect(paypalWithoutSignature.ok()).toBe(false)
  })

  test('rotas internas de debug permanecem indisponíveis em produção', async ({ request, baseURL }) => {
    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const fakeId = '00000000-0000-4000-8000-000000000076'

    for (const endpoint of [
      '/api/debug/insert-manager',
      '/api/debug/managers',
      `/api/debug/manager/${fakeId}`,
      `/api/debug/manager-tokens/${fakeId}`,
    ]) {
      const response = await request.get(`${origin}${endpoint}`, {
        timeout: 30_000,
      })
      const body = await json(response)

      expect(
        [403, 404].includes(response.status()),
        `${endpoint} deve ficar invisível ou bloqueado em produção; recebeu ${response.status()}.`,
      ).toBe(true)

      const serialized = JSON.stringify(body || {}).toLowerCase()
      for (const sensitiveField of [
        'auth_user_id',
        'manager_auth_user_id',
        'access_token',
        'refresh_token',
        'service_role',
        '"tokens"',
        '"managers"',
      ]) {
        expect(serialized, `${endpoint} não pode expor ${sensitiveField}.`).not.toContain(sensitiveField)
      }
    }

    const disabledWrite = await request.post(`${origin}/api/debug/insert-manager`, {
      data: {
        email: 'e2e-nao-criar@example.invalid',
        username: 'e2e_nao_criar',
      },
      timeout: 30_000,
    })
    const disabledWriteBody = await json(disabledWrite)
    expect(disabledWrite.status(), 'Endpoint antigo de escrita deve permanecer desabilitado.').toBe(404)
    expect(String(disabledWriteBody?.error || '')).toContain('desabilitado')
  })
})
