import { expect, test, type Page } from '@playwright/test'

const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const account = { id: 'producer-fixture', entity_type: 'account', profile_type: 'produtora', auth_user_id: user.id, name: 'Produtora de teste', data: { aprovacao_status: 'aprovado' }, status: 'ativo', created_by: user.id }
const championships = ['a', 'b'].map(id => ({ id: `champ-${id}`, entity_type: 'championship', name: `Copa ${id.toUpperCase()}`, data: { tipo: 'copa', aprovacao_status: 'aprovado', numero_vagas: 12 }, status: 'ativo', created_by: user.id }))

async function fixture(page: Page, options: { slowGames?: boolean; failOnce?: boolean } = {}) {
  const calls: Array<{ types: string[]; championship: string; summary: boolean }> = []
  const otherCalls: string[] = []
  const errors: string[] = []
  let failed = false
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url'), 'fixture-signature'].join('.')
  await page.addInitScript(({ jwt, exp, user, account }) => {
    localStorage.clear()
    localStorage.setItem('sb-uukivzxabiydnrvjvabt-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }))
    localStorage.setItem('dropzone_active_profile_type', 'produtora')
    localStorage.setItem('dropzone_active_profile_id', account.id)
  }, { jwt, exp, user, account })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/auth/v1/**', route => route.fulfill({ json: user }))
  await page.route('**/api/**', async route => {
    expect(route.request().method(), 'This navigation must not write data').toBe('GET')
    const url = new URL(route.request().url())
    if (url.pathname === '/api/me') return route.fulfill({ json: { account, accounts: [account] } })
    if (url.pathname === '/api/dropzone') {
      const call = { types: (url.searchParams.get('entity_types') || '').split(',').filter(Boolean), championship: url.searchParams.get('championship_id') || '', summary: url.searchParams.get('summary') === '1' }
      calls.push(call)
      if (options.failOnce && call.summary && !failed) {
        failed = true
        return route.fulfill({ status: 503, json: { error: 'Contagem temporariamente indisponível' } })
      }
      if (options.slowGames && call.championship === 'champ-a' && call.types.includes('game')) await new Promise(resolve => setTimeout(resolve, 500))
      const rows = call.types.includes('championship') ? championships : call.types.flatMap(type => {
        if (type === 'game') return [{ id: `game-${call.championship}`, entity_type: type, parent_id: call.championship, name: `Jogo ${call.championship}`, data: { fase_id: `phase-${call.championship}`, data_jogo: '2026-10-12', horario: '19:00', numero_partidas: 1, mapas: [], grupos_ids: [] }, status: 'agendado' }]
        if (type === 'phase') return [{ id: `phase-${call.championship}`, entity_type: type, parent_id: call.championship, name: 'Fase de teste', data: { ordem: 1 } }]
        return []
      })
      const summary = call.summary ? call.championship ? { teamCount: 3, gameCount: 1, phaseCount: call.championship === 'champ-b' ? 5 : 1, groupCount: 2 } : { teamCount: 20, gameCount: 7 } : undefined
      await route.fulfill({ json: { rows, summary } }).catch(error => { if (!options.slowGames) throw error })
      return
    }
    otherCalls.push(url.pathname)
    return route.fulfill({ json: { mapas: [], rows: [], equipes: [], grupos: [], jogadores: [], jogos: [], regras: [], pagamentos: [], edition: null } })
  })
  return { calls, otherCalls, errors }
}

function areas(page: Page) { return page.getByRole('navigation', { name: 'Áreas da produtora', exact: true }) }
async function openChampionships(page: Page) {
  await areas(page).getByRole('button', { name: 'Campeonatos', exact: true }).click()
  await expect(page.locator('.champ-operation-guide')).toBeVisible()
}

test('produtora abre com contagens e busca somente a área e campeonato ativos', async ({ page }) => {
  const { calls, otherCalls, errors } = await fixture(page)
  await page.goto('/?painel=1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.producer-dashboard-kpis').getByText('20', { exact: true })).toBeVisible({ timeout: 30000 })
  expect(calls[0].types).toEqual(['championship'])
  expect(calls.filter(call => call.summary).every(call => call.types.length === 0)).toBe(true)
  expect(otherCalls).not.toContain('/api/mapas')
  expect(otherCalls.some(path => path.includes('estrutura-avancada') || path.includes('/pagamentos/campeonato/'))).toBe(false)
  await openChampionships(page)
  await page.getByRole('navigation', { name: 'Áreas do campeonato', exact: true }).getByRole('button', { name: 'Operação', exact: true }).click()
  await page.getByRole('navigation', { name: 'Ferramentas de operação', exact: true }).getByRole('button', { name: 'Jogos e quedas', exact: true }).click()
  await page.getByRole('button', { name: 'Fase de teste 1 jogo(s)', exact: true }).click()
  await expect(page.locator('.champ-tab-body-ref').getByText('Jogo champ-a', { exact: true })).toBeVisible()
  expect(calls.findLast(call => call.types.includes('game'))).toEqual({ types: ['phase', 'group', 'game'], championship: 'champ-a', summary: true })
  expect(calls.some(call => call.types.includes('player_registration') || call.types.includes('lineup_rule'))).toBe(false)
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 4)
  }
  await areas(page).getByRole('button', { name: 'Configurações', exact: true }).click()
  expect(errors).toEqual([])
})

test('troca rápida de campeonato descarta a resposta anterior', async ({ page }) => {
  const { errors } = await fixture(page, { slowGames: true })
  await page.goto('/?painel=1', { waitUntil: 'domcontentloaded' })
  await openChampionships(page)
  await page.getByRole('navigation', { name: 'Áreas do campeonato', exact: true }).getByRole('button', { name: 'Operação', exact: true }).click()
  const pending = page.waitForRequest(request => request.url().includes('championship_id=champ-a') && new URL(request.url()).searchParams.get('entity_types') === 'phase,group,game')
  await page.getByRole('navigation', { name: 'Ferramentas de operação', exact: true }).getByRole('button', { name: 'Jogos e quedas', exact: true }).click()
  await pending
  await page.locator('.producer-championship-list').getByRole('button', { name: /Copa B/ }).click()
  await expect(page.locator('.detail-stat').filter({ hasText: 'Fases' }).locator('strong')).toHaveText('5')
  await page.waitForTimeout(650)
  await expect(page.locator('.detail-stat').filter({ hasText: 'Fases' }).locator('strong')).toHaveText('5')
  await expect(page.locator('.champ-tab-body-ref').getByText('Jogo champ-a', { exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('falha de contagem aparece e pode ser repetida sem mostrar zero falso', async ({ page }) => {
  const { errors } = await fixture(page, { failOnce: true })
  await page.goto('/?painel=1', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('alert').filter({ hasText: 'Contagem temporariamente indisponível' })).toBeVisible()
  await expect(page.locator('.producer-dashboard-kpis').getByText('0', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.locator('.producer-dashboard-kpis').getByText('20', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Contagem temporariamente indisponível' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('atalho da Lili abre inscrições e permite mudar de aba sem voltar ao atalho', async ({ page }) => {
  const { calls, errors } = await fixture(page)
  await page.goto('/?painel=1&campeonato=champ-b&section=links', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Entrada de equipes por grupo', exact: true })).toBeVisible()
  expect(calls.filter(call => call.types.length && !call.types.includes('championship')).every(call => call.championship === 'champ-b')).toBe(true)
  await page.getByRole('navigation', { name: 'Áreas do campeonato', exact: true }).getByRole('button', { name: 'Operação', exact: true }).click()
  await page.getByRole('navigation', { name: 'Ferramentas de operação', exact: true }).getByRole('button', { name: 'Jogos e quedas', exact: true }).click()
  await page.getByRole('button', { name: 'Fase de teste 1 jogo(s)', exact: true }).click()
  await expect(page.locator('.champ-tab-body-ref').getByText('Jogo champ-b', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Entrada de equipes por grupo', exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})
