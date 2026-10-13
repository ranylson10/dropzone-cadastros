import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dims.scroll, `${page.url()} estourou horizontalmente: ${dims.scroll}px > ${dims.client}px`).toBeLessThanOrEqual(dims.client + 4)
}

async function openPanel(page: Page, baseURL?: string) {
  const response = await page.goto(`${baseURL || 'http://localhost:3000'}/?painel=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  })
  expect(response?.status() ?? 200).toBeLessThan(500)
}

async function expectCanonicalProfileForm(page: Page, workspaceKind: string) {
  const root = page.locator(`.dz-workspace[data-workspace-kind="${workspaceKind}"]`).first()
  await expect(root).toBeVisible({ timeout: 20_000 })
  await root.locator('.dz-workspace-nav__item', { hasText: 'Perfil' }).first().click()

  const form = root.locator('.profile-edit-form').first()
  await expect(form).toBeVisible({ timeout: 15_000 })
  await expect(form.locator('.dz-form-grid').first()).toBeVisible()
  await expect(form.locator('[data-dz-field="true"]').first()).toBeVisible()
  await expect(form.locator('.dz-ui-control').first()).toBeVisible()
  await expect(form.locator('.dz-form-actions .dz-ui-button').first()).toBeVisible()
  await noOverflow(page)
}

test.describe.configure({ mode: 'serial' })

test('jogador: edição de perfil usa formulário canônico', async ({ browser, baseURL }) => {
  const state = path.resolve('tests-e2e/.auth/jogador.json')
  test.skip(!fs.existsSync(state), 'Capture a sessão do perfil jogador')
  const context = await browser.newContext({ storageState: state })
  const page = await context.newPage()
  try {
    await openPanel(page, baseURL)
    await expectCanonicalProfileForm(page, 'jogador')
  } finally {
    await context.close()
  }
})

test('manager: edição de perfil usa formulário e WhatsApp canônicos', async ({ browser, baseURL }) => {
  const state = path.resolve('tests-e2e/.auth/manager.json')
  test.skip(!fs.existsSync(state), 'Capture a sessão do perfil manager')
  const context = await browser.newContext({ storageState: state })
  const page = await context.newPage()
  try {
    await openPanel(page, baseURL)
    await expectCanonicalProfileForm(page, 'manager')

    const root = page.locator('.dz-workspace[data-workspace-kind="manager"]').first()
    const whatsapp = root.locator('.profile-edit-form .whatsapp-phone-field').first()
    await expect(whatsapp).toBeVisible()
    await expect(whatsapp.locator('select.dz-ui-control')).toBeVisible()
    await expect(whatsapp.locator('input.dz-ui-control')).toBeVisible()
  } finally {
    await context.close()
  }
})
