import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')

type StorageState = {
  origins?: Array<{ origin?: string; localStorage?: Array<{ name?: string; value?: string }> }>
}

function token(file: string, origin: string) {
  const state = JSON.parse(fs.readFileSync(file, 'utf8')) as StorageState
  for (const item of state.origins?.find((entry) => entry.origin === origin)?.localStorage || []) {
    if (!item.name?.includes('auth-token') || !item.value) continue
    const parsed = JSON.parse(item.value) as { access_token?: string; currentSession?: { access_token?: string } }
    const accessToken = parsed.access_token || parsed.currentSession?.access_token
    if (accessToken) return accessToken
  }
  throw new Error('Sessão da produtora não encontrada.')
}

test.describe('Correções operacionais — vagas e notificações', () => {
  test('protege leitura em massa e mantém capacidade coerente da fase de entrada', async ({ request, baseURL }) => {
    test.skip(!fs.existsSync(produtoraAuthFile), 'Sessões E2E ainda não foram geradas.')
    const origin = new URL(baseURL || 'http://localhost:3000').origin

    const unauthRead = await request.patch(`${origin}/api/notificacoes`, {
      data: { mark_all_read: true },
    })
    expect(unauthRead.ok(), 'Leitura em massa sem login deve ser bloqueada.').toBe(false)

    const authorization = { Authorization: `Bearer ${token(produtoraAuthFile, origin)}`, 'x-profile-type': 'produtora' }
    const championships = await request.get(`${origin}/api/central-campeonato`, { headers: authorization })
    expect(championships.ok()).toBe(true)
    const list = await championships.json()
    const firstId = String(list?.items?.[0]?.id || '')
    if (!firstId) return

    const summary = await request.get(`${origin}/api/central-campeonato?campeonato_id=${encodeURIComponent(firstId)}`, { headers: authorization })
    expect(summary.ok()).toBe(true)
    const body = await summary.json()
    expect(body?.cards?.vagas?.fonte).toBe('campeonato_configuracoes.numero_vagas')
    expect(Number(body?.cards?.vagas?.slots_estruturados || 0)).toBeGreaterThanOrEqual(0)
    expect(Number(body?.cards?.vagas?.total || 0)).toBeGreaterThanOrEqual(Number(body?.cards?.vagas?.ocupadas || 0))
    expect(Number(body?.cards?.vagas?.disponiveis || 0)).toBe(
      Number(body?.cards?.vagas?.total || 0) - Number(body?.cards?.vagas?.ocupadas || 0),
    )
  })
})
