import { expect, test, type Page } from '@playwright/test'

const avatarUrl = 'https://fixture.example.test/avatar.png'
const updatedAvatarUrl = 'https://fixture.example.test/avatar-atualizado.png'
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=', 'base64')
const legacyCategories = [
  { title: 'COPAS', href: '/campeonatos?tipo=copa', image_url: '' },
  { title: 'LIGAS', href: '/campeonatos?tipo=liga', image_url: '' },
  { title: 'SALAS', href: '/campeonatos?tipo=diario', image_url: '' },
  { title: 'X1', href: '/campeonatos?tipo=confronto', image_url: '' },
  { title: 'GRÁTIS', href: '/campeonatos?gratis=1', image_url: '' },
  { title: 'VAGAS ABERTAS', href: '/campeonatos?vagas=1', image_url: '' },
]

async function fixture(page: Page, options: { authenticated?: boolean; linkedProfile?: boolean; failSaveOnce?: boolean } = {}) {
  const user = {
    id: '00000000-0000-4000-8000-000000000501', aud: 'authenticated', role: 'authenticated',
    email: 'conta@example.test', app_metadata: {}, created_at: '2026-01-01T00:00:00Z',
    user_metadata: { display_name: 'Minha conta', account_username: 'minha.conta', avatar_url: avatarUrl },
  }
  const account = options.linkedProfile ? {
    id: 'jogador-fixture', entity_type: 'account', profile_type: 'jogador', auth_user_id: user.id,
    name: 'Perfil competitivo', username: 'jogador', data: {}, status: 'ativo',
  } : null
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url'), 'fixture-signature'].join('.')
  const session = { access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }
  const writes: Array<Record<string, unknown>> = []
  const errors: string[] = []
  let failed = false
  let logoutCalls = 0
  await page.addInitScript(({ session, authenticated, account }) => {
    if (sessionStorage.getItem('home-account-fixture')) return
    sessionStorage.setItem('home-account-fixture', '1')
    localStorage.clear()
    if (authenticated) localStorage.setItem('sb-uukivzxabiydnrvjvabt-auth-token', JSON.stringify(session))
    if (account) {
      localStorage.setItem('dropzone_active_profile_type', account.profile_type)
      localStorage.setItem('dropzone_active_profile_id', account.id)
    }
  }, { session, authenticated: Boolean(options.authenticated), account })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://fixture.example.test/**', (route) => route.fulfill({ contentType: 'image/png', body: imageBytes }))
  await page.route('**/auth/v1/**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/logout')) {
      logoutCalls += 1
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/token') ? session : user })
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/upload') {
      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON().bucket).toBe('account')
      return route.fulfill({ json: { url: updatedAvatarUrl } })
    }
    if (url.pathname === '/api/me/account') {
      expect(route.request().method()).toBe('PATCH')
      expect(route.request().headers().authorization).toBe(`Bearer ${jwt}`)
      const body = route.request().postDataJSON()
      writes.push(body)
      if (options.failSaveOnce && !failed) {
        failed = true
        return route.fulfill({ status: 400, json: { error: 'Este @usuário já está em uso.' } })
      }
      user.user_metadata = { display_name: body.display_name, account_username: body.username, avatar_url: body.avatar_url }
      return route.fulfill({ json: { ok: true, user: { name: body.display_name, username: body.username, avatar_url: body.avatar_url, email: user.email } } })
    }
    expect(route.request().method(), 'Somente a edição explícita da conta pode gravar dados').toBe('GET')
    if (url.pathname === '/api/me') return route.fulfill({ json: { account, accounts: account ? [account] : [], user: { name: user.user_metadata.display_name, username: user.user_metadata.account_username, avatar_url: user.user_metadata.avatar_url, email: user.email } } })
    if (url.pathname === '/api/site/home') return route.fulfill({ json: { config: { categories: legacyCategories } } })
    return route.fulfill({ json: { rows: [], items: [], announcements: [] } })
  })
  return { writes, errors, logoutCalls: () => logoutCalls }
}

async function openAccount(page: Page) {
  await page.locator('.store-home-header').getByRole('button', { name: 'Abrir menu da conta' }).click()
  const menu = page.getByRole('region', { name: 'Minha conta', exact: true })
  await expect(menu).toBeVisible()
  return menu
}

