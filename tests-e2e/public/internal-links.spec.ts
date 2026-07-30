import { expect, test } from '@playwright/test'
import { isSafeInternalHref, PUBLIC_ROUTES } from '../support/public-routes'

async function collectLinks(page: import('@playwright/test').Page, route: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
    expect(response?.status(), `Falha ao abrir ${route}`).toBeLessThan(500)

    try {
      await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined)
      return await page.locator('a[href]').evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute('href')).filter((href): href is string => Boolean(href)),
      )
    } catch (error) {
      if (attempt === 1 || !String(error).includes('Execution context was destroyed')) throw error
      await page.waitForTimeout(300)
    }
  }
  return []
}

test('links internos públicos não retornam 404 ou 5xx', async ({ page, request, baseURL }) => {
  const links = new Set<string>()

  for (const route of PUBLIC_ROUTES.slice(0, 5)) {
    const hrefs = await collectLinks(page, route)
    for (const href of hrefs) {
      const normalized = href.split('#')[0]
      if (isSafeInternalHref(normalized)) links.add(normalized)
      if (links.size >= 40) break
    }
  }

  expect(links.size, 'Nenhum link interno público foi encontrado').toBeGreaterThan(0)

  const failures: string[] = []
  for (const href of links) {
    const response = await request.get(new URL(href, baseURL).toString(), { maxRedirects: 5 })
    if (response.status() === 404 || response.status() >= 500) {
      failures.push(`${href} -> HTTP ${response.status()}`)
    }
  }

  expect(failures, `Links quebrados:\n${failures.join('\n')}`).toEqual([])
})
