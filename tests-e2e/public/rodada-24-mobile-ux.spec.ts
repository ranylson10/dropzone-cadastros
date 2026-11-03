import { test, expect } from '@playwright/test'

/** R24: smoke somente leitura nas páginas públicas, sem contas ou operações de escrita.
 * No Windows, o primeiro acesso a /campeonatos compila a rota sob demanda;
 * ampliar somente o prazo não deve mascarar erros de navegação ou de clique.
 */
test.setTimeout(120_000)
for (const width of [320, 360, 390, 430, 768]) {
  test(`R24 público: dock, foco e largura em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 })
    await page.goto('/campeonatos', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    const dock = page.getByRole('navigation', { name: 'Navegação inferior do aplicativo' })
    await expect(dock).toBeVisible()
    // Sem sobreposição: o dock existe até 1023px, não só até 767px.
    await expect(page.locator('.lili-global-launcher.lili-mobile-in-menu')).toBeHidden()
    for (const name of ['Início', 'Campeonatos', 'Equipes', 'Jogadores']) {
      await expect(dock.getByRole('link', { name })).toBeVisible()
    }
    const menu = dock.getByRole('button', { name: 'Abrir menu completo' })
    await menu.focus()
    await menu.click()
    const sheet = page.getByRole('dialog', { name: 'Menu completo do DropZone' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('link', { name: 'Produtoras' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(menu).toBeFocused()
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(horizontalOverflow, `A página não pode ter scroll horizontal em ${width}px`).toBe(false)
  })
}

test('R24 público: navegação desktop sem dock móvel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 })
  await page.goto('/campeonatos', { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect(page.getByRole('navigation', { name: 'Navegação inferior do aplicativo' })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Campeonatos' }).first()).toBeVisible()
})
