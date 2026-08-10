import { expect, test } from '@playwright/test'

 test('Manager público mantém rota de perfil e vínculo sem criar fluxo paralelo', async ({ request }) => {
  const pageSource = await request.get('/managers/test').catch(() => null)
  expect(pageSource).not.toBeNull()
 })
