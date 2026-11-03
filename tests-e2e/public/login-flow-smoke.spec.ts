import { test, expect } from '@playwright/test'

test.describe('Login publico — smoke e troca de conta', () => {
  test('raiz sem sessão abre a home pública e oferece login somente como ação', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('.store-home-hero').getByRole('link', { name: /Ver campeonatos/i })).toBeVisible()
    await expect(page.locator('.store-home-section-head').getByRole('heading', { name: /Campeonatos.*destaque/i })).toBeVisible()
    await expect(page.locator('.store-home-header').getByRole('link', { name: 'Entrar', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Criar campeonato/i })).toHaveCount(0)
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
