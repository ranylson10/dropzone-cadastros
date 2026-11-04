import { expect, type Page } from '@playwright/test'

export async function chooseProducerTool(page: Page, name: string) {
  const selector = page.getByRole('combobox', { name: 'Ferramenta do campeonato', exact: true })
  if (await selector.isVisible()) {
    await selector.selectOption({ label: name })
    await expect(selector.locator('option:checked')).toHaveText(name)
  } else {
    const button = page.getByRole('navigation', { name: 'Áreas do campeonato', exact: true }).getByRole('button', { name, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-current', 'page')
  }
}
