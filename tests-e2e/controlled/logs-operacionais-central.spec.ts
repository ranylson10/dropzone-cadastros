import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

test.describe('Central do Campeonato — logs operacionais completos', () => {
  test('retorna histórico rastreável apenas para campeonato autorizado', async ({ request, browser, baseURL }) => {
    const origin = baseURL || 'http://localhost:3000'
    const token = await activeAuthToken(browser, path.resolve('tests-e2e/.auth/produtora.json'), '/campeonatos')
    const headers = { Authorization: `Bearer ${token}`, 'x-profile-type': 'produtora' }

    const list = await request.get(`${origin}/api/central-campeonato`, { headers })
    expect(list.ok()).toBe(true)
    const listBody = await list.json()
    const campeonatoId = listBody?.items?.[0]?.id
    expect(campeonatoId).toBeTruthy()

    const summary = await request.get(`${origin}/api/central-campeonato?campeonato_id=${encodeURIComponent(campeonatoId)}`, { headers })
    expect(summary.ok()).toBe(true)
    const body = await summary.json()

    expect(Array.isArray(body?.logs)).toBe(true)
    expect(body?.logs?.length).toBeGreaterThan(0)
    expect(Number(body?.log_summary?.visible || 0)).toBe(body.logs.length)
    expect(Number(body?.log_summary?.total || 0)).toBeGreaterThanOrEqual(body.logs.length)
    expect(body.logs[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      category: expect.any(String),
      title: expect.any(String),
      detail: expect.any(String),
      occurred_at: expect.any(String),
      actor: expect.any(String),
      source: expect.any(String),
    }))

    const times = body.logs.map((log: { occurred_at: string }) => new Date(log.occurred_at).getTime())
    expect(times.every((time: number, index: number) => index === 0 || times[index - 1] >= time)).toBe(true)
  })
})
