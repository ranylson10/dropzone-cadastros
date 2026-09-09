import { test, expect } from '@playwright/test'

test.describe('Login publico — smoke e troca de conta', () => {
  test('home oferece entrada e criação de conta em fluxos separados', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('button', { name: /^Entrar$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Criar conta$/ })).toBeVisible()

    await page.getByRole('button', { name: /^Criar conta$/ }).click()
    await expect(page).toHaveURL(/\/login\?.*mode=criar/)
    await expect(page.getByRole('heading', { name: 'CRIE SUA CONTA' })).toBeVisible()
  })

  test('pagina de login abre, switch limpa fluxo e callback sem sessao mostra acao de entrada', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    await expect(page.locator('body')).toContainText(/ENTRE COM SUA CONTA|ESCOLHA SEU PERFIL|Validando seu acesso/i)

    await page.goto('/login?switch=1&returnTo=%2Fvagas', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    await expect(page.locator('body')).toContainText(/ENTRE COM SUA CONTA|Continuar com Google/i)

    await page.goto('/login?complete=1&returnTo=%2Fvagas', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    await expect(page.locator('body')).toContainText(/ENTRE COM SUA CONTA|Continuar com Google|Validando seu acesso/i)
  })
})
