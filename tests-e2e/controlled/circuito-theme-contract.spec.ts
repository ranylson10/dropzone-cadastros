import { expect, test } from '@playwright/test'
import { deputyFixture } from '../helpers/circuito-fixture'
import { assertSharedIdentity } from '../helpers/shared-identity'
import { inspectContrast } from '../../scripts/design/inspect-contrast.mjs'

test.use({ reducedMotion: 'reduce' })
test.setTimeout(90_000)

test('ranking keeps the shared skin through tabs, search and portalled dialogs', async ({ page }, info) => {
  await page.route('**/api/**', route => {
    expect(route.request().method()).toBe('GET')
    if (new URL(route.request().url()).pathname === '/api/rank') return route.fulfill({ json: {
      teams: [{ key: 'team', id: 'team-fixture', nome: 'Equipe Aurora', tag: 'AUR', rank: 1, score: 42, tier: 'C', abates: 32, pontos: 38, jogadores: 4, quedas: 1 }],
      players: [{ key: 'player', id: 'player-fixture', nick: 'Lua', rank: 1, score: 35, tier: 'D', abates: 16, assistencias: 4, quedas: 1 }],
      championships: [{ key: 'champ', id: 'champ-fixture', nome: 'Copa Aurora', rank: 1, score: 50, tier: 'C', participantes: 12, jogadores: 48, quedas: 6 }],
      updated_at: '2026-11-03T06:00:00Z',
    } })
    return route.fulfill({ json: { rows: [], items: [] } })
  })
  await page.goto('/rank')
  await expect(page.getByRole('button', { name: /Ver estatísticas de Equipe Aurora/ })).toBeVisible()
  const row = page.locator('.dz-ranking-item').first()
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(64)
  await expect(page.locator('.dz-ranking-score > strong').first()).toHaveCSS('font-size', '17px')
  await expect(page.locator('.dz-ranking-number').first()).toHaveCSS('font-size', '16px')
  await assertSharedIdentity(page)
  for (const [tab, name] of [['Jogadores', 'Lua'], ['Campeonatos', 'Copa Aurora'], ['Equipes', 'Equipe Aurora']]) {
    await page.getByRole('navigation', { name: 'Tipo de ranking' }).getByRole('button', { name: tab, exact: true }).click()
    const row = page.getByRole('button', { name: new RegExp(`Ver estatísticas de ${name}`) })
    await expect(row).toBeVisible()
    await row.click()
    const dialog = page.getByRole('dialog', { name, exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveCSS('background-color', 'rgb(255, 254, 249)')
    await assertSharedIdentity(page)
    await page.screenshot({ path: info.outputPath(`ranking-${tab}.png`), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(row).toBeFocused()
  }
  await page.getByRole('searchbox', { name: /no ranking/ }).fill('inexistente')
  await expect(page.getByText('Nenhum resultado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Limpar busca' }).click()
  await page.getByRole('button', { name: 'Como funciona o ranking' }).click()
  await assertSharedIdentity(page)
  await page.keyboard.press('Escape')
})

test('Lili mounts the platform navigation and keeps the composer above the mobile dock', async ({ page }, info) => {
  await page.route('**/api/**', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: { rows: [], items: [] } })
  })
  await page.goto('/lili')
  await expect(page.locator('.store-home-header:visible')).toBeVisible()
  const composer = page.locator('.lili-hub-composer:visible input')
  await expect(composer).toBeInViewport()
  const dock = page.locator('.dz-public-bottom-nav:visible')
  if (await dock.isVisible()) {
    const [inputBox, dockBox] = await Promise.all([composer.boundingBox(), dock.boundingBox()])
    expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(dockBox!.y)
  }
  await assertSharedIdentity(page)
  await page.screenshot({ path: info.outputPath('lili.png'), animations: 'disabled' })
})

test('authentication forms use the same identity across entry, signup and recovery', async ({ page }, info) => {
  await page.route('**/api/**', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: {} })
  })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entre com sua conta' })).toBeVisible()
  await assertSharedIdentity(page)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible()
  await assertSharedIdentity(page)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Esqueci minha senha', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Recupere sua senha' })).toBeVisible()
  await assertSharedIdentity(page)
  await page.screenshot({ path: info.outputPath('recovery.png'), animations: 'disabled' })
})

test('delegated team editing uses the shared form skin', async ({ page }, info) => {
  await deputyFixture(page)
  await page.goto('/?painel=1&perfil=equipe&perfil_id=team-b')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Fechar edição do perfil' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Equipe Brasa')
  await assertSharedIdentity(page)
  await page.screenshot({ path: info.outputPath('team-edit.png'), animations: 'disabled' })
})

test('administration shares the platform frame through its nine views', async ({ page }, info) => {
  await deputyFixture(page)
  await page.route('**/api/admin/**', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: { metrics: { infra: {} }, accounts: [], rows: [], items: [], convites: [], saques: [], precos: [] } })
  })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Central DropZone' })).toBeVisible()
  await expect(page.locator('.store-home-header:visible')).toBeVisible()
  for (const tab of ['Página inicial', 'Produtoras', 'Publicações', 'Preços', 'Saques', 'Contas', 'Denúncias', 'Auditoria', 'Visão geral']) {
    await page.locator('.system-admin-tabs').getByRole('button', { name: tab === 'Denúncias' ? /^Denúncias/ : tab, exact: true }).click()
    await assertSharedIdentity(page)
  }
  await page.screenshot({ path: info.outputPath('admin.png'), animations: 'disabled' })
})

