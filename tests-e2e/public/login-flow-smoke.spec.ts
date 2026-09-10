import { test, expect } from '@playwright/test'

test.describe('Login publico — smoke e troca de conta', () => {
  test('raiz sem sessão abre a home pública e oferece login somente como ação', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: /Encontrar vaga/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Campeonatos com vagas abertas' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Entrar no sistema/i })).toBeVisible()

    await page.getByRole('button', { name: /Criar campeonato/i }).click()
    await expect(page.getByRole('dialog', { name: 'Cadastre sua produtora' })).toBeVisible()
    await page.getByRole('button', { name: /Cadastrar produtora/i }).click()
    await expect(page.getByRole('dialog', { name: 'Cadastrar produtora' })).toContainText('Entre com sua conta')
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
