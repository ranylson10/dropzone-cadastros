import type { Browser, BrowserContext } from '@playwright/test'

export async function activeAuthSession(browser: Browser, storageState: string, route = '/') {
  const context = await browser.newContext({ storageState })
  const page = await context.newPage()

  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => undefined)

    let token: string | null = null
    for (let attempt = 0; attempt < 20 && !token; attempt += 1) {
      token = await page.evaluate(() => {
        for (let index = 0; index < localStorage.length; index += 1) {
          const name = localStorage.key(index)
          if (!name?.includes('auth-token')) continue
          const raw = localStorage.getItem(name)
          if (!raw) continue

          try {
            const value = JSON.parse(raw)
            const current = value?.access_token || value?.currentSession?.access_token
            if (typeof current === 'string' && current.length > 20) return current
          } catch {
            // Ignora entradas que não sejam a sessão Supabase.
          }
        }
        return null
      })

      if (!token) await page.waitForTimeout(250)
    }

    if (!token) throw new Error(`Sessão Supabase ativa não encontrada em ${storageState}.`)

    return { context, page, token }
  } catch (error) {
    await context.close()
    throw error
  }
}

export async function closeAuthSessions(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close().catch(() => undefined)))
}

export async function activeAuthToken(browser: Browser, storageState: string, route = '/') {
  const { context, token } = await activeAuthSession(browser, storageState, route)
  await context.close()
  return token
}
