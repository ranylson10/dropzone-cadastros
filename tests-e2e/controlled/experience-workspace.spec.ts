import { expect, test, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { deputyFixture } from '../helpers/circuito-fixture'
import { chooseProducerTool } from '../helpers/producer-navigation'

const producerUrl = '/?painel=1&perfil=produtora&perfil_id=producer-a'
test.setTimeout(90_000)

async function fixture(page: Page) {
  const result = await deputyFixture(page, { ownedProducer: true, analytics: true })
  const producer = result.contexts.find(item => item.id === 'producer-a')!
  const championships = ['Copa Aurora', 'Liga Brasa', 'Diário Circuito', 'Copa Nova'].map((name, index) => ({
    ...producer, id: `00000000-0000-4000-8000-00000000070${index}`, entity_type: 'championship', profile_type: null,
    name, parent_id: producer.id, data: { produtora_id: producer.id, aprovacao_status: index === 3 ? 'pendente' : 'aprovado', tipo: 'copa', numero_vagas: 96, premiacao: 1000 },
  }))
  await page.route(url => url.pathname === '/api/dropzone', route => {
    expect(route.request().method()).toBe('GET')
    return route.fulfill({ json: { rows: championships, summary: { teamCount: 13, gameCount: 2, phaseCount: 2, groupCount: 4 } } })
  })
  await page.route(/\/api\/campeonatos\/[^/]+\/estrutura-avancada$/, route => route.fulfill({ json: {
    edition: null, edition_actor_id: '00000000-0000-4000-8000-000000000601', lifecycle_write_mode: 'unavailable',
    phases: [], groups: [], stages: [], divisions: [], seasons: [],
  } }))
  const phaseId = '00000000-0000-4000-8000-000000000801'
  const groupId = '00000000-0000-4000-8000-000000000802'
  await page.route(/\/api\/campeonatos\/[^/]+\/estrutura$/, route => route.fulfill({ json: {
    fases: [{ id: phaseId, nome: 'Classificatória', ordem: 1 }],
    grupos: [{ id: groupId, nome: 'Grupo A', fase_id: phaseId, slots: 12 }], slots: [], permission: {},
  } }))
  await page.route(/\/api\/campeonatos\/[^/]+\/equipes(?:\?.*)?$/, route => route.fulfill({ json: {
    campeonato: { id: championships[0].id, nome: championships[0].name },
    vagas: [{ id: '00000000-0000-4000-8000-000000000803', numero_vaga: 1, status: 'ocupada',
      fase_id: phaseId, grupo_id: groupId, fase: { id: phaseId, nome: 'Classificatória' }, grupo: { id: groupId, nome: 'Grupo A' },
      line_nome: 'ALOE Gaming', campeonato_equipe: { id: 'registration-a', origem_entrada: 'direta', nome_exibicao: 'ALOE Gaming' }, convite: null }],
    permission: { canView: true, canManage: false, canGenerateToken: false, role: 'leitura' },
  } }))
  return result
}

async function check(page: Page) {
  await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getTiming().iterations !== Infinity) animation.finish() })
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']).analyze()
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
}

