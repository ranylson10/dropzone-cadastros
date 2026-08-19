import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const serverAuth = fs.readFileSync(path.join(root, 'backend/src/auth/server-auth.ts'), 'utf8')
const meRoute = fs.readFileSync(path.join(root, 'web/app/api/me/route.ts'), 'utf8')

test('126 - sessão devolve perfil sanitizado e não a linha bruta do banco', async () => {
  const fieldsStart = serverAuth.indexOf('const CLIENT_PROFILE_DATA_FIELDS')
  const fieldsEnd = serverAuth.indexOf('/** Versão mínima', fieldsStart)
  const fields = serverAuth.slice(fieldsStart, fieldsEnd)
  expect(serverAuth).toContain('const CLIENT_PROFILE_DATA_FIELDS')
  expect(serverAuth).toContain('export function toClientProfile')
  expect(fields).not.toContain("'senha_dono'")
  expect(meRoute).toContain('const clientAccounts = accounts.map(toClientProfile)')
  expect(meRoute).toContain('accounts: clientAccounts')
})

test('126 - resolução de sessão e perfis tem limite no servidor', async () => {
  expect(meRoute).toContain('withTimeout(getBearerUser(req), 4_000)')
  expect(meRoute).toContain('withTimeout(getAccountsForUser(user), 4_000)')
  expect(meRoute).toContain('ResolutionTimeoutError')
})
