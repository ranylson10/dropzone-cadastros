import { test, expect } from '@playwright/test'

test.describe('Login publico — smoke e troca de conta', () => {
  test('raiz sem sessão abre a home pública e oferece login somente como ação', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: /Encontrar vaga/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Campeonatos com vagas abertas' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Entrar no sistema/i })).toBeVisible()

    await expect(page.getByText('Produtoras são privadas')).toBeVisible()
    await expect(page.getByText(/Workspaces de organização são liberados somente pela administração/i)).toBeVisible()
    await expect(page.getByText('Organizo campeonatos')).toHaveCount(0)
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
