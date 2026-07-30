import { expect, test } from '@playwright/test'
import { PUBLIC_ROUTES } from '../support/public-routes'

for (const route of PUBLIC_ROUTES) {
  test(`${route} abre sem erro fatal`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })

    expect(response, `A rota ${route} não respondeu`).not.toBeNull()
    expect(response!.status(), `A rota ${route} retornou ${response!.status()}`).toBeLessThan(500)
    await expect(page.locator('body')).not.toBeEmpty()

    expect(pageErrors, `Erros JavaScript em ${route}:\n${pageErrors.join('\n')}`).toEqual([])
  })
}

test('página de login apresenta o fluxo de autenticação', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('status').or(page.getByRole('heading', { name: /entrar no dropzone/i })),
  ).toBeVisible()
})
