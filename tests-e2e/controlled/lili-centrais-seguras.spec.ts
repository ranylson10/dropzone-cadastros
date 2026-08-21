import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')
const jogadorAuthFile = path.resolve('tests-e2e/.auth/jogador.json')

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

function headers(token: string, profileType?: string) {
  return {
    Authorization: `Bearer ${token}`,
    ...(profileType ? { 'x-profile-type': profileType } : {}),
    'Content-Type': 'application/json',
  }
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return response.json().catch(() => null)
}

test.describe('Lili — menu público e centrais privadas seguras', () => {
  test.setTimeout(120_000)

  test('menu público funciona e dados privados respeitam identidade e acesso', async ({ request, browser, baseURL }) => {
    test.skip(
      ![produtoraAuthFile, equipeAuthFile, jogadorAuthFile].every(fs.existsSync),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = await activeAuthToken(browser, produtoraAuthFile, '/campeonatos')
    const equipeToken = await activeAuthToken(browser, equipeAuthFile, '/equipes')
    const jogadorToken = await activeAuthToken(browser, jogadorAuthFile, '/jogadores')

    const missingMessage = await request.post(`${origin}/api/lili/chat`, {
      data: {},
      timeout: 30_000,
    })
    expect(missingMessage.status(), 'Mensagem vazia deve ser rejeitada pela Lili.').toBe(400)

    const publicMenu = await request.post(`${origin}/api/lili/chat`, {
      data: { intent: 'menu', context: { locale: 'pt-BR' } },
      timeout: 30_000,
    })
    const publicMenuBody = await json(publicMenu)
    expect(publicMenu.ok(), `Falha no menu público da Lili: ${publicMenuBody?.error || publicMenu.status()}`).toBe(true)
    expect(publicMenuBody?.intent).toBe('menu')
    expect(typeof publicMenuBody?.reply).toBe('string')
    expect(Array.isArray(publicMenuBody?.actions)).toBe(true)
    expect(publicMenuBody?.actions?.length).toBeGreaterThan(0)
    expect(publicMenuBody?.context?.locale).toBe('pt-BR')

    for (const endpoint of ['campeonatos', 'equipes', 'jogadores']) {
      const unauthenticated = await request.get(`${origin}/api/lili/${endpoint}`, { timeout: 30_000 })
      expect(unauthenticated.ok(), `/api/lili/${endpoint} sem login deve ser bloqueado.`).toBe(false)
    }

    const championships = await request.get(`${origin}/api/lili/campeonatos`, {
      headers: headers(produtoraToken, 'produtora'),
      timeout: 30_000,
    })
    const championshipsBody = await json(championships)
    expect(championships.ok(), `Falha na central de campeonatos: ${championshipsBody?.error || championships.status()}`).toBe(true)
    expect(Array.isArray(championshipsBody?.items)).toBe(true)

    const teams = await request.get(`${origin}/api/lili/equipes`, {
      headers: headers(equipeToken, 'equipe'),
      timeout: 30_000,
    })
    const teamsBody = await json(teams)
    expect(teams.ok(), `Falha na central de equipes: ${teamsBody?.error || teams.status()}`).toBe(true)
    expect(Array.isArray(teamsBody?.items)).toBe(true)
    expect(teamsBody?.items?.length).toBeGreaterThan(0)

    const teamId = String(teamsBody?.items?.[0]?.id || '')
    expect(teamId).not.toBe('')

    const teamDetail = await request.get(`${origin}/api/lili/equipes?id=${encodeURIComponent(teamId)}`, {
      headers: headers(equipeToken, 'equipe'),
      timeout: 30_000,
    })
    const teamDetailBody = await json(teamDetail)
    expect(teamDetail.ok(), `Falha ao abrir equipe na Lili: ${teamDetailBody?.error || teamDetail.status()}`).toBe(true)
    expect(String(teamDetailBody?.team?.id || '')).toBe(teamId)
    expect(teamDetailBody?.overview).toBeTruthy()

    const foreignTeam = await request.get(
      `${origin}/api/lili/equipes?id=00000000-0000-4000-8000-000000000071`,
      {
        headers: headers(equipeToken, 'equipe'),
        timeout: 30_000,
      },
    )
    expect(foreignTeam.ok(), 'Equipe não pode abrir uma identidade que não controla.').toBe(false)

    const players = await request.get(`${origin}/api/lili/jogadores`, {
      headers: headers(jogadorToken, 'jogador'),
      timeout: 30_000,
    })
    const playersBody = await json(players)
    expect(players.ok(), `Falha na central de jogadores: ${playersBody?.error || players.status()}`).toBe(true)
    expect(Array.isArray(playersBody?.items)).toBe(true)
    expect(playersBody?.items?.length).toBeGreaterThan(0)

    const playerId = String(playersBody?.items?.[0]?.id || '')
    expect(playerId).not.toBe('')

    const playerDetail = await request.get(`${origin}/api/lili/jogadores?id=${encodeURIComponent(playerId)}`, {
      headers: headers(jogadorToken, 'jogador'),
      timeout: 30_000,
    })
    const playerDetailBody = await json(playerDetail)
    expect(playerDetail.ok(), `Falha ao abrir jogador na Lili: ${playerDetailBody?.error || playerDetail.status()}`).toBe(true)
    expect(String(playerDetailBody?.player?.id || playerDetailBody?.profile?.id || playerId)).toBe(playerId)

    const foreignPlayer = await request.get(
      `${origin}/api/lili/jogadores?id=00000000-0000-4000-8000-000000000071`,
      {
        headers: headers(jogadorToken, 'jogador'),
        timeout: 30_000,
      },
    )
    expect(foreignPlayer.ok(), 'Jogador não pode abrir perfil que não pertence à sua conta.').toBe(false)

    const authenticatedMenu = await request.post(`${origin}/api/lili/chat`, {
      headers: headers(equipeToken, 'equipe'),
      data: { intent: 'menu', context: { locale: 'pt-BR' } },
      timeout: 30_000,
    })
    const authenticatedMenuBody = await json(authenticatedMenu)
    expect(
      authenticatedMenu.ok(),
      `Falha no menu autenticado da Lili: ${authenticatedMenuBody?.error || authenticatedMenu.status()}`,
    ).toBe(true)
    expect(authenticatedMenuBody?.intent).toBe('menu')
    expect(Array.isArray(authenticatedMenuBody?.actions)).toBe(true)
  })
})