test('panel switching stays reachable in the desktop top bar and mobile dock', async ({ page, isMobile }, info) => {
  const data = await fixture(page)
  await page.goto(producerUrl)
  await expect(page.getByRole('heading', { name: '6B Produções', exact: true })).toBeVisible()
  const header = page.locator('.store-home-header')
  const box = (await header.boundingBox())!
  expect(box.y).toBe(0)
  expect(box.height).toBeLessThanOrEqual(80)
  expect(box.width).toBeGreaterThan((await page.viewportSize())!.width - 2)
  const trigger = isMobile
    ? page.getByRole('navigation', { name: 'Navegação inferior do aplicativo' }).getByRole('button', { name: 'Abrir meus painéis', exact: true })
    : header.getByRole('button', { name: 'Abrir meus painéis', exact: true })
  await expect(trigger).toHaveClass(/active/)
  await expect(page.getByRole('list', { name: 'Seus campeonatos', exact: true })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(trigger).toBeInViewport()
  await trigger.click()
  const picker = page.getByRole('dialog', { name: 'Seus painéis', exact: true })
  await expect(picker.getByRole('link', { name: /Equipe Brasa/ })).toBeVisible()
  await check(page)
  await page.screenshot({ path: info.outputPath('workspace-picker.png') })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await picker.getByRole('link', { name: /Equipe Brasa/ }).click()
  await expect(page.getByRole('heading', { name: 'Painel da equipe', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toBeVisible()
  const nextTrigger = isMobile ? page.getByRole('navigation', { name: 'Navegação inferior do aplicativo' }).getByRole('button', { name: 'Abrir meus painéis', exact: true }) : header.getByRole('button', { name: 'Abrir meus painéis', exact: true })
  await nextTrigger.click()
  await picker.getByRole('link', { name: /Jogador Aurora/ }).click()
  await expect(page.getByRole('heading', { name: 'Meu painel', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('workspace-player.png'), fullPage: true })
  await check(page)
  const homeNav = isMobile ? page.getByRole('navigation', { name: 'Navegação inferior do aplicativo' }) : page.getByRole('complementary', { name: 'Navegação da plataforma' })
  await homeNav.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(page.locator('[data-workspace-kind]')).toHaveCount(0)
  await expect(page.locator('.home-platform-v15')).toBeVisible()
  expect(data.errors).toEqual([])
})

test('producer opens competitions directly, with filters and a separate operating area', async ({ page, isMobile }, info) => {
  const data = await fixture(page)
  await page.goto(producerUrl)
  await expect(page.getByRole('heading', { name: '6B Produções', exact: true })).toBeVisible()
  const list = page.getByRole('list', { name: 'Seus campeonatos', exact: true })
  await expect(list.getByRole('listitem')).toHaveCount(4)
  await expect(page.getByText('Seu próximo campeonato começa aqui', { exact: true })).toHaveCount(0)
  await expect(page.locator('.account-workspace-hero,.producer-workspace-dashboard,.dz-focus')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Novo campeonato', exact: true })).toBeVisible()
  if (isMobile) { const settings = await page.getByRole('navigation', { name: 'Áreas principais da produtora' }).getByRole('button', { name: 'Configurações', exact: true }).boundingBox(); expect(settings!.x + settings!.width).toBeLessThanOrEqual(page.viewportSize()!.width) }
  expect((await list.boundingBox())!.y).toBeLessThan(isMobile ? 600 : 430)
  expect((await list.getByRole('listitem').first().boundingBox())!.height).toBeLessThanOrEqual(68)
  await page.screenshot({ path: info.outputPath('producer-entry.png'), fullPage: true })
  await check(page)
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Editar perfil da produtora', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Editar perfil da produtora', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /Aguardando liberação\s*1/ }).click()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list.getByText('Copa Nova', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Todos\s*4/ }).click()
  await page.getByRole('textbox', { name: 'Buscar campeonato', exact: true }).fill('Aurora')
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await list.getByRole('button').click()
  await expect(page.getByRole('combobox', { name: 'Trocar campeonato', exact: true })).toHaveValue('00000000-0000-4000-8000-000000000700')
  await expect(list).toHaveCount(0)
  await chooseProducerTool(page, 'Fases e grupos')
  await expect(page.getByText('Classificatória', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '← Campeonatos', exact: true }).click()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: 'Trocar campeonato', exact: true })).toHaveCount(0)
  expect(new URL(page.url()).searchParams.has('campeonato')).toBe(false)
  expect(data.errors).toEqual([])
})