test('entity directories use the compact striped list and aligned column headings', async ({ page }, info) => {
  await page.route('**/api/**', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: { rows: [], items: [] } })
  })
  await page.goto('/equipes')
  const rows = page.locator('.directory-list--table > [data-dz-list-item]')
  await expect(rows.nth(1)).toBeVisible()
  const backgrounds = await rows.evaluateAll(elements => elements.slice(0, 2).map(element => getComputedStyle(element).backgroundColor))
  expect(backgrounds[0]).toBe('rgb(255, 254, 249)')
  expect(backgrounds[1]).toBe('rgb(233, 231, 223)')
  expect((await rows.first().boundingBox())!.height).toBeLessThanOrEqual(72)
  await assertSharedIdentity(page)
  await page.screenshot({ path: info.outputPath('entity-list.png'), animations: 'disabled' })
})

test('workspace data lists consume the same row spacing and stripes', async ({ page }) => {
  await deputyFixture(page, { analytics: true })
  await page.goto('/?painel=1&perfil=equipe&perfil_id=team-b')
  const rows = page.locator('.team-analytics-ranked-list[data-dz-list="legacy"] > .team-analytics-ranked-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toHaveCSS('background-color', 'rgb(255, 254, 249)')
  await expect(rows.nth(1)).toHaveCSS('background-color', 'rgb(233, 231, 223)')
  expect((await rows.first().boundingBox())!.height).toBeLessThanOrEqual(80)
  await assertSharedIdentity(page)
})

test('championship tabs keep names readable and use the shared list model', async ({ page }, info) => {
  await page.route('**/api/**', route => {
    expect(route.request().method()).toBe('GET')
    const path = new URL(route.request().url()).pathname
    const team = { campeonato_equipe_id: 'fixture-team', nome: 'Equipe Aurora', colocacao: 1, quedas: 4, booyahs: 2, abates: 32, pontos_posicao: 48, pontos_abates: 32, pontos_total: 80 }
    const player = { campeonato_jogador_id: 'fixture-player', campeonato_equipe_id: 'fixture-team', nick: 'Lua', colocacao: 1, quedas: 4, abates: 16, dano: 2000, assistencias: 4, revives: 2 }
    if (path.endsWith('/estatisticas/campeao')) return route.fulfill({ json: { final_concluida: true, campeao: team, jogadores: [player], resumo: { quedas: 4 } } })
    if (path.endsWith('/estatisticas/equipes')) return route.fulfill({ json: { equipes: [team] } })
    if (path.endsWith('/estatisticas/mvp')) return route.fulfill({ json: { jogadores: [player] } })
    return route.fulfill({ json: { rows: [], items: [], final_concluida: false, publicacao: { visivel: true } } })
  })
  // Public catalog fixture with enrolled teams and players, read without account writes.
  await page.goto('/campeonatos/d9fd2723-800c-418b-bd35-b5a5186b685e')
  for (const [tab, item] of [['Equipes', '.champ-public-team-row'], ['Jogadores', '.champ-public-player-row']]) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
    await expect(page.locator(item).nth(1)).toBeVisible()
    await expect(page.locator(`${item} .${tab === 'Equipes' ? 'champ-public-team-copy' : 'champ-public-player-copy'}`).first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    expect((await page.locator(item).first().boundingBox())!.height).toBeLessThanOrEqual(64)
    expect(await page.evaluate(inspectContrast, '.champ-public-panel *')).toEqual([])
    await assertSharedIdentity(page)
    await page.screenshot({ path: info.outputPath(`championship-${tab}.png`), animations: 'disabled' })
  }
  await page.getByRole('tab', { name: /^Estatísticas/ }).click()
  await expect(page.getByRole('tab', { name: 'MVP', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'MVP', exact: true }).click()
  expect(await page.evaluate(inspectContrast, '.champ-public-panel *')).toEqual([])
  await assertSharedIdentity(page)
  const mobileFilters = page.getByRole('button', { name: 'Abrir filtros', exact: true })
  if (await mobileFilters.isVisible()) {
    await mobileFilters.click()
    const dialog = page.getByRole('dialog', { name: 'Filtrar estatísticas' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Fase', exact: true }).click()
    await dialog.locator('.champ-filter-group').filter({ has: page.getByRole('heading', { name: 'Fase', exact: true }) }).getByRole('button').nth(1).click()
    await assertSharedIdentity(page)
    expect(await page.evaluate(inspectContrast, '.system-modal *')).toEqual([])
    await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click()
  } else {
    await page.locator('.champ-stats-filters-desktop select').first().selectOption({ index: 1 })
  }
  await expect(page.getByText('Lua', { exact: true }).first()).toBeVisible()
  await assertSharedIdentity(page)
  await page.getByRole('tab', { name: 'Campeão', exact: true }).click()
  await expect(page.locator('.champion-public-spotlight')).toBeVisible()
  expect(await page.evaluate(inspectContrast, '.champ-public-panel *')).toEqual([])
  await assertSharedIdentity(page)
  await page.screenshot({ path: info.outputPath('championship-champion.png'), animations: 'disabled' })
})
