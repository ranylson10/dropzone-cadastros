import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

function headers(token: string, profileType?: string) {
  return {
    Authorization: `Bearer ${token}`,
    ...(profileType ? { 'x-profile-type': profileType } : {}),
    'Content-Type': 'application/json',
  }
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

async function postWithRetry(
  request: APIRequestContext,
  url: string,
  options: Parameters<APIRequestContext['post']>[1],
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await request.post(url, { ...options, timeout: 30_000 })
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000))
    }
  }
  throw lastError
}

test.describe('Pagamentos e carteira — validações seguras sem cobrança real', () => {
  test.setTimeout(150_000)

  test('cotação, carteira, saque inválido e proteção de pagamentos funcionam', async ({ request, browser, baseURL }) => {
    test.skip(
      ![produtoraAuthFile, equipeAuthFile].every(fs.existsSync),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = await activeAuthToken(browser, produtoraAuthFile, '/campeonatos')
    const equipeToken = await activeAuthToken(browser, equipeAuthFile, '/equipes')

    const quoteUnauthenticated = await postWithRetry(request, `${origin}/api/campeonatos/pricing-quote`, {
      data: { tipo: 'copa', numero_vagas: 12, recursos: {} },
    })
    expect(quoteUnauthenticated.ok(), 'Cotação sem autenticação deve ser bloqueada.').toBe(false)

    const quoteResponse = await postWithRetry(request, `${origin}/api/campeonatos/pricing-quote`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        tipo: 'liga',
        numero_vagas: 20,
        recursos: { export: true, stream: true, rulebook: true, stats: true, broadcast: false },
      },
    })
    const quoteBody = await json(quoteResponse)
    expect(quoteResponse.ok(), `Falha na cotação: ${quoteBody?.error || quoteResponse.status()}`).toBe(true)
    expect(quoteBody?.quote?.tipo).toBe('liga')
    expect(quoteBody?.quote?.numero_vagas).toBe(20)
    expect(Number(quoteBody?.quote?.valor_total_centavos)).toBeGreaterThanOrEqual(0)
    expect(quoteBody?.quote?.valor_total_centavos).toBe(
      Number(quoteBody?.quote?.valor_base_centavos || 0)
      + Number(quoteBody?.quote?.valor_vagas_centavos || 0)
      + Number(quoteBody?.quote?.valor_recursos_centavos || 0),
    )
    expect(typeof quoteBody?.quote?.valor_total_brl).toBe('string')
    expect(Array.isArray(quoteBody?.quote?.linhas)).toBe(true)

    const normalizedQuote = await postWithRetry(request, `${origin}/api/campeonatos/pricing-quote`, {
      headers: headers(produtoraToken, 'produtora'),
      data: { tipo: 'tipo-inexistente', numero_vagas: 9999, recursos: {} },
    })
    const normalizedBody = await json(normalizedQuote)
    expect(normalizedQuote.ok()).toBe(true)
    expect(normalizedBody?.quote?.tipo).toBe('copa')
    expect(normalizedBody?.quote?.numero_vagas).toBe(256)

    const walletResponse = await request.get(`${origin}/api/me/carteira`, {
      headers: headers(equipeToken, 'equipe'),
      timeout: 30_000,
    })
    const walletBody = await json(walletResponse)
    expect(walletResponse.ok(), `Falha ao consultar carteira: ${walletBody?.error || walletResponse.status()}`).toBe(true)
    expect(String(walletBody?.carteira?.id || '')).not.toBe('')
    expect(Number(walletBody?.carteira?.saldo_disponivel_centavos)).toBeGreaterThanOrEqual(0)
    expect(Number(walletBody?.carteira?.saldo_bloqueado_centavos)).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(walletBody?.lancamentos)).toBe(true)
    expect(Array.isArray(walletBody?.saques)).toBe(true)
    expect(Array.isArray(walletBody?.pagamentos)).toBe(true)

    const invalidWithdrawal = await postWithRetry(request, `${origin}/api/me/carteira/saque`, {
      headers: headers(equipeToken, 'equipe'),
      data: {
        valor_centavos: 1,
        pix_chave: 'teste-e2e@dropzone.local',
        pix_tipo: 'email',
        titular_nome: '[E2E] Saque inválido',
      },
    })
    const invalidWithdrawalBody = await json(invalidWithdrawal)
    expect(invalidWithdrawal.ok(), 'Saque abaixo do mínimo deve ser bloqueado.').toBe(false)
    expect(String(invalidWithdrawalBody?.error || '')).toContain('Valor mínimo')

    const missingPaymentId = await postWithRetry(request, `${origin}/api/pagamentos/inscricao`, {
      headers: headers(equipeToken, 'equipe'),
      data: {},
    })
    const missingPaymentBody = await json(missingPaymentId)
    expect(missingPaymentId.ok(), 'Cobrança sem participação deve ser bloqueada antes de chamar o ASAAS.').toBe(false)
    expect(String(missingPaymentBody?.error || '')).toContain('campeonato_equipe_id')

    const missingPaymentStatus = await request.get(`${origin}/api/pagamentos/inscricao`, {
      headers: headers(equipeToken, 'equipe'),
      timeout: 30_000,
    })
    const missingStatusBody = await json(missingPaymentStatus)
    expect(missingPaymentStatus.ok()).toBe(false)
    expect(String(missingStatusBody?.error || '')).toContain('campeonato_equipe_id')

    const walletUnauthenticated = await request.get(`${origin}/api/me/carteira`, { timeout: 30_000 })
    expect(walletUnauthenticated.ok(), 'Carteira sem autenticação deve ser bloqueada.').toBe(false)
    const refundsUnauthenticated = await request.get(`${origin}/api/financeiro/reembolsos`, { timeout: 30_000 })
    expect(refundsUnauthenticated.ok(), 'Revisões financeiras sem autenticação devem ser bloqueadas.').toBe(false)

    const refundsResponse = await request.get(`${origin}/api/financeiro/reembolsos?mode=pending`, {
      headers: headers(produtoraToken, 'produtora'),
      timeout: 30_000,
    })
    const refundsBody = await json(refundsResponse)
    expect(refundsResponse.ok(), `Falha ao consultar revisões financeiras: ${refundsBody?.error || refundsResponse.status()}`).toBe(true)
    expect(Array.isArray(refundsBody?.reviews)).toBe(true)
    expect(refundsBody?.mode).toBe('pending')

    const invalidRefundDecision = await postWithRetry(request, `${origin}/api/financeiro/reembolsos`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        compra_id: '00000000-0000-4000-8000-000000000000',
        decision: 'aprovar_reembolso_direto',
      },
    })
    const invalidRefundBody = await json(invalidRefundDecision)
    expect(invalidRefundDecision.ok(), 'Decisão financeira desconhecida deve ser bloqueada.').toBe(false)
    expect(String(invalidRefundBody?.error || '')).toMatch(/Decis/i)
  })

  test('webhooks expõem saúde pública e rejeitam chamadas não autenticadas', async ({ request, browser, baseURL }) => {
    const origin = new URL(baseURL || 'http://localhost:3000').origin

    const asaasHealth = await request.get(`${origin}/api/webhooks/asaas`, { timeout: 30_000 })
    const asaasHealthBody = await json(asaasHealth)
    expect(asaasHealth.ok()).toBe(true)
    expect(asaasHealthBody?.service).toBe('asaas-webhook')
    expect(typeof asaasHealthBody?.configured).toBe('boolean')

    const paypalHealth = await request.get(`${origin}/api/webhooks/paypal`, { timeout: 30_000 })
    const paypalHealthBody = await json(paypalHealth)
    expect(paypalHealth.ok()).toBe(true)
    expect(paypalHealthBody?.service).toBe('paypal-webhook')
    expect(typeof paypalHealthBody?.configured).toBe('boolean')

    const forgedAsaas = await postWithRetry(request, `${origin}/api/webhooks/asaas`, {
      headers: {
        'Content-Type': 'application/json',
        'asaas-access-token': 'token-e2e-invalido',
      },
      data: { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_e2e_inexistente' } },
    })
    expect(forgedAsaas.ok(), 'Webhook ASAAS com token inválido nunca pode ser aceito.').toBe(false)
    expect([401, 503]).toContain(forgedAsaas.status())
  })
})