test('home corrige categorias legadas e distribui os quatro tipos sem espaço vazio', async ({ page, isMobile }, testInfo) => {
  const { errors } = await fixture(page)
  await page.goto('/')
  const cards = page.locator('.store-home-categories > a')
  await expect(cards).toHaveCount(4)
  await expect(cards.locator('strong')).toHaveText(['XTREINO', 'COPA', 'LIGA', 'DIÁRIO'])
  for (const [index, type] of ['xtreino', 'copa', 'liga', 'diario'].entries()) {
    await expect(cards.nth(index)).toHaveAttribute('href', `/campeonatos?tipo=${type}`)
  }
  const layout = await cards.evaluateAll((elements) => elements.map((element) => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })))
  expect(new Set(layout.map((box) => box.y)).size).toBe(isMobile ? 2 : 1)
  expect(new Set(layout.map((box) => box.x)).size).toBe(isMobile ? 2 : 4)
  if (isMobile) await expect(cards.last()).toBeInViewport()
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }))
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 2)
  await expect(page.locator('.store-home-header').getByRole('link', { name: 'Entrar', exact: true })).toBeVisible()
  await testInfo.attach('home-categorias', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  expect(errors).toEqual([])
})

test('sessão sem perfil vinculado mostra avatar, edita informações e sai sem voltar ao login', async ({ page }, testInfo) => {
  const state = await fixture(page, { authenticated: true, failSaveOnce: true })
  await page.goto('/')
  const header = page.locator('.store-home-header')
  await expect(header.getByRole('img', { name: 'Foto do perfil' })).toHaveAttribute('src', avatarUrl)
  await expect(header.getByRole('link', { name: 'Entrar', exact: true })).toHaveCount(0)
  let menu = await openAccount(page)
  await expect(menu.getByText('Minha conta', { exact: true })).toBeVisible()
  await testInfo.attach('menu-conta', { body: await page.screenshot(), contentType: 'image/png' })
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(header.getByRole('button', { name: 'Abrir menu da conta' })).toBeFocused()
  menu = await openAccount(page)
  await menu.getByRole('button', { name: 'Editar informações' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar informações' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Nome de exibição' }).fill('Minha conta atualizada')
  await dialog.getByRole('textbox', { name: 'Usuário', exact: true }).fill('conta.atualizada')
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Este @usuário já está em uso.')
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes.at(-1)).toEqual({ display_name: 'Minha conta atualizada', username: 'conta.atualizada', avatar_url: avatarUrl })
  await page.reload()
  menu = await openAccount(page)
  await expect(menu.getByText('Minha conta atualizada', { exact: true })).toBeVisible()
  await expect(menu.getByText('@conta.atualizada', { exact: true })).toBeVisible()
  await menu.getByRole('button', { name: 'Editar informações' }).click()
  await dialog.getByLabel('Foto de perfil', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: imageBytes })
  await expect(dialog.getByRole('img', { name: 'Foto atual da conta' })).toHaveAttribute('src', /^blob:/)
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(header.getByRole('img', { name: 'Foto do perfil' })).toHaveAttribute('src', updatedAvatarUrl)
  expect(state.writes.at(-1)?.avatar_url).toBe(updatedAvatarUrl)
  await page.reload()
  await expect(header.getByRole('img', { name: 'Foto do perfil' })).toHaveAttribute('src', updatedAvatarUrl)
  menu = await openAccount(page)
  await menu.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(header.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible()
  await expect(header.getByRole('img', { name: 'Foto do perfil' })).toHaveCount(0)
  expect(state.logoutCalls()).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('dropzone_active_profile_id'))).toBeNull()
  await page.reload()
  await expect(header.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/')
  expect(state.errors).toEqual([])
})

test('conta com perfil vinculado também abre o menu sem redirecionar', async ({ page, isMobile }) => {
  const { errors } = await fixture(page, { authenticated: true, linkedProfile: true })
  await page.goto('/')
  const menu = await openAccount(page)
  await expect(menu.getByRole('button', { name: 'Editar informações' })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Minha área', exact: true })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Sair da conta' })).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
  await page.locator('.store-home-header .store-home-brand').click()
  await expect(menu).toHaveCount(0)
  if (isMobile) {
    await page.locator('.store-home-header').getByRole('button', { name: 'Abrir menu', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Menu completo do DropZone' }).getByRole('link', { name: 'Abrir minha área' })).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('cabeçalho compartilhado mantém avatar e edição nas páginas públicas', async ({ page }) => {
  const { errors } = await fixture(page, { authenticated: true })
  await page.goto('/termos-de-servico')
  await expect(page.locator('.store-home-header').getByRole('img', { name: 'Foto do perfil' })).toHaveAttribute('src', avatarUrl)
  const menu = await openAccount(page)
  await menu.getByRole('button', { name: 'Editar informações' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar informações' })
  await expect(dialog.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Minha conta')
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe('/termos-de-servico')
  expect(errors).toEqual([])
})
