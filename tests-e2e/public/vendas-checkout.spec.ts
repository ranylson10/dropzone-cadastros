import { expect, test } from '@playwright/test'

test.describe('Link público de venda assistida', () => {
  test('link inexistente explica o problema e oferece uma saída', async ({ page }) => {
    await page.goto('/vendas/VS-NAO-EXISTE', { waitUntil: 'domcontentloaded' })

    await expect(page.getByText(/link de venda não encontrado|venda indisponível/i)).toBeVisible()
    const exit = page.getByRole('link', { name: /ver campeonatos disponíveis/i })
    await expect(exit).toBeVisible()
    await exit.click()
    await expect(page).toHaveURL(/\/campeonatos/)
  })
})