test('account actions open inside the viewport with readable colors', async ({ page }, info) => {
  await fixture(page)
  await page.route('**/api/admin/session', route => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /)
    return route.fulfill({ json: { isAdmin: true } })
  })
  await page.goto(producerUrl)
  await expect(page.getByRole('heading', { name: '6B Produções' })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir menu da conta', exact: true }).click()
  const account = page.getByRole('region', { name: 'Minha conta', exact: true })
  await expect(account.getByRole('button', { name: 'Sair da conta' })).toBeInViewport()
  await expect(account.getByRole('link', { name: 'Administração', exact: true })).toHaveAttribute('href', '/admin')
  await expect(account.getByRole('link', { name: 'Carteira', exact: true })).toHaveAttribute('href', '/carteira')
  const box = (await account.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y+box.height).toBeLessThanOrEqual((await page.viewportSize())!.height)
  await check(page)
  await page.screenshot({ path: info.outputPath('workspace-account-menu.png') })
})

async function shellGeometry(page: Page) {
  return page.evaluate(() => {
    const geometry = (selector: string) => {
      const node = document.querySelector(selector)!
      const rect = node.getBoundingClientRect()
      const css = getComputedStyle(node)
      return { x: rect.x, width: rect.width, background: css.backgroundColor, font: css.fontFamily }
    }
    return { header: geometry('.store-home-header'), body: geometry('.dz-platform-body'), sidebar: geometry('.dz-discovery-sidebar') }
  })
}

test('catalog and profile panels share the same shell, including championship operations', async ({ page, isMobile }, info) => {
  const data = await fixture(page)
  await page.goto('/campeonatos')
  await expect(page.getByRole('button', { name: 'Abrir menu da conta', exact: true })).toBeVisible()
  await expect(page.locator('.dz-platform-body')).toHaveCount(1)
  await expect(page.locator('.dz-platform-body')).toBeVisible()
  const catalog = await shellGeometry(page)
  await page.screenshot({ path: info.outputPath('shared-shell-catalog.png') })
  for (const suffix of ['', '&section=campeonatos&campeonato=00000000-0000-4000-8000-000000000700']) {
    await page.goto(producerUrl + suffix)
    await expect(page.getByRole('heading', { name: '6B Produções', exact: true })).toBeVisible()
    await expect(page.locator('.app-header')).toHaveCount(0)
    const panel = await shellGeometry(page)
    expect(panel).toEqual(catalog)
    if (suffix) {
      await expect(page.locator('dl[aria-label="Resumo do campeonato"]')).toBeVisible()
      await expect(page.locator('.detail-hero-ref,.dz-r20-configure,.dz-r20-spark')).toHaveCount(0)
      await expect(page.locator('.championship-summary')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(page.getByRole('list', { name: 'Seus campeonatos', exact: true })).toHaveCount(0)
      await check(page)
      await page.screenshot({ path: info.outputPath('shared-shell-championship.png'), fullPage: true })
      const areas = page.getByRole('navigation', { name: 'Áreas do campeonato', exact: true })
      for (const name of ['Equipes', 'Fases e grupos', 'Tabelas']) {
        await chooseProducerTool(page, name)
        await expect(page.locator('.champ-tab-body-ref')).toBeVisible()
        await expect(page.getByText('Carregando dados desta área', { exact: true })).toHaveCount(0)
        if (name === 'Equipes') await expect(page.getByText('ALOE Gaming', { exact: true })).toBeVisible()
        if (name === 'Fases e grupos') await expect(page.getByText('Classificatória', { exact: true }).first()).toBeVisible()
        if (name === 'Tabelas') await expect(page.getByRole('heading', { name: 'Desempenho do campeonato' })).toBeVisible()
        expect(data.errors).toEqual([])
        await page.evaluate(() => window.scrollTo(0, 0))
        await check(page)
        await page.screenshot({ path: info.outputPath(`championship-${name}.png`), fullPage: true })
      }
    }
  }
  if (!isMobile) {
    await page.getByRole('button', { name: 'Recolher menu lateral' }).click()
    const panel = await shellGeometry(page)
    await page.goto('/campeonatos')
    await expect(page.getByRole('button', { name: 'Abrir menu da conta', exact: true })).toBeVisible()
    await expect(page.locator('.dz-platform-body')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Expandir menu lateral' })).toBeVisible()
    expect(await shellGeometry(page)).toEqual(panel)
  }
  expect(data.errors).toEqual([])
})
