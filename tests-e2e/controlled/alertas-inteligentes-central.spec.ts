import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

test.describe('Central do Campeonato — alertas inteligentes', () => {
  test('expõe prioridades acionáveis com gravidade, contexto e atalho', async ({ request, browser, baseURL }) => {
    const origin = String(baseURL || '').replace(/\/$/, '')
    const token = await activeAuthToken(browser, path.resolve('tests-e2e/.auth/produtora.json'), '/campeonatos')
    const headers = { Authorization: `Bearer ${token}`, 'x-profile-type': 'produtora' }

    const list = await request.get(`${origin}/api/central-campeonato`, { headers })
    expect(list.ok()).toBe(true)
    const listBody = await list.json()
    const campeonatoId = String(listBody?.items?.[0]?.id || '')
    expect(campeonatoId).not.toBe('')

    const response = await request.get(`${origin}/api/central-campeonato?campeonato_id=${encodeURIComponent(campeonatoId)}`, { headers })
    expect(response.ok()).toBe(true)
    const body = await response.json()

    expect(body?.alert_summary).toEqual(expect.objectContaining({
      total: expect.any(Number),
      critical: expect.any(Number),
      warning: expect.any(Number),
      info: expect.any(Number),
    }))
    expect(body.alert_summary.total).toBe(body.alerts.length)
    for (const alert of body.alerts) {
      expect(['critical', 'warning', 'info']).toContain(alert.severity)
      expect(alert.id).toBeTruthy()
      expect(alert.title).toBeTruthy()
      expect(alert.message).toBeTruthy()
      expect(alert.context).toBeTruthy()
      expect(alert.action).toBeTruthy()
      expect(alert.href).toContain(`/campeonatos/${campeonatoId}`)
    }
  })
})
