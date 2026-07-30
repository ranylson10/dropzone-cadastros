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

function tokenFromStorageState(file: string, expectedOrigin: string): string | null {
  const state = JSON.parse(fs.readFileSync(file, 'utf8')) as StorageState
  const normalizedExpected = new URL(expectedOrigin).origin
  const origin = state.origins?.find((item) => item.origin === normalizedExpected)
  if (!origin) return null

  for (const entry of origin.localStorage || []) {
    if (!entry.name?.includes('auth-token') || !entry.value) continue
    try {
      const value = JSON.parse(entry.value) as {
        access_token?: unknown
        currentSession?: { access_token?: unknown }
      }
      const token = value.access_token || value.currentSession?.access_token
      if (typeof token === 'string' && token.length > 20) return token
    } catch {
      // Ignora entradas que não sejam JSON de sessão.
    }
  }
  return null
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
    const token = tokenFromStorageState(file, origin)
    expect(
      token,
      `Sessão Supabase não encontrada para ${origin}. Gere novamente com npm run test:e2e:auth:prepare.`,
    ).toBeTruthy()

    const { context, page } = await createAuthenticatedPage(browser, file)
    try {
      const me = await context.request.get(`${origin}/api/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(perfil.nome === 'admin' ? {} : { 'x-profile-type': perfil.nome }),
        },
      })
      expect(me.status(), 'A API /api/me deve reconhecer a sessão').toBe(200)

      const response = await page.goto(perfil.rota, { waitUntil: 'domcontentloaded' })
      expect(response?.status() || 200).toBeLessThan(500)
      await page.waitForLoadState('networkidle').catch(() => undefined)
      expect(new URL(page.url()).origin).toBe(origin)
      expect(page.url(), `${perfil.nome} foi redirecionado para o login`).not.toContain('/login')
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    } finally {
      await context.close()
    }
  })
}
