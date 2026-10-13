import { expect, test, type Page } from '@playwright/test'

async function fixture(page: Page, storageBlocked = false, anonymous = false) {
  const user = { id: '00000000-0000-4000-8000-000000000401', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url'), 'fixture-signature'].join('.')
  const context = { locale: 'pt-BR', currentFlow: 'group_invite', currentStep: 'confirm', inviteToken: 'PRIVATE-FIXTURE', selectedTeamId: 'team-fixture', selectedLineId: 'line-fixture', selectedSlotId: 'slot-fixture' }
  const keys: string[] = [], receipts = new Set<string>(), errors: string[] = [], blocked: string[] = []
  let anonymousCalls = 0
  await page.addInitScript(({ user, jwt, exp, context, storageBlocked, anonymous }) => {
    if (!anonymous) localStorage.setItem('sb-uukivzxabiydnrvjvabt-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }))
    if (!sessionStorage.getItem('dz_lili_fixture_initialized')) {
      sessionStorage.setItem('dz_lili_fixture_initialized', '1')
      sessionStorage.setItem('dropzone:lili:conversation:v3', JSON.stringify({ context, messages: [{ id: 'fixture-confirm', role: 'assistant', text: 'Confira os dados para concluir.', actions: [{ id: 'confirm-fixture', label: 'Confirmar inscrição de teste', intent: 'confirmar_convite_grupo', context }] }] }))
    }
    if (storageBlocked) {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('dz_enrollment_attempt_v1:')) throw new DOMException('Fixture quota', 'QuotaExceededError')
        return original.call(this, key, value)
      }
    }
  }, { user, jwt, exp, context, storageBlocked, anonymous })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user })
    if (url.pathname === '/api/lili/chat' && method === 'POST') {
      if (anonymous) {
        anonymousCalls++; expect(request.headers().authorization).toBeUndefined(); expect(request.headers()['idempotency-key']).toBeUndefined()
        return route.fulfill({ json: { reply: 'Entre na conta para confirmar a inscrição.', intent: 'confirmar_convite_grupo', requiresAuth: true } })
      }
      const key = request.headers()['idempotency-key']; expect(key).toMatch(/^[\da-f-]{36}$/i)
      expect(request.headers().authorization).toMatch(/^Bearer /)
      keys.push(key); receipts.add(key)
      if (keys.length === 1) return route.abort('failed')
      return route.fulfill({ json: { reply: 'Inscrição recuperada pelo recibo.', intent: 'confirmar_convite_grupo', enrollmentConfirmed: true, context: { locale: 'pt-BR' } } })
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) { blocked.push(`${method} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: [] })
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { account: null, accounts: [], rows: [], items: [] } })
    return route.continue()
  })
  return { keys, receipts, errors, blocked, anonymousCalls: () => anonymousCalls }
}

test('Lili repete a confirmação com a mesma chave após recarga e resposta perdida', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/lili')
  await page.getByRole('button', { name: 'Confirmar inscrição de teste', exact: true }).click()
  await expect.poll(() => state.keys.length).toBe(1)
  await expect(page.getByText('Failed to fetch', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Tentar confirmar inscrição novamente', exact: true }).click()
  await expect(page.getByText('Inscrição recuperada pelo recibo.', { exact: true })).toBeVisible()
  expect(state.keys).toHaveLength(2); expect(state.keys[0]).toBe(state.keys[1]); expect(state.receipts.size).toBe(1)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('dz_enrollment_attempt_v1:')))).toEqual([])
  expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('Lili não confirma inscrição quando a chave não pode ser persistida', async ({ page }) => {
  const state = await fixture(page, true)
  await page.goto('/lili')
  await page.getByRole('button', { name: 'Confirmar inscrição de teste', exact: true }).click()
  await expect(page.getByText('Seu navegador não conseguiu guardar esta tentativa. Permita armazenamento nesta aba e tente novamente.', { exact: true })).toBeVisible()
  expect(state.keys).toEqual([]); expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('confirmação anônima na Lili conserva a orientação de login sem criar chave', async ({ page }) => {
  const state = await fixture(page, false, true)
  await page.goto('/lili')
  await page.getByRole('button', { name: 'Confirmar inscrição de teste', exact: true }).click()
  await expect(page.getByText('Entre na conta para confirmar a inscrição.', { exact: true })).toBeVisible()
  expect(state.anonymousCalls()).toBe(1); expect(state.keys).toEqual([])
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('dz_enrollment_attempt_v1:')))).toEqual([])
  expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})
