import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const loginPage = fs.readFileSync(path.join(root, 'web/app/login/page.tsx'), 'utf8')
const meRoute = fs.readFileSync(path.join(root, 'web/app/api/me/route.ts'), 'utf8')
const serverAuth = fs.readFileSync(path.join(root, 'backend/src/auth/server-auth.ts'), 'utf8')

test('124 - perfil direto é resolvido antes de qualquer vínculo legado por e-mail', async () => {
  const blockStart = serverAuth.indexOf('export async function getAccountsByUser(user:')
  const blockEnd = serverAuth.indexOf('export async function getAccountByUserId', blockStart)
  const block = serverAuth.slice(blockStart, blockEnd)
  const directIndex = block.indexOf('const direct = await getAccountsByUserId(user.id)')
  const shortCircuitIndex = block.indexOf('if (direct.length) return direct')
  const legacyIndex = block.indexOf('linkUnownedAccountsByVerifiedEmail(user)')
  expect(directIndex).toBeGreaterThan(-1)
  expect(shortCircuitIndex).toBeGreaterThan(directIndex)
  expect(legacyIndex).toBeGreaterThan(shortCircuitIndex)
  expect(block).not.toContain('Promise.all([\n    getAccountsByUserId(user.id),\n    linkUnownedAccountsByVerifiedEmail(user)')
})

test('124 - vínculo legado consulta somente perfil que aceita auth_user_id ausente', async () => {
  expect(serverAuth).toContain("const types: ProfileType[] = ['equipe']")
})

test('124 - api me separa sessão inválida de falha ao carregar perfis', async () => {
  expect(meRoute).toContain("{ status: 401 }")
  expect(meRoute).toContain("{ status: 404 }")
  expect(meRoute).toContain("{ status: 503 }")
  expect(meRoute).toContain("account: null, accounts: []")
})

test('124 - sessão confirmada não volta ao formulário se api de perfis falhar', async () => {
  const openStart = loginPage.indexOf('async function openAuthenticatedSession')
  const openEnd = loginPage.indexOf('async function retryProfiles', openStart)
  const block = loginPage.slice(openStart, openEnd)
  expect(block).toContain("setStage('profiles')")
  expect(block).toContain('setProfilesLoading(true)')
  expect(block).toContain('setProfileLoadError(')
  expect(block).not.toContain("setStage('authenticate')")
  expect(loginPage).toContain('Tentar carregar perfis novamente')
})

test('124 - callback confirmado limpa complete da URL para F5 normal', async () => {
  expect(loginPage).toContain("cleanUrl.searchParams.delete('complete')")
  expect(loginPage).toContain("cleanUrl.hash = ''")
  expect(loginPage).toContain("window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}`)")
})
