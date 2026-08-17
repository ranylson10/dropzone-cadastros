import { test, expect, type Browser, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const authDir = path.resolve('tests-e2e/.auth')

function authFile(profile: string) {
  return path.join(authDir, `${profile}.json`)
}

async function authenticatedPage(browser: Browser, profile: string) {
  const file = authFile(profile)
  test.skip(!fs.existsSync(file), 'Gere as sessões: npm run test:e2e:auth:prepare')
  const context = await browser.newContext({ storageState: file })
  const page = await context.newPage()
  return { context, page }
}

async function assertHealthyPage(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('body')).not.toContainText(
    /Application error|Internal Server Error|This page couldn.t load|A server error occurred/i,
  )
  expect(page.url()).not.toContain('/login')
}

async function openHealthyPage(page: Page, href: string) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto(href, { waitUntil: 'domcontentloaded' })
    const body = await page.locator('body').innerText().catch(() => '')
    const serverError = /Application error|Internal Server Error|This page couldn.t load|A server error occurred/i.test(body)
    if (!serverError) {
      await assertHealthyPage(page)
      return
    }
    if (attempt === 1) await page.waitForTimeout(1_000)
  }
  await assertHealthyPage(page)
}

async function openInternalArea(page: Page, href: string, label: RegExp) {
  const link = page.locator(`a[href="${href}"]:visible`).first()
  if (await link.isVisible().catch(() => false)) {
    await link.click()
  } else {
    const control = page.getByRole('link', { name: label }).first()
    if (await control.isVisible().catch(() => false)) await control.click()
    else await page.goto(href)
  }
  await assertHealthyPage(page)
}

test.describe('Fluxos funcionais principais — sem alterar dados reais', () => {
  test('produtora abre, percorre o assistente e cancela novo campeonato', async ({ browser }) => {
    const { context, page } = await authenticatedPage(browser, 'produtora')
    try {
      // A raiz autenticada agora é um feed. O painel da produtora fica em Minha área.
      await page.goto('/')
      await assertHealthyPage(page)
      const createFromHome = page.getByRole('button', { name: /criar campeonato/i })
      await expect(createFromHome).toBeVisible()
      await createFromHome.click()

      const modal = page.getByRole('dialog').filter({ hasText: /novo campeonato/i }).first()
      await expect(modal).toBeVisible()

      // Primeiro escolhe o tipo; depois o assistente multipágina começa pela origem.
      const dailyOption = modal.getByRole('button', { name: /diário/i }).first()
      await expect(dailyOption).toBeVisible()
      await dailyOption.click()

      const createNewOption = modal.getByRole('button', { name: /criar novo/i }).first()
      await expect(createNewOption).toBeVisible()
      await createNewOption.click()

      // Preenche a identidade mínima e confirma o crop local; nenhum upload real ocorre antes do submit.
      const originChampionshipName = modal.locator('input[required]').first()
      await expect(originChampionshipName).toBeVisible()
      await originChampionshipName.fill(`E2E validação ${Date.now()}`)

      const logoInput = modal.locator('input[type=file]').first()
      await logoInput.setInputFiles({
        name: 'e2e-logo-fake.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
      })

      const useImageButton = page.getByRole('button', { name: /usar imagem/i }).last()
      await expect(useImageButton).toBeVisible()
      await useImageButton.click()
      await expect(useImageButton).toBeHidden()


      const continueButton = modal.getByRole('button', { name: /^continuar$/i })
      await expect(continueButton).toBeVisible()
      await expect(continueButton).toBeEnabled()
      await continueButton.click()


      await page.keyboard.press('Escape')
      await expect(modal).toBeHidden()
    } finally {
      await context.close()
    }
  })

  test('admin alterna entre Aprovações, Preços e Saques', async ({ browser }) => {
    const { context, page } = await authenticatedPage(browser, 'admin')
    try {
      await page.goto('/admin')
      await assertHealthyPage(page)

      for (const tab of ['Aprovações', 'Preços', 'Saques']) {
        const button = page.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') })
        await expect(button).toBeVisible()
        await button.click()
        await page.waitForTimeout(250)
        await assertHealthyPage(page)
      }

      await expect(page.getByText(/saques solicitados/i)).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('equipe abre edição e valida campos sem salvar alterações', async ({ browser }) => {
    const { context, page } = await authenticatedPage(browser, 'equipe')
    try {
      await page.goto('/equipes')
      await assertHealthyPage(page)

      const editButton = page.getByRole('button', { name: /editar perfil|editar equipe/i }).first()
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        expect(await dialog.locator('input').count()).toBeGreaterThan(0)
        const cancel = dialog.getByRole('button', { name: /cancelar|fechar/i }).first()
        if (await cancel.isVisible().catch(() => false)) await cancel.click()
      } else {
        await expect(page.locator('body')).toContainText(/equipe|line|elenco/i)
      }
    } finally {
      await context.close()
    }
  })

  test('manager navega pelas áreas principais sem erro', async ({ browser }) => {
    const { context, page } = await authenticatedPage(browser, 'manager')
    try {
      await page.goto('/')
      await assertHealthyPage(page)

      // Testa áreas reais do menu. Em mobile o menu pode estar recolhido, então há fallback por URL.
      await openInternalArea(page, '/campeonatos', /campeonatos/i)
      await openInternalArea(page, '/equipes', /equipes/i)
      await openInternalArea(page, '/jogadores', /jogadores/i)
    } finally {
      await context.close()
    }
  })

  test('jogador carrega perfil e links internos principais', async ({ browser }) => {
    const { context, page } = await authenticatedPage(browser, 'jogador')
    try {
      // A Vercel pode devolver uma tela transitória de erro durante cold start.
      // Repetimos uma única vez; erro persistente continua falhando como defeito real.
      await openHealthyPage(page, '/jogadores')
      await expect(page.locator('body')).toContainText(/jogador|perfil|estatística/i)

      const internalLinks = page.locator('a[href^="/"]')
      const count = Math.min(await internalLinks.count(), 8)
      for (let index = 0; index < count; index += 1) {
        const href = await internalLinks.nth(index).getAttribute('href')
        if (!href || href.startsWith('/api/') || href.includes('/logout')) continue
        const response = await context.request.get(href)
        expect(response.status(), `Link interno ${href}`).toBeLessThan(500)
      }
    } finally {
      await context.close()
    }
  })
})
