import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

function accessTokenFromStorage(file: string, expectedOrigin: string): string {
  const state = JSON.parse(fs.readFileSync(file, 'utf8')) as StorageState
  const origin = state.origins?.find((item) => item.origin === expectedOrigin)
  for (const entry of origin?.localStorage || []) {
    if (!entry.name?.includes('auth-token') || !entry.value) continue
    try {
      const parsed = JSON.parse(entry.value) as {
        access_token?: unknown
        currentSession?: { access_token?: unknown }
      }
      const token = parsed.access_token || parsed.currentSession?.access_token
      if (typeof token === 'string' && token.length > 20) return token
    } catch {
      // Ignora outras chaves do localStorage.
    }
  }
  throw new Error(`Sessão não encontrada em ${file}. Rode npm run testar:tudo.`)
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-profile-type': 'produtora',
    'Content-Type': 'application/json',
  }
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

function expectNoPrivateFields(value: unknown) {
  const serialized = JSON.stringify(value || {}).toLowerCase()
  for (const privateField of [
    'auth_user_id',
    'dono_auth_user_id',
    'access_token',
    'refresh_token',
    'service_role',
    'password',
    'senha',
  ]) {
    expect(serialized, `A resposta pública não pode expor ${privateField}.`).not.toContain(`"${privateField}"`)
  }
}

test.describe('Páginas públicas, buscas e ranking — disponibilidade e privacidade', () => {
  test.setTimeout(150_000)

  test('catálogos públicos funcionam e buscas privadas exigem autenticação', async ({ request, baseURL }) => {
    test.skip(!fs.existsSync(produtoraAuthFile), 'A sessão é gerada automaticamente por npm run testar:tudo.')

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = accessTokenFromStorage(produtoraAuthFile, origin)

    const rank = await request.get(`${origin}/api/rank`, { timeout: 30_000 })
    const rankBody = await json(rank)
    expect(rank.ok(), `Falha ao carregar ranking público: ${rankBody?.error || rank.status()}`).toBe(true)
    expect(Array.isArray(rankBody?.teams)).toBe(true)
    expect(Array.isArray(rankBody?.players)).toBe(true)
    expect(rankBody.teams.length).toBeLessThanOrEqual(100)
    expect(rankBody.players.length).toBeLessThanOrEqual(100)
    rankBody.teams.forEach((item: { rank?: number }, index: number) => expect(item.rank).toBe(index + 1))
    rankBody.players.forEach((item: { rank?: number }, index: number) => expect(item.rank).toBe(index + 1))
    expectNoPrivateFields(rankBody)

    const maps = await request.get(`${origin}/api/mapas`, { timeout: 30_000 })
    const mapsBody = await json(maps)
    expect(maps.ok(), `Falha ao carregar mapas: ${mapsBody?.error || maps.status()}`).toBe(true)
    expect(Array.isArray(mapsBody?.mapas)).toBe(true)
    expectNoPrivateFields(mapsBody)

    const vacancies = await request.get(`${origin}/api/vagas`, { timeout: 45_000 })
    const vacanciesBody = await json(vacancies)
    expect(vacancies.ok(), `Falha ao carregar vagas: ${vacanciesBody?.error || vacancies.status()}`).toBe(true)
    expect(Array.isArray(vacanciesBody?.announcements)).toBe(true)
    expect(vacanciesBody?.authenticated).toBe(false)
    expect(typeof vacanciesBody?.hasTeam).toBe('boolean')
    expectNoPrivateFields(vacanciesBody)

    const conflictingCatalogs = await request.get(
      `${origin}/api/vagas?produtora=00000000-0000-4000-8000-000000000075&vendedor=00000000-0000-4000-8000-000000000075`,
      { timeout: 30_000 },
    )
    const conflictingBody = await json(conflictingCatalogs)
    expect(conflictingCatalogs.status(), 'Dois escopos de catálogo devem ser rejeitados.').toBe(400)
    expect(String(conflictingBody?.error || '')).toContain('somente um catálogo')

    for (const endpoint of [
      '/api/equipes/busca-publica?q=al',
      '/api/jogadores/busca?q=al',
      '/api/campeonatos/busca?q=al',
    ]) {
      const unauthenticated = await request.get(`${origin}${endpoint}`, { timeout: 30_000 })
      expect(unauthenticated.ok(), `${endpoint} sem login deve ser bloqueado.`).toBe(false)
    }

    const teamShortSearch = await request.get(`${origin}/api/equipes/busca-publica?q=a`, {
      headers: headers(produtoraToken),
      timeout: 30_000,
    })
    const teamShortBody = await json(teamShortSearch)
    expect(teamShortSearch.ok(), `Falha na busca curta de equipes: ${teamShortBody?.error || teamShortSearch.status()}`).toBe(true)
    expect(teamShortBody?.items).toEqual([])

    const playerShortSearch = await request.get(`${origin}/api/jogadores/busca?q=a`, {
      headers: headers(produtoraToken),
      timeout: 30_000,
    })
    const playerShortBody = await json(playerShortSearch)
    expect(playerShortSearch.ok(), `Falha na busca curta de jogadores: ${playerShortBody?.error || playerShortSearch.status()}`).toBe(true)
    expect(playerShortBody?.items).toEqual([])

    const championships = await request.get(`${origin}/api/campeonatos/busca?q=&limit=999`, {
      headers: headers(produtoraToken),
      timeout: 30_000,
    })
    const championshipsBody = await json(championships)
    expect(
      championships.ok(),
      `Falha na busca autenticada de campeonatos: ${championshipsBody?.error || championships.status()}`,
    ).toBe(true)
    expect(Array.isArray(championshipsBody?.items)).toBe(true)
    expect(championshipsBody.items.length).toBeLessThanOrEqual(20)
    expectNoPrivateFields(championshipsBody)
  })

  test('principais páginas públicas abrem sem erro de servidor', async ({ page, baseURL }) => {
    const origin = new URL(baseURL || 'http://localhost:3000').origin

    for (const pathname of ['/campeonatos', '/equipes', '/jogadores', '/rank', '/vagas']) {
      const response = await page.goto(`${origin}${pathname}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      })
      expect(response, `${pathname} deve produzir uma resposta HTTP.`).not.toBeNull()
      expect(response!.status(), `${pathname} não pode retornar erro de servidor.`).toBeLessThan(500)
      await expect(page.locator('body')).toBeVisible()
      await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i)
    }
  })
})
