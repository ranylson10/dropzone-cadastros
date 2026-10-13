import { expect, test, type Page } from '@playwright/test'

const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const teams = ['Alpha', 'Beta', 'Gamma'].map((name, index) => ({ id: `team-${index}`, nome: `Equipe ${name}`, tag: name, public_id: index + 100, lines: [{ id: `line-${index}`, nome: `Line ${name}`, ja_inscrita: false }] }))
const numericTeam = { id: 'team-numeric', nome: 'Número Exato', tag: 'NX', public_id: 101, lines: [{ id: 'line-numeric', nome: 'Line Número', ja_inscrita: false }] }
type SearchCall = { q: string; cursor: string | null; limit: string | null; authorization: string | undefined }

async function fixture(page: Page, options: { profile?: 'jogador' | 'produtora'; failMoreOnce?: boolean; slowQueries?: boolean } = {}) {
  const profile = options.profile || 'jogador'
  const account = { id: `${profile}-fixture`, entity_type: 'account', profile_type: profile, auth_user_id: user.id, name: 'Perfil de teste', data: { aprovacao_status: 'aprovado' }, status: 'ativo', created_by: user.id }
  const championship = { id: 'champ-a', entity_type: 'championship', name: 'Copa A', data: { tipo: 'copa', aprovacao_status: 'aprovado', numero_vagas: 2 }, status: 'ativo', created_by: user.id }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url'), 'fixture-signature'].join('.')
  const calls: SearchCall[] = []
  const errors: string[] = []
  const methods: string[] = []
  let failed = false
  await page.addInitScript(({ jwt, exp, user, account, profile }) => {
    localStorage.clear()
    localStorage.setItem('sb-uukivzxabiydnrvjvabt-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }))
    localStorage.setItem('dropzone_active_profile_type', profile)
    localStorage.setItem('dropzone_active_profile_id', account.id)
  }, { jwt, exp, user, account, profile })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/auth/v1/**', route => route.fulfill({ json: user }))
  await page.route('**/api/**', async route => {
    methods.push(route.request().method())
    expect(route.request().method(), 'Search and selection must not write data').toBe('GET')
    const url = new URL(route.request().url())
    if (url.pathname === '/api/me') return route.fulfill({ json: { account, accounts: [account] } })
    if (url.pathname === '/api/dropzone') return route.fulfill({ json: { rows: profile === 'produtora' && url.searchParams.get('entity_types')?.includes('championship') ? [championship] : [], summary: { teamCount: 0, gameCount: 0, phaseCount: 1, groupCount: 1 } } })
    if (url.pathname.endsWith('/busca-publica') || url.pathname === '/api/campeonatos/champ-a/equipes/busca') {
      const call = { q: url.searchParams.get('q') || '', cursor: url.searchParams.get('cursor'), limit: url.searchParams.get('limit'), authorization: route.request().headers().authorization }
      calls.push(call)
      if (options.failMoreOnce && call.cursor && !failed) {
        failed = true
        return route.fulfill({ status: 503, json: { error: 'Busca temporariamente indisponível' } })
      }
      if (options.slowQueries && ['Alpha', 'Gamma'].includes(call.q)) await new Promise(resolve => setTimeout(resolve, 750))
      const items = call.q === 'Beta' ? [teams[1]] : call.q === 'EQ 101' ? [numericTeam] : call.cursor ? [teams[1], teams[2]] : [teams[0], teams[1]]
      const nextCursor = call.q === 'Beta' || call.q === 'EQ 101' || call.cursor ? null : 'cursor-alpha'
      await route.fulfill({ json: { [profile === 'produtora' ? 'equipes' : 'items']: items, nextCursor, hasMore: Boolean(nextCursor) } }).catch(error => { if (!options.slowQueries) throw error })
      return
    }
    const permission = { canManage: true, canOrganizeGroups: true, canRemove: true, canGenerateToken: true }
    const slots = [1, 2].map(number => ({ id: `slot-${number}`, grupo_id: 'group-a', fase_id: 'phase-a', slot_letra: number === 1 ? 'A' : 'B', slot_numero: number, status: 'livre' }))
    if (url.pathname === '/api/campeonatos/champ-a/estrutura') return route.fulfill({ json: { fases: [{ id: 'phase-a', nome: 'Fase de teste', ordem: 1 }], grupos: [{ id: 'group-a', nome: 'Grupo A', fase_id: 'phase-a', slots: 2 }], slots, permission } })
    if (url.pathname === '/api/campeonatos/champ-a/equipes') return route.fulfill({ json: { campeonato: { id: 'champ-a', nome: 'Copa A' }, vagas: slots, permission } })
    return route.fulfill({ json: { mapas: [], rows: [], items: [], equipes: [], grupos: [], jogadores: [], jogos: [], regras: [], pagamentos: [], journey: [], participacoes: [], edition: null } })
  })
  return { calls, errors, methods }
}

async function openPlayerSearch(page: Page) {
  await page.goto('/?painel=1', { waitUntil: 'domcontentloaded' })
  await page.getByRole('navigation', { name: 'Áreas do jogador', exact: true }).getByRole('button', { name: 'Equipe', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Buscar equipe', exact: true })).toBeVisible()
  return page.locator('.player-team-request')
}

test('busca carrega a próxima página, preserva o texto e remove resultados duplicados', async ({ page }, testInfo) => {
  const { calls, errors, methods } = await fixture(page)
  const search = await openPlayerSearch(page)
  await search.getByRole('textbox').fill('Alpha')
  await expect(search.locator('article')).toHaveCount(2)
  await search.getByRole('button', { name: 'Carregar mais resultados', exact: true }).click()
  await expect(search.locator('article')).toHaveCount(3)
  await expect(search.getByRole('button', { name: 'Carregar mais resultados', exact: true })).toHaveCount(0)
  expect(calls.map(({ q, cursor, limit }) => ({ q, cursor, limit }))).toEqual([{ q: 'Alpha', cursor: null, limit: '30' }, { q: 'Alpha', cursor: 'cursor-alpha', limit: '30' }])
  expect(calls.every(call => !call.authorization)).toBe(true)
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 4)
    await expect(page.locator('.dz-workspace-header h2')).toHaveCSS('color', 'rgb(29, 33, 38)')
  }
  await search.screenshot({ path: `relatorios-testes/paginacao-2026-10-11/search-${testInfo.project.name}-320.png` })
  expect(errors).toEqual([])
  expect(methods.every(method => method === 'GET')).toBe(true)
})

test('falha na continuação mantém a primeira página e permite repetir o mesmo cursor', async ({ page }) => {
  const { calls, errors } = await fixture(page, { failMoreOnce: true })
  const search = await openPlayerSearch(page)
  await search.getByRole('textbox').fill('Alpha')
  await expect(search.locator('article')).toHaveCount(2)
  await search.getByRole('button', { name: 'Carregar mais resultados', exact: true }).click()
  await expect(search.getByRole('alert')).toHaveText('Busca temporariamente indisponível')
  await expect(search.locator('article')).toHaveCount(2)
  await search.getByRole('button', { name: 'Carregar mais resultados', exact: true }).click()
  await expect(search.locator('article')).toHaveCount(3)
  await expect(search.getByRole('alert')).toHaveCount(0)
  expect(calls.filter(call => call.cursor).map(call => call.cursor)).toEqual(['cursor-alpha', 'cursor-alpha'])
  expect(errors).toEqual([])
})

test('trocar ou limpar a pesquisa descarta respostas anteriores e seus cursores', async ({ page }) => {
  const { errors } = await fixture(page, { slowQueries: true })
  const search = await openPlayerSearch(page)
  const input = search.getByRole('textbox')
  const alphaRequest = page.waitForRequest(request => request.url().includes('/busca-publica?') && new URL(request.url()).searchParams.get('q') === 'Alpha')
  await input.fill('Alpha')
  await alphaRequest
  await input.fill('Beta')
  await expect(search.locator('article')).toHaveCount(1)
  await expect(search.locator('article strong')).toHaveText('Equipe Beta')
  await page.waitForTimeout(800)
  await expect(search.locator('article strong')).toHaveText('Equipe Beta')
  await expect(search.getByRole('button', { name: 'Carregar mais resultados', exact: true })).toHaveCount(0)
  const gammaRequest = page.waitForRequest(request => request.url().includes('/busca-publica?') && new URL(request.url()).searchParams.get('q') === 'Gamma')
  await input.fill('Gamma')
  await gammaRequest
  await input.fill('')
  await page.waitForTimeout(800)
  await expect(search.locator('article')).toHaveCount(0)
  await expect(search.getByRole('button', { name: 'Carregar mais resultados', exact: true })).toHaveCount(0)
  await expect(search.getByRole('alert')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('seleção em lote usa continuação e busca por ID sem perder a line já selecionada', async ({ page }, testInfo) => {
  const { calls, errors, methods } = await fixture(page, { profile: 'produtora' })
  await page.goto('/?painel=1&campeonato=champ-a&section=grupos', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Adicionar equipes · 2 vaga(s)', exact: true }).click()
  const modal = page.getByRole('dialog', { name: 'Adicionar equipes · Grupo A', exact: true })
  await expect(modal).toBeVisible()
  const firstInput = modal.getByRole('textbox', { name: 'Equipe 1', exact: true })
  await firstInput.focus()
  await expect(modal.locator('.slot-team-options').getByRole('button', { name: /Equipe Alpha/ })).toBeVisible()
  // Refocusing before the delayed blur closes must keep the current page usable.
  await firstInput.evaluate(element => { (element as HTMLInputElement).blur(); (element as HTMLInputElement).focus() })
  await page.waitForTimeout(160)
  await expect(modal.getByRole('button', { name: 'Carregar mais equipes', exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Carregar mais equipes', exact: true }).click()
  await modal.locator('.slot-team-options').getByRole('button', { name: /Equipe Gamma/ }).click()
  await expect(firstInput).toHaveValue(/Equipe Gamma/)
  await expect(modal.getByRole('combobox', { name: 'Line 1', exact: true })).toHaveValue('line-2')
  await modal.getByRole('textbox', { name: 'Equipe 2', exact: true }).fill('EQ 101')
  await modal.locator('.slot-team-options').getByRole('button', { name: /Número Exato/ }).click()
  await expect(modal.getByRole('combobox', { name: 'Line 2', exact: true })).toHaveValue('line-numeric')
  await expect(modal.getByRole('combobox', { name: 'Line 1', exact: true })).toHaveValue('line-2')
  expect(calls.some(call => call.cursor === 'cursor-alpha' && call.limit === '30')).toBe(true)
  expect(calls.some(call => call.q === 'EQ 101' && !call.cursor)).toBe(true)
  expect(calls.every(call => call.authorization?.startsWith('Bearer '))).toBe(true)
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 4)
    const bounds = await modal.locator('.slot-batch-table').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }))
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 4)
    if (width <= 390) {
      await expect(modal.locator('.slot-batch-line-label').first()).toBeVisible()
      const table = await modal.locator('.slot-batch-table').boundingBox()
      const line = await modal.getByRole('combobox', { name: 'Line 1', exact: true }).boundingBox()
      expect(table && line && line.x >= table.x && line.x + line.width <= table.x + table.width + 1).toBe(true)
    }
  }
  await modal.screenshot({ path: `relatorios-testes/paginacao-2026-10-11/batch-${testInfo.project.name}-320.png` })
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect(errors).toEqual([])
  expect(methods.every(method => method === 'GET')).toBe(true)
})
