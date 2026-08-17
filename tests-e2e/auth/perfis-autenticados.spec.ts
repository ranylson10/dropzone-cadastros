import { test, expect, type Browser } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

const perfis = [
  { nome: 'admin', rota: '/admin' },
  { nome: 'produtora', rota: '/campeonatos' },
  { nome: 'manager', rota: '/managers' },
  { nome: 'equipe', rota: '/equipes' },
  { nome: 'jogador', rota: '/jogadores' },
] as const

function authFile(nome: string) {
  return path.resolve(`tests-e2e/.auth/${nome}.json`)
}

async function currentTokenFromPage(page: any): Promise<string | null> {
  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const name = localStorage.key(index)
      if (!name?.includes('auth-token')) continue
      const raw = localStorage.getItem(name)
      if (!raw) continue
      try {
        const value = JSON.parse(raw)
        const token = value?.access_token || value?.currentSession?.access_token
        if (typeof token === 'string' && token.length > 20) return token
      } catch {
        // Ignora entradas que não sejam JSON de sessão.
      }
    }
    return null
  })
}


async function createAuthenticatedPage(browser: Browser, file: string) {
  const context = await browser.newContext({ storageState: file })
  const page = await context.newPage()
  return { context, page }
}

for (const perfil of perfis) {
  test(`${perfil.nome}: sessão, perfil e rota principal`, async ({ browser, baseURL }) => {
    const file = authFile(perfil.nome)
    test.skip(!fs.existsSync(file), `Capture a sessão: npm run test:e2e:auth:capture -- ${perfil.nome}`)

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const { context, page } = await createAuthenticatedPage(browser, file)
    try {
      const response = await page.goto(perfil.rota, { waitUntil: 'domcontentloaded' })
      expect(response?.status() || 200).toBeLessThan(500)
      await page.waitForLoadState('networkidle').catch(() => undefined)

      let token: string | null = null
      for (let attempt = 0; attempt < 20 && !token; attempt += 1) {
        token = await currentTokenFromPage(page)
        if (!token) await page.waitForTimeout(250)
      }
      expect(token, 'Sessão Supabase ativa não encontrada no navegador.').toBeTruthy()

      const me = await context.request.get(origin + '/api/me', {
        headers: {
          Authorization: 'Bearer ' + token,
          ...(perfil.nome === 'admin' ? {} : { 'x-profile-type': perfil.nome }),
        },
      })
      expect(me.status(), 'A API /api/me deve reconhecer a sessão ativa').toBe(200)
      expect(new URL(page.url()).origin).toBe(origin)
      expect(page.url(), `${perfil.nome} foi redirecionado para o login`).not.toContain('/login')
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    } finally {
      await context.close()
    }
  })
}
